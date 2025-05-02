import { Effect, Layer, Context, Data, Config } from "effect"
import { Command, CommandExecutor, Path, FileSystem } from "@effect/platform"
import { Principal } from "@dfinity/principal"
import { Actor, HttpAgent, type SignIdentity } from "@dfinity/agent"
import { sha256 } from "js-sha256"
import { IDL } from "@dfinity/candid"
import find from "find-process"
import { idlFactory } from "../canisters/management_latest/management.did.js"
import type {
	canister_status_result,
	log_visibility,
} from "../canisters/management_latest/management.types.js"
import { Ed25519KeyIdentity } from "@dfinity/identity"
import type { DfxJson } from "../types/schema.js"
import type { ManagementActor } from "../types/types.js"
import type { PlatformError } from "@effect/platform/Error"
import os from "node:os"
import psList from "ps-list"
import {
	type CanisterStatus,
	CanisterStatusError,
	CanisterInstallError,
	CanisterCreateError,
	CanisterStopError,
	CanisterDeleteError,
	DefaultReplica,
	Replica,
} from "./replica.js"
import { Opt } from "../canister.js"
import { TaskCtx } from "src/tasks/lib.js"

export const dfxDefaults: DfxJson = {
	defaults: {
		build: {
			packtool: "",
			args: "--force-gc",
		},
		replica: {
			subnet_type: "system",
		},
	},
	networks: {
		local: {
			bind: "127.0.0.1:8080",
			type: "ephemeral",
		},
		staging: {
			providers: ["https://ic0.app"],
			type: "persistent",
		},
		ic: {
			providers: ["https://ic0.app"],
			type: "persistent",
		},
	},
	version: 1,
}

// Error types
export class DfxError extends Data.TaggedError("DfxError")<{
	readonly message: string
}> {}

const dfxReplicaImpl = Effect.gen(function* () {
	const commandExecutor = yield* CommandExecutor.CommandExecutor
	const fs = yield* FileSystem.FileSystem
	const path = yield* Path.Path
	// TODO: part of context?
	const port = 8080
	const host = "http://0.0.0.0"

	// const processes = yield* Effect.tryPromise(() =>
	//   psList({
	//     all: true,
	//   })
	// )
	// const dfxProcesses = processes.filter((process) => process.name === "dfx")
	// // yield* Effect.logDebug("dfxProcesses", { dfxProcesses })
	// if (dfxProcesses.length === 0) {
	//   // yield* Effect.logDebug("DFX is not running, start DFX")
	//   yield* Effect.fail(new DfxError({ message: "DFX is not running" }))
	// //   const command = Command.make(
	// //     "dfx",
	// //     "start",
	// //     "--background",
	// //     "--clean",
	// //   )
	// //   yield* commandExecutor.start(command).pipe(Effect.scoped)
	// }

	// TODO: create errors
	const getCanisterStatus = ({
		canisterId,
		agent,
	}: { canisterId: string; agent: HttpAgent }) =>
		Effect.gen(function* () {
			// TODO: canisterStatus implement it in dfx & pic services instead
			// TODO: get from environment
			const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
				canisterId: "aaaaa-aa",
				agent,
			})
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
			const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
				canisterId: "aaaaa-aa",
				agent,
			})
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
		// TODO: implement methods
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

		// start: () =>
		// 	Effect.gen(function* () {
		// 		const command = Command.make(
		// 			"dfx",
		// 			"start",
		// 			"--background",
		// 			"--clean",
		// 		)
		// 		yield* commandExecutor.start(command).pipe(Effect.scoped)
		// 		// yield* Effect.tryMap({
		// 		//   try: () => commandExecutor.start(command),
		// 		//   catch: (error) =>
		// 		//     new DfxError({
		// 		//       message: `Failed to start DFX: ${error instanceof Error ? error.message : String(error)}`,
		// 		//     }),
		// 		//   onSuccess: () => undefined,
		// 		// })
		// 	}),
		// stop: () =>
		// 	Effect.tryPromise({
		// 		try: async () => {
		// 			const processes = await Promise.all([
		// 				find("name", "dfx", true),
		// 				find("name", "replica", true),
		// 				find("name", "icx-proxy", true),
		// 			])
		// 			for (const proc of processes.flat()) {
		// 				process.kill(proc.pid)
		// 			}
		// 		},
		// 		catch: (error) =>
		// 			new DfxError({
		// 				message: `Failed to kill DFX processes: ${error instanceof Error ? error.message : String(error)}`,
		// 			}),
		// 	}),

		// getWebserverPort: () =>
		// 	Effect.gen(function* () {
		// 		const command = Command.make("dfx", "info", "webserver-port")
		// 		const output = yield* commandExecutor.string(command).pipe(
		// 			Effect.mapError(
		// 				(err) =>
		// 					new DfxError({
		// 						message: `Failed to get webserver port: ${err.message}`,
		// 					}),
		// 			),
		// 		)
		// 		const port = Number.parseInt(output.trim(), 10)

		// 		if (Number.isNaN(port)) {
		// 			return yield* Effect.fail(
		// 				new DfxError({ message: "Failed to parse DFX webserver port" }),
		// 			)
		// 		}
		// 		return port
		// 	}),
	})
})

export const DfxReplica = Layer.effect(Replica, dfxReplicaImpl)

export const DfxDefaultReplica = Layer.effect(DefaultReplica, dfxReplicaImpl)
