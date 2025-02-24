import { DfxService } from "./services/dfx.js"
import { Moc } from "./services/moc.js"
import { Principal } from "@dfinity/principal"
import { sha256 } from "js-sha256"
import { DeploymentError } from "./index.js"
import { IDL } from "@dfinity/candid"
import { Effect, Config } from "effect"
import { Path, FileSystem, CommandExecutor, Command } from "@effect/platform"
import * as didc from "@ice.ts/didc_js"
import { iceDirName } from "./builders/custom.js"
import type { log_visibility } from "./canisters/management_latest/management.types.js"
import { Actor } from "@dfinity/agent"
import type * as ActorTypes from "./types/actor.js"

// TODO: just one place to define this
export type Opt<T> = [T] | []
export const Opt = <T>(value?: T): Opt<T> => {
	return value || value === 0 ? [value] : []
}

export const installCanister = ({
	encodedArgs,
	canisterId,
	wasmPath,
}: {
	encodedArgs: Uint8Array
	canisterId: string
	wasmPath: string
}) =>
	Effect.gen(function* () {
		const { mgmt } = yield* DfxService
		const fs = yield* FileSystem.FileSystem
		const wasmContent = yield* fs.readFile(wasmPath)
		const wasm = new Uint8Array(wasmContent)
		const maxSize = 3670016
		const isOverSize = wasm.length > maxSize
		const wasmModuleHash = Array.from(sha256.array(wasm))
		yield* Effect.logDebug(`Installing code for ${canisterId} at ${wasmPath}`)
		if (isOverSize) {
			// TODO: proper error handling if fails?
			const chunkSize = 1048576
			// Maximum size: 1048576
			const chunkHashes: Array<{ hash: Array<number> }> = []
			const chunkUploadEffects: any = []
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
							new DeploymentError({
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
					new DeploymentError({
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
					new DeploymentError({
						message: `Failed to install code: ${error instanceof Error ? error.message : String(error)}`,
					}),
			})
		}
		yield* Effect.logDebug(`Code installed for ${canisterId}`)
	})

export const compileMotokoCanister = (
	src: string,
	canisterName: string,
	wasmOutputFilePath: string,
) =>
	Effect.gen(function* () {
		const moc = yield* Moc
		// Create output directories if they don't exist
		yield* Effect.logDebug(`Compiling ${canisterName} to ${wasmOutputFilePath}`)
		// TODO: we need to make dirs if they don't exist
		yield* moc.compile(src, wasmOutputFilePath)
		yield* Effect.logDebug(
			`Successfully compiled ${src} ${canisterName} outputFilePath: ${wasmOutputFilePath}`,
		)
		return wasmOutputFilePath
	})

export const createCanister = (canisterId?: string) =>
	Effect.gen(function* () {
		const { mgmt, identity } = yield* DfxService
		if (canisterId) {
			const canisterInfo = yield* getCanisterInfo(canisterId)
			if (canisterInfo.status !== "not_installed") {
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
							controllers: Opt<Principal[]>([identity.getPrincipal()]),
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
				new DeploymentError({
					message: `Failed to create canister: ${error instanceof Error ? error.message : String(error)}`,
				}),
		})
		return createResult.canister_id.toText()
	})

export const generateDIDJS = (canisterName: string, didPath: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const path = yield* Path.Path
		const appDir = yield* Config.string("APP_DIR")
		const didString = yield* fs.readFileString(didPath)
		const didJSString = didc.did_to_js(didString)
		const didJSPath = path.join(
			appDir,
			iceDirName,
			"canisters",
			canisterName,
			`${canisterName}.did.js`,
		)
		yield* fs.makeDirectory(path.dirname(didJSPath), { recursive: true })
		yield* fs.writeFile(didJSPath, Buffer.from(didJSString ?? ""))

		const canisterDID = yield* Effect.tryPromise({
			try: () => import(didJSPath),
			catch: (error) =>
				new DeploymentError({
					message: `Failed to import canister DID: ${error instanceof Error ? error.message : String(error)}`,
				}),
		})

		if (!canisterDID) {
			return yield* Effect.fail(
				new DeploymentError({ message: "Failed to convert DID to JS" }),
			)
		}
		return canisterDID
	})

export const encodeArgs = (args: any[], canisterDID: any) => {
	const encodedArgs = args
		? new Uint8Array(IDL.encode(canisterDID.init({ IDL }), args))
		: new Uint8Array()
	return encodedArgs
}

export const stopCanister = (canisterId: string) =>
	Effect.gen(function* () {
		const { mgmt } = yield* DfxService
		yield* Effect.tryPromise(() =>
			mgmt.stop_canister({
				canister_id: Principal.fromText(canisterId),
			}),
		)
	})

export const deleteCanister = (canisterId: string) =>
	Effect.gen(function* () {
		const { mgmt } = yield* DfxService
		yield* Effect.tryPromise(() =>
			mgmt.delete_canister({
				canister_id: Principal.fromText(canisterId),
			}),
		)
		// TODO: delete from canister_ids.json
	})

export const createActor = <T>({
	canisterId,
	canisterDID,
}: {
	canisterId: string
	canisterDID: any
}) =>
	Effect.gen(function* () {
		const { agent } = yield* DfxService
		const commandExecutor = yield* CommandExecutor.CommandExecutor
		// TODO: should be agnostic of dfx
		const getControllers = () => Promise.resolve()
		const addControllers = (controllers: Array<string>) =>
			Effect.gen(function* () {
				const command = Command.make(
					"dfx",
					"canister",
					"--network",
					"local",
					"update-settings",
					...controllers.flatMap((c) => ["--add-controller", c]),
					canisterId,
				)
				yield* commandExecutor.start(command)
			})

		const setControllers = (controllers: Array<string>) =>
			Effect.gen(function* () {
				// TODO: dont depend on dfx
				const cyclesWalletCommand = Command.make(
					"dfx",
					"identity",
					"get-wallet",
				)
				const cyclesWallet = yield* Command.string(cyclesWalletCommand)

				// TODO: dont depend on dfx
				const command = Command.make(
					"dfx",
					"canister",
					"--network",
					"local",
					"update-settings",
					...controllers.flatMap((c) => ["--set-controller", c]),
					"--set-controller",
					cyclesWallet.trim(),
					canisterId,
				)
				yield* commandExecutor.start(command)
			})

		return Actor.createActor<T>(canisterDID.idlFactory, {
			agent,
			canisterId,
		}) as ActorTypes.ActorSubclass<T>
		// TODO: ...?
		// return {
		//   getControllers,
		//   addControllers,
		//   setControllers,
		// }
	})

export const getCanisterInfo = (canisterId: string) =>
	Effect.gen(function* () {
		const { mgmt } = yield* DfxService
		// TODO: get from environment
		const canisterInfo = yield* Effect.tryPromise({
			try: async () => {
				// TODO: this might not be defined. where do we get it from?
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
				return error
			},
		})

		// if (result.module_hash.length > 0) {
		//   console.log(
		//     `Canister ${canisterName} is already installed. Skipping deployment.`,
		//   )
		// }
		return canisterInfo
	})
