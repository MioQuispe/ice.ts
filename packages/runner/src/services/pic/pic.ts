import { Effect, Layer, Context, Data, Config, Ref } from "effect"
import { Command, CommandExecutor, Path, FileSystem } from "@effect/platform"
import { Principal } from "@dfinity/principal"
import {
	Actor,
	ActorSubclass,
	HttpAgent,
	type SignIdentity,
} from "@dfinity/agent"
import { IDL } from "@dfinity/candid"
import find from "find-process"
import { idlFactory } from "../../canisters/management_latest/management.did.js"
import { Ed25519KeyIdentity } from "@dfinity/identity"
import type { DfxJson } from "../../types/schema.js"
import { Opt } from "../../index.js"
import type { ManagementActor } from "../../types/types.js"
import type { PlatformError } from "@effect/platform/Error"
import os from "node:os"
import psList from "ps-list"
import {
	PocketIc,
	PocketIcServer,
	createActorClass,
} from "@dfinity/pic"
import { PocketIcClient as CustomPocketIcClient } from "./pocket-ic-client.js"
import {
	AgentError,
	CanisterCreateError,
	CanisterDeleteError,
	CanisterInstallError,
	CanisterStatusError,
	CanisterStopError,
	CanisterStatus,
	Replica,
} from "../replica.js"
import { sha256 } from "js-sha256"
import type { log_visibility } from "@dfinity/agent/lib/cjs/canisters/management_service.js"
import * as url from "node:url"
import { SubnetStateType } from "./pocket-ic-client-types.js"
import type * as ActorTypes from "../../types/actor.js"

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


	// TODO: fix!
	const port = 8081
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
	// const NNS_SUBNET_ID =
	// 	"nt6ha-vabpm-j6nog-bkr62-vbgbt-swwzc-u54zn-odtoy-igwlu-ab7uj-4qe"

	const customPocketIcClient = yield* Effect.tryPromise({
		try: () =>
			// TODO: creates a new instance every time?
			CustomPocketIcClient.create(`${host}:${port}`, {
				nns: {
					state: {
						type: SubnetStateType.New,
						// TODO: save state
						// "path": "/nns/subnet/state",
						// "path": "/.ice/subnets/",
						// subnetId: Principal.fromText(NNS_SUBNET_ID),
					},
				},
				ii: {
					state: {
						type: SubnetStateType.New,
					},
				},
				fiduciary: {
					state: {
						type: SubnetStateType.New,
					},
				},
				bitcoin: {
					state: {
						type: SubnetStateType.New,
					},
				},
				sns: {
					state: {
						type: SubnetStateType.New,
					},
				},
				// TODO:
				// system: vec![],
				// verified_application: vec![],
				// application: vec![],
				// application: [
				// 	{ state: { type: SubnetStateType.New } },
				// 	{ state: { type: SubnetStateType.New } },
				//   ],
			}),
		catch: (error) =>
			new AgentError({
				message: `Failed to create custom pocket-ic client: ${error instanceof Error ? error.message : String(error)}`,
			}),
	})
	// @ts-ignore
	const pic: PocketIc = new PocketIc(customPocketIcClient)

	// /{id}/auto_progress
	// pic.makeLive()
	// pub struct AutoProgressConfig {
	// 	pub artificial_delay_ms: Option<u64>,
	// }
	yield* Effect.tryPromise({
		try: () =>
			customPocketIcClient.makeLive({
				artificialDelayMs: 0,
			}),
		catch: (error) =>
			new AgentError({
				message: `Failed to make pic live: ${error instanceof Error ? error.message : String(error)}`,
			}),
	}).pipe(Effect.ignore)

	// const topology = yield* Effect.tryPromise({
	// 	try: () => customPocketIcClient.getTopology(),
	// 	catch: (error) =>
	// 		new AgentError({
	// 			message: `Failed to get topology: ${error instanceof Error ? error.message : String(error)}`,
	// 		}),
	// })

	// const applicationSubnets = yield* Effect.tryPromise({
	// 	try: () => pic.getApplicationSubnets(),
	// 	catch: (error) =>
	// 		new AgentError({
	// 			message: `Failed to get application subnets: ${error instanceof Error ? error.message : String(error)}`,
	// 		}),
	// })

	// const nnsSubnet = Object.values(topology).find(
	// 	(subnet) => subnet.type === "NNS",
	// )
	// const appSubnet = Object.values(topology).find(
	// 	(subnet) => subnet.type === "Application",
	// )

	const getAgent = (identity: SignIdentity) =>
		// TODO: cache these
		Effect.gen(function* () {
			const agent = yield* Effect.tryPromise({
				try: () =>
					HttpAgent.create({
						identity,
						host: `${host}:${port}`,
					}),
				catch: (error) =>
					new AgentError({
						message: `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`,
					}),
			})
			yield* Effect.tryPromise({
				try: () => agent.fetchRootKey(),
				catch: (error) =>
					new AgentError({
						message: `Failed to fetch root key: ${error instanceof Error ? error.message : String(error)}`,
					}),
			})
			return agent
		})

	// TODO: cache?
	const getMgmt = (identity: SignIdentity) =>
		Effect.gen(function* () {
			const Mgmt = createActorClass<ManagementActor>(
				idlFactory,
				Principal.fromText("aaaaa-aa"),
				// @ts-ignore
				customPocketIcClient,
			)
			const mgmt = new Mgmt()
			// TODO: ???
			mgmt.setIdentity(identity)
			return mgmt
		})

	// TODO: create errors
	const getCanisterStatus = ({
		canisterId,
		identity,
	}: { canisterId: string; identity: SignIdentity }) =>
		Effect.gen(function* () {
			const mgmt = yield* getMgmt(identity)
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
		identity,
	}: { canisterId: string; identity: SignIdentity }) =>
		Effect.gen(function* () {
			const mgmt = yield* getMgmt(identity)
			const canisterInfo = yield* Effect.tryPromise({
				try: async () => {
					// TODO: throw error instead? not sure
					if (!canisterId) {
						return { status: "not_installed" } as const
					}
					try {
						const result = await mgmt.canister_status({
							canister_id: Principal.fromText(canisterId),
						})
						return {
							...result,
							status: Object.keys(result.status)[0] as CanisterStatus,
						}
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

		installCode: ({ canisterId, wasm, encodedArgs, identity }) =>
			Effect.gen(function* () {
				const maxSize = 3670016
				const isOverSize = wasm.length > maxSize
				const wasmModuleHash = Array.from(sha256.array(wasm))
				const mgmt = yield* getMgmt(identity)
				const canisterInfo = yield* getCanisterInfo({
					canisterId,
					identity,
				})
				// const mode =
				// 	canisterInfo.status === "not_installed" ? "install" : "reinstall"
				// TODO: "install" doesnt work for certain canisters for some reason
				const mode = "reinstall"

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

					yield* Effect.tryPromise({
						try: () =>
							// TODO: use pic.installCode instead
							// pic.installCode({
							// 	arg: encodedArgs.buffer,
							// 	sender: identity.getPrincipal(),
							// 	canisterId: Principal.fromText(canisterId),
							// 	wasm: wasm.buffer,
							// 	// targetSubnetId: nnsSubnet?.id!,
							// }),
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
						try: () => {
							if (mode === "reinstall") {
								return pic.reinstallCode({
									arg: encodedArgs.buffer,
									sender: identity.getPrincipal(),
									canisterId: Principal.fromText(canisterId),
									wasm: wasm.buffer,
									// targetSubnetId: nnsSubnet?.id!,
								})
							} else {
								return pic.installCode({
									arg: encodedArgs.buffer,
									sender: identity.getPrincipal(),
									canisterId: Principal.fromText(canisterId),
									wasm: wasm.buffer,
									// targetSubnetId: nnsSubnet?.id!,
								})
							}
						},
						// TODO: BadIngressMessage doesnt stop due to polling
						// mgmt.install_code({
						// 	// arg: encodedArgs,
						// 	arg: Array.from(encodedArgs),
						// 	canister_id: Principal.fromText(canisterId),
						// 	sender_canister_version: Opt<bigint>(),
						// 	wasm_module: Array.from(wasm),
						// 	mode: { reinstall: null },
						// 	// TODO: upgrade mode / upgrade args
						// 	// arg: Array.from(Uint8Array.from([])),
						// 	// export type canister_install_mode = { 'reinstall' : null } |
						// 	//   {
						// 	//     'upgrade' : [] | [
						// 	//       {
						// 	//         'wasm_memory_persistence' : [] | [
						// 	//           { 'keep' : null } |
						// 	//             { 'replace' : null }
						// 	//         ],
						// 	//         'skip_pre_upgrade' : [] | [boolean],
						// 	//       }
						// 	//     ]
						// 	//   } |
						// 	//   { 'install' : null };
						// }),
						catch: (error) => {
							return new CanisterInstallError({
								message: `Failed to install code: ${error instanceof Error ? error.message : String(error)}`,
							})
						},
					})
				}
			}),
		createCanister: ({ canisterId, identity }) =>
			Effect.gen(function* () {
				// TODO: get stack trace somehow
				// const mgmt = yield* getMgmt(identity)
				const controller = identity.getPrincipal()
				if (canisterId) {
					// TODO: canisterId is set but its not created, causes error?
					const canisterStatus = yield* getCanisterStatus({
						canisterId,
						identity,
					})
					if (canisterStatus !== "not_installed") {
						return canisterId
					}
				}
				// targetSubnetId related:
				// Canister ranges:
				// https://wiki.internetcomputer.org/wiki/Subnet_splitting_forum_announcement_template#firstHeading

				const sender = identity.getPrincipal()
				const targetCanisterId = canisterId
					? Principal.fromText(canisterId)
					: undefined
				const createResult = yield* Effect.tryPromise({
					try: () =>
						pic.createCanister({
							// computeAllocation: 100n,
							// computeAllocation: 0n,
							controllers: [controller],
							cycles: 1_000_000_000_000_000_000n,
							// 164_261_999_000_000_000_000_000_000 additional cycles are required.
							// freezingThreshold: 1_000_000_000_000_000_000n,
							// memoryAllocation: 0n,
							// memoryAllocation: 543_313_362_944n,
							// memoryAllocation: 313_362_944n,
							// reservedCyclesLimit: 1_000_000_000_000_000_000n,
							// reservedCyclesLimit: 0n,
							...(targetCanisterId ? { targetCanisterId } : {}),
							// TODO:
							// targetSubnetId: nnsSubnet?.id!,
							sender,
						}),
					catch: (error) =>
						new CanisterCreateError({
							message: `Failed to create canister: ${error instanceof Error ? error.message : String(error)}`,
							cause: new Error("Failed to create canister"),
						}),
				})
				// pic.addCycles(createResult, 1_000_000_000_000_000)
				return createResult.toText()

				// const createResult = yield* Effect.tryPromise({
				// 	try: () =>
				// 		// // TODO: mainnet
				// 		// mgmt.create_canister({
				// 		//   settings: [
				// 		//     {
				// 		//       compute_allocation: Opt<bigint>(),
				// 		//       memory_allocation: Opt<bigint>(),
				// 		//       freezing_threshold: Opt<bigint>(),
				// 		//       controllers: Opt<Principal[]>([identity.getPrincipal()]),
				// 		//       reserved_cycles_limit: Opt<bigint>(),
				// 		//       log_visibility: Opt<log_visibility>(),
				// 		//       wasm_memory_limit: Opt<bigint>(),
				// 		//     },
				// 		//   ],
				// 		//   sender_canister_version: Opt<bigint>(0n),
				// 		// })
				// 		// TODO: this only works on local
				// 		mgmt.provisional_create_canister_with_cycles({
				// 			settings: [
				// 				{
				// 					compute_allocation: Opt<bigint>(),
				// 					memory_allocation: Opt<bigint>(),
				// 					freezing_threshold: Opt<bigint>(),
				// 					controllers: Opt<Principal[]>([controller]),
				// 					reserved_cycles_limit: Opt<bigint>(),
				// 					log_visibility: Opt<log_visibility>(),
				// 					wasm_memory_limit: Opt<bigint>(),
				// 				},
				// 			],
				// 			amount: Opt<bigint>(1_000_000_000_000_000_000n),
				// 			specified_id: Opt<Principal>(
				// 				canisterId ? Principal.fromText(canisterId) : undefined,
				// 			),
				// 			sender_canister_version: Opt<bigint>(0n),
				// 		}) as Promise<{ canister_id: Principal }>,
				// 	catch: (error) =>
				// 		new CanisterCreateError({
				// 			message: `Failed to create canister: ${error instanceof Error ? error.message : String(error)}`,
				// 		}),
				// })
				// return createResult.canister_id.toText()
			}),
		stopCanister: ({ canisterId, identity }) =>
			Effect.gen(function* () {
				const mgmt = yield* getMgmt(identity)
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
		removeCanister: ({ canisterId, identity }) =>
			Effect.gen(function* () {
				const mgmt = yield* getMgmt(identity)
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
		createActor: <_SERVICE>({
			canisterId,
			canisterDID,
			identity,
		}: { canisterId: string; canisterDID: any; identity: SignIdentity }) =>
			Effect.gen(function* () {
				const actor = pic.createActor(
					canisterDID.idlFactory,
					Principal.fromText(canisterId),
				)
				actor.setIdentity(identity)
				// TODO: fix this. ActorInterface<_SERVICE>
				return actor as unknown as ActorTypes.ActorSubclass<_SERVICE>
			}),
	})
})
