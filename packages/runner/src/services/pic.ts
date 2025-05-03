import { Effect, Layer, Context, Data, Config, Ref } from "effect"
import { Command, CommandExecutor, Path, FileSystem } from "@effect/platform"
import { Principal } from "@dfinity/principal"
import { Actor, type HttpAgent, type SignIdentity } from "@dfinity/agent"
import { IDL } from "@dfinity/candid"
import find from "find-process"
import { idlFactory } from "../canisters/management_latest/management.did.js"
import { Ed25519KeyIdentity } from "@dfinity/identity"
import type { DfxJson } from "../types/schema.js"
import { ConfigError, Opt } from "../index.js"
import type { ManagementActor } from "../types/types.js"
import type { PlatformError } from "@effect/platform/Error"
import os from "node:os"
import psList from "ps-list"
import { PocketIc, PocketIcServer } from "@dfinity/pic"
import { SubnetType } from "@dfinity/pic/dist/pocket-ic-client-types.js"
import {
	CanisterCreateError,
	CanisterDeleteError,
	CanisterInstallError,
	type CanisterStatus,
	CanisterStatusError,
	CanisterStopError,
	Replica,
} from "./replica.js"
import { sha256 } from "js-sha256"
import type { log_visibility } from "@dfinity/agent/lib/cjs/canisters/management_service.js"
import * as url from "node:url"

// Error types
// export class PocketICError extends Data.TaggedError("PocketICError")<{
// 	readonly message: string
// }> {}

// export class PocketICService extends Context.Tag("PocketICService")<
// 	PocketICService,
// 	{
// 		// readonly start: () => Effect.Effect<void, PlatformError>
// 		// readonly stop: () => Effect.Effect<void, PocketICError>
// 		readonly getUrl: () => Effect.Effect<string, PocketICError>
// 		readonly network: string
// 		readonly createCanister: (args: {
// 			canisterId?: string
// 			identity: SignIdentity
// 		}) => Effect.Effect<string, PocketICError>
// 		readonly installCode: (args: {
// 			canisterId: string
// 			wasm: Uint8Array
// 			encodedArgs: Uint8Array
// 			identity: SignIdentity
// 		}) => Effect.Effect<void, PocketICError>
// 	}
// >() {}

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
export const picReplicaImpl = Effect.gen(function* () {
	const commandExecutor = yield* CommandExecutor.CommandExecutor
	const fs = yield* FileSystem.FileSystem
	const path = yield* Path.Path
	// const port = 8080
	// const host = "http://0.0.0.0"

	const picPath = path.resolve(__dirname, "./pocket-ic")
	// const dirUrl = new URL(".", import.meta.url).href
	// TODO: pocket-ic isnt moved to dist/
	// we need to move it in the build step and get the url somehow
	const port = 8080
	const ipAddr = "0.0.0.0"
	const host = `http://${ipAddr}`
	// const command = Command.make(picPath, "--ip-addr", ipAddr, "--port", port.toString())
	// yield* Effect.log(`Starting pocket-ic: ${command.toString()}`)
	// const pocketIcProcess = yield* commandExecutor
	// 	.start(command)
	// 	.pipe(Effect.scoped)

	// // const picServer = yield* Effect.tryPromise(() => PocketIcServer.start())
	// // const url = picServer.getUrl()
	// yield* Effect.log(`Pocket-ic started: ${pocketIcProcess.pid}, url: ${host}:${port}`)
	// url example: http://127.0.0.1:65127
	// TODO: split url into host and port
	// const urlParts = new URL(url)
	// const host = `http://${urlParts.hostname}`
	// const port = Number.parseInt(urlParts.port, 10)
	// const port = 8080
	console.log("address", `${host}:${port}`)
	const pic = yield* Effect.tryPromise(() => PocketIc.create(`${host}:${port}`))
	console.log("created instance subnet")
	const NNS_SUBNET_ID =
		"nt6ha-vabpm-j6nog-bkr62-vbgbt-swwzc-u54zn-odtoy-igwlu-ab7uj-4qe"

	// TODO: create errors
	const getCanisterStatus = ({
		canisterId,
		agent,
	}: { canisterId: string; agent: HttpAgent }) =>
		Effect.gen(function* () {
			// TODO: canisterStatus implement it in dfx & pic services instead
			// TODO: get from environment
			const mgmt = pic.createActor<ManagementActor>(
				idlFactory,
				Principal.fromText("aaaaa-aa"),
			)
			const identity = yield* Effect.tryPromise({
				try: () => agent.config.identity as Promise<SignIdentity>,
				catch: (error) => {
					return new CanisterStatusError({
						message: `Failed to get canister status: ${error instanceof Error ? error.message : String(error)}`,
					})
				},
			})
			mgmt.setIdentity(identity)
			console.log("trying to get statussssssssss")
			// const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
			// 	canisterId: "aaaaa-aa",
			// 	agent,
			// })
			const canisterInfo = yield* Effect.tryPromise({
				try: async () => {
					// TODO: throw error instead? not sure
					if (!canisterId) {
						return { status: "not_installed" }
					}
					try {
						return await mgmt.canister_status({
							canister_id: Principal.fromText(canisterId),
						})
					} catch (error) {
						return { status: "not_installed" }
					}
				},
				catch: (error) => {
					return new CanisterStatusError({
						message: `Failed to get canister status: ${error instanceof Error ? error.message : String(error)}`,
					})
				},
			})

			let canisterStatus: CanisterStatus = "not_installed"
			switch (canisterInfo.status) {
				case "not_installed":
					canisterStatus = "not_installed"
					break
				case "stopped":
					canisterStatus = "stopped"
					break
				case "running":
					canisterStatus = "running"
					break
			}
			// if (result.module_hash.length > 0) {
			//   console.log(
			//     `Canister ${canisterName} is already installed. Skipping deployment.`,
			//   )
			// }
			return canisterStatus
		})

	const getCanisterInfo = ({
		canisterId,
		agent,
	}: { canisterId: string; agent: HttpAgent }) =>
		Effect.gen(function* () {
			// TODO: canisterStatus implement it in dfx & pic services instead
			// TODO: get from environment
			// const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
			// 	canisterId: "aaaaa-aa",
			// 	agent,
			// })
			const mgmt = pic.createActor<ManagementActor>(
				idlFactory,
				Principal.fromText("aaaaa-aa"),
			)
			const identity = yield* Effect.tryPromise({
				try: () => agent.config.identity as Promise<SignIdentity>,
				catch: (error) => {
					return new CanisterStatusError({
						message: `Failed to get canister status: ${error instanceof Error ? error.message : String(error)}`,
					})
				},
			})
			mgmt.setIdentity(identity)
			console.log("trying to get infoooooooooo")
			const canisterInfo = yield* Effect.tryPromise({
				try: async () => {
					// TODO: throw error instead? not sure
					if (!canisterId) {
						return { status: "not_installed" } as const
					}
					try {
						return await mgmt.canister_status({
							canister_id: Principal.fromText(canisterId),
						})
					} catch (error) {
						return { status: "not_installed" } as const
					}
				},
				catch: (error) => {
					return new CanisterStatusError({
						message: `Failed to get canister info: ${error instanceof Error ? error.message : String(error)}`,
					})
				},
			})
			// if (result.module_hash.length > 0) {
			//   console.log(
			//     `Canister ${canisterName} is already installed. Skipping deployment.`,
			//   )
			// }
			return canisterInfo
		})

	return Replica.of({
		host,
		port,
		// createCanister: ({ canisterId, identity }) =>
		// 	Effect.gen(function* () {
		// 		const createdCanisterId = yield* Effect.tryPromise({
		// 			try: () =>
		// 				pic.createCanister({
		// 					sender: identity.getPrincipal(),
		// 					...(canisterId
		// 						? {
		// 								targetCanisterId: Principal.fromText(canisterId),
		// 								// targetSubnetId: Principal.fromText(NNS_SUBNET_ID),
		// 							}
		// 						: {}),
		// 				}),
		// 			catch: (error) =>
		// 				new PocketICError({
		// 					message: `Failed to create canister: ${error instanceof Error ? error.message : String(error)}`,
		// 				}),
		// 		})
		// 		return createdCanisterId.toText()
		// 	}),
		// installCode: ({ canisterId, wasm, encodedArgs, identity }) =>
		// 	Effect.gen(function* () {
		// 		yield* Effect.tryPromise({
		// 			try: () =>
		// 				// TODO: mode: install / reinstall etc.
		// 				pic.reinstallCode({
		// 					arg: encodedArgs.buffer,
		// 					sender: identity.getPrincipal(),
		// 					canisterId: Principal.fromText(canisterId),
		// 					wasm: wasm.buffer,
		// 					// targetSubnetId: Principal.fromText(NNS_SUBNET_ID),
		// 				}),
		// 			catch: (error) =>
		// 				new PocketICError({
		// 					message: `Failed to install code: ${error instanceof Error ? error.message : String(error)}`,
		// 				}),
		// 		})
		// 	}),

		// start: () =>
		// 	Effect.gen(function* () {
		// 		const command = Command.make("./pocket-ic", "--port", dfxPort)
		// 		pocketIcProcess = yield* commandExecutor
		// 			.start(command)
		// 			.pipe(Effect.scoped)
		// 	}),
		// stop: () =>
		// 	Effect.tryPromise({
		// 		try: async () => {
		// 			await picServer.stop()
		// 			// const processes = await Promise.all([
		// 			// 	find("name", "pocket-ic", true),
		// 			// ])
		// 			// for (const proc of processes.flat()) {
		// 			// 	process.kill(proc.pid)
		// 			// }
		// 		},
		// 		catch: (error) =>
		// 			new PocketICError({
		// 				message: `Failed to kill DFX processes: ${error instanceof Error ? error.message : String(error)}`,
		// 			}),
		// 	}),
		// getUrl: () => Effect.succeed(url),

		installCode: ({ canisterId, wasm, encodedArgs, agent }) =>
			Effect.gen(function* () {
				const maxSize = 3670016
				const isOverSize = wasm.length > maxSize
				const wasmModuleHash = Array.from(sha256.array(wasm))
				const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
					canisterId: "aaaaa-aa",
					agent,
				})
				yield* Effect.logDebug(`Installing code for ${canisterId}`)
				if (isOverSize) {
					// TODO: proper error handling if fails?
					const chunkSize = 1048576
					// Maximum size: 1048576
					const chunkHashes: Array<{ hash: Array<number> }> = []
					const chunkUploadEffects = []
					for (let i = 0; i < wasm.length; i += chunkSize) {
						const chunk = wasm.slice(i, i + chunkSize)
						const chunkHash = Array.from(sha256.array(chunk))
						chunkHashes.push({ hash: chunkHash })
						chunkUploadEffects.push(
							Effect.tryPromise({
								try: () =>
									mgmt.upload_chunk({
										chunk: Array.from(chunk),
										canister_id: Principal.fromText(canisterId),
									}),
								catch: (error) =>
									new CanisterInstallError({
										message: `Failed to upload chunk: ${
											error instanceof Error ? error.message : String(error)
										}`,
									}),
							}).pipe(
								Effect.tap(() =>
									Effect.logDebug(
										`Uploading chunk ${i} of ${wasm.length} for ${canisterId}`,
									),
								),
							),
						)
					}
					yield* Effect.all(chunkUploadEffects, {
						concurrency: "unbounded",
					})

					Effect.tryPromise({
						try: () =>
							mgmt.install_chunked_code({
								arg: Array.from(encodedArgs),
								target_canister: Principal.fromText(canisterId),
								sender_canister_version: Opt<bigint>(),
								mode: { reinstall: null },
								// TODO: upgrade mode / upgrade args
								// mode: { upgrade: [] },
								// export type canister_install_mode = { 'reinstall' : null } |
								//   {
								//     'upgrade' : [] | [
								//       {
								//         'wasm_memory_persistence' : [] | [
								//           { 'keep' : null } |
								//             { 'replace' : null }
								//         ],
								//         'skip_pre_upgrade' : [] | [boolean],
								//       }
								//     ]
								//   } |
								//   { 'install' : null };
								chunk_hashes_list: chunkHashes,
								store_canister: [],
								wasm_module_hash: wasmModuleHash,
							}),
						catch: (error) =>
							new CanisterInstallError({
								message: `Failed to install code: ${error instanceof Error ? error.message : String(error)}`,
							}),
					})
				} else {
					yield* Effect.tryPromise({
						try: () =>
							mgmt.install_code({
								// arg: encodedArgs,
								arg: Array.from(encodedArgs),
								canister_id: Principal.fromText(canisterId),
								sender_canister_version: Opt<bigint>(),
								wasm_module: Array.from(wasm),
								mode: { reinstall: null },
								// TODO: upgrade mode / upgrade args
								// arg: Array.from(Uint8Array.from([])),
								// export type canister_install_mode = { 'reinstall' : null } |
								//   {
								//     'upgrade' : [] | [
								//       {
								//         'wasm_memory_persistence' : [] | [
								//           { 'keep' : null } |
								//             { 'replace' : null }
								//         ],
								//         'skip_pre_upgrade' : [] | [boolean],
								//       }
								//     ]
								//   } |
								//   { 'install' : null };
							}),
						catch: (error) =>
							new CanisterInstallError({
								message: `Failed to install code: ${error instanceof Error ? error.message : String(error)}`,
							}),
					})
				}
				yield* Effect.logDebug(`Code installed for ${canisterId}`)
			}),
		createCanister: ({ canisterId, agent }) =>
			Effect.gen(function* () {
				const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
					canisterId: "aaaaa-aa",
					agent,
				})
				const controller = yield* Effect.tryPromise({
					try: () => agent.getPrincipal(),
					catch: (error) =>
						new CanisterCreateError({
							message: `Failed to get controller: ${error instanceof Error ? error.message : String(error)}`,
						}),
				})
				if (canisterId) {
					const canisterStatus = yield* getCanisterStatus({
						canisterId,
						agent,
					})
					if (canisterStatus !== "not_installed") {
						return canisterId
					}
				}
				const createResult = yield* Effect.tryPromise({
					try: () =>
						// // TODO: mainnet
						// mgmt.create_canister({
						//   settings: [
						//     {
						//       compute_allocation: Opt<bigint>(),
						//       memory_allocation: Opt<bigint>(),
						//       freezing_threshold: Opt<bigint>(),
						//       controllers: Opt<Principal[]>([identity.getPrincipal()]),
						//       reserved_cycles_limit: Opt<bigint>(),
						//       log_visibility: Opt<log_visibility>(),
						//       wasm_memory_limit: Opt<bigint>(),
						//     },
						//   ],
						//   sender_canister_version: Opt<bigint>(0n),
						// })
						// TODO: this only works on local
						mgmt.provisional_create_canister_with_cycles({
							settings: [
								{
									compute_allocation: Opt<bigint>(),
									memory_allocation: Opt<bigint>(),
									freezing_threshold: Opt<bigint>(),
									controllers: Opt<Principal[]>([controller]),
									reserved_cycles_limit: Opt<bigint>(),
									log_visibility: Opt<log_visibility>(),
									wasm_memory_limit: Opt<bigint>(),
								},
							],
							amount: Opt<bigint>(1_000_000_000_000_000_000n),
							specified_id: Opt<Principal>(
								canisterId ? Principal.fromText(canisterId) : undefined,
							),
							sender_canister_version: Opt<bigint>(0n),
						}) as Promise<{ canister_id: Principal }>,
					catch: (error) =>
						new CanisterCreateError({
							message: `Failed to create canister: ${error instanceof Error ? error.message : String(error)}`,
						}),
				})
				return createResult.canister_id.toText()
			}),
		stopCanister: ({ canisterId, agent }) =>
			Effect.gen(function* () {
				const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
					canisterId: "aaaaa-aa",
					agent,
				})
				yield* Effect.tryPromise({
					try: () =>
						mgmt.stop_canister({
							canister_id: Principal.fromText(canisterId),
						}),
					catch: (error) =>
						new CanisterStopError({
							message: `Failed to stop canister: ${error instanceof Error ? error.message : String(error)}`,
						}),
				})
			}),
		removeCanister: ({ canisterId, agent }) =>
			Effect.gen(function* () {
				const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
					canisterId: "aaaaa-aa",
					agent,
				})
				yield* Effect.tryPromise({
					try: () =>
						mgmt.delete_canister({
							canister_id: Principal.fromText(canisterId),
						}),
					catch: (error) =>
						new CanisterDeleteError({
							message: `Failed to delete canister: ${error instanceof Error ? error.message : String(error)}`,
						}),
				})
			}),
		getCanisterStatus,
		getCanisterInfo,
	})
})
