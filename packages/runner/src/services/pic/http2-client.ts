export class ServerRequestTimeoutError extends Error {
	constructor() {
		super("A request to the PocketIC server timed out.")
	}
}

export interface PollOptions {
	intervalMs: number
	timeoutMs: number
}

export async function poll<T extends (...args: any) => any>(
	cb: T,
	{ intervalMs, timeoutMs }: PollOptions,
): Promise<ReturnType<T>> {
	const startTimeMs = Date.now()

	return new Promise((resolve, reject) => {
		async function runPoll(): Promise<void> {
			const currentTimeMs = Date.now()

			try {
				const result = await cb()
				return resolve(result)
			} catch (e) {
                if (e instanceof Error && e.cause === "no_subnet") {
                    return reject(e)
                }
				if (e instanceof Error && e.cause === "auto_progress_already_enabled") {
					return reject(e)
				}
				if (currentTimeMs - startTimeMs >= timeoutMs) {
					return reject(e)
				}

				setTimeout(runPoll, intervalMs)
			}
		}

		runPoll()
	})
}

export function isNil(value: unknown): value is null | undefined {
	return value === null || value === undefined
}

export interface RequestOptions {
	method: Method
	path: string
	headers?: RequestHeaders
	body?: Uint8Array
}

export type RequestHeaders = RequestInit["headers"]

export interface JsonGetRequest {
	path: string
	headers?: RequestHeaders
}

export interface JsonPostRequest<B> {
	path: string
	headers?: RequestHeaders
	body?: B
}

export type ResponseHeaders = ResponseInit["headers"]

export type Method = "GET" | "POST" | "PUT" | "DELETE"

export const JSON_HEADER: RequestHeaders = {
	"Content-Type": "application/json",
}

export class Http2Client {
	constructor(
		private readonly baseUrl: string,
		private readonly processingTimeoutMs: number,
	) {}

	public request(init: RequestOptions): Promise<Response> {
		const timeoutAbortController = new AbortController()
		const requestAbortController = new AbortController()

		const cancelAfterTimeout = async (): Promise<never> => {
			return await new Promise((_, reject) => {
				const timeoutId = setTimeout(() => {
					requestAbortController.abort()
					reject(new ServerRequestTimeoutError())
				}, this.processingTimeoutMs)

				timeoutAbortController.signal.addEventListener("abort", () => {
					clearTimeout(timeoutId)
					reject(new ServerRequestTimeoutError())
				})
			})
		}

		const makeRequest = async (): Promise<Response> => {
			const url = `${this.baseUrl}${init.path}`

			// @ts-ignore
			const res = await fetch(url, {
				method: init.method,
				headers: init.headers,
                // @ts-ignore
				body: init.body,
				signal: requestAbortController.signal,
			})
			timeoutAbortController.abort()

			return res
		}

		return Promise.race([makeRequest(), cancelAfterTimeout()])
	}

	public async jsonGet<R extends {}>(init: JsonGetRequest): Promise<R> {
		// poll the request until it is successful or times out
		return await poll(
			async () => {
				const res = await this.request({
					method: "GET",
					path: init.path,
					headers: { ...init.headers, ...JSON_HEADER },
				})

				const resBody = (await res.json()) as ApiResponse<R>
				if (!resBody) {
					return resBody
				}

				// server encountered an error, throw and try again
				if ("message" in resBody) {
					console.error("PocketIC server encountered an error", resBody.message)

					throw new Error(resBody.message)
				}

				// the server has started processing or is busy
				if ("state_label" in resBody) {
					// the server is too busy to process the request, throw and try again
					if (res.status === 409) {
						throw new Error("Server busy")
					}

					// the server has started processing the request
					// this shouldn't happen for GET requests, throw and try again
					if (res.status === 202) {
						throw new Error("Server started processing")
					}

					// something weird happened, throw and try again
					throw new Error("Unknown state")
				}

				// the request was successful, exit the loop
				return resBody
			},
			{ intervalMs: POLLING_INTERVAL_MS, timeoutMs: this.processingTimeoutMs },
		)
	}

	public async jsonPost<B, R extends {}>(init: JsonPostRequest<B>): Promise<R> {
		const reqBody = init.body
			? new TextEncoder().encode(JSON.stringify(init.body))
			: undefined

		// poll the request until it is successful or times out
		return await poll(
			async () => {
				// @ts-ignore
				const res = await this.request({
					method: "POST",
					path: init.path,
					headers: { ...init.headers, ...JSON_HEADER },
					body: reqBody,
				})

				const resBody = (await res.json()) as ApiResponse<R>
				if (isNil(resBody)) {
					return resBody
				}

				// server encountered an error, throw and try again
				if ("message" in resBody) {
                    if (resBody.message.includes("Auto progress mode has already been enabled")) {
						throw new Error(resBody.message, { cause: "auto_progress_already_enabled" })
                    }
					if (resBody.message.includes("does not belong to any subnet")) {
						throw new Error(resBody.message, { cause: "no_subnet" })
                    }
					throw new Error(resBody.message)
				}

				// the server has started processing or is busy
				if ("state_label" in resBody) {
					// the server is too busy to process the request, throw and try again
					if (res.status === 409) {
						throw new Error("Server busy")
					}

					// the server has started processing the request, poll until it is done
					if (res.status === 202) {
						return await poll(
							async () => {
								const stateRes = await this.request({
									method: "GET",
									path: `/read_graph/${resBody.state_label}/${resBody.op_id}`,
								})

								const stateBody = (await stateRes.json()) as ApiResponse<R>

								// the server encountered an error, throw and try again
								if (
									isNil(stateBody) ||
									"message" in stateBody ||
									"state_label" in stateBody
								) {
									throw new Error("Polling has not succeeded yet")
								}

								// the request was successful, exit the loop
								return stateBody
							},
							{
								intervalMs: POLLING_INTERVAL_MS,
								timeoutMs: this.processingTimeoutMs,
							},
						)
					}

					// something weird happened, throw and try again
					throw new Error("Unknown state")
				}

				// the request was successful, exit the loop
				return resBody
			},
			{ intervalMs: POLLING_INTERVAL_MS, timeoutMs: this.processingTimeoutMs },
		)
	}

}

const POLLING_INTERVAL_MS = 10

interface StartedOrBusyApiResponse {
	state_label: string
	op_id: string
}

interface ErrorResponse {
	message: string
}

type ApiResponse<R extends {}> = StartedOrBusyApiResponse | ErrorResponse | R
