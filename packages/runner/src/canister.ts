import { Actor, HttpAgent } from "@dfinity/agent"
import { IDL } from "@dfinity/candid"
import { Command, CommandExecutor, FileSystem, Path } from "@effect/platform"
import * as didc from "@ice.ts/didc_js"
import { Data, Effect } from "effect"
import { Moc } from "./services/moc.js"
import { TaskCtx } from "./tasks/lib.js"
import type * as ActorTypes from "./types/actor.js"

export class DeploymentError extends Data.TaggedError("DeploymentError")<{
	message: string
}> {}

// TODO: just one place to define this
export type Opt<T> = [T] | []
export const Opt = <T>(value?: T): Opt<T> => {
	return value || value === 0 ? [value] : []
}

export const compileMotokoCanister = (
	src: string,
	canisterName: string,
	wasmOutputFilePath: string,
) =>
	Effect.gen(function* () {
		const moc = yield* Moc
		// Create output directories if they don't exist
		yield* Effect.logDebug(
			`Compiling from ${src}, with name ${canisterName} to ${wasmOutputFilePath}`,
		)
		// TODO: we need to make dirs if they don't exist
		yield* moc.compile(src, wasmOutputFilePath)
		yield* Effect.logDebug(
			`Successfully compiled ${src} ${canisterName} outputFilePath: ${wasmOutputFilePath}`,
		)
		return wasmOutputFilePath
	})

/**
 * Creates a canister using the provisional_create_canister_with_cycles method via the management canister.
 * This function uses the agent provided by DfxService.
 *
 * @param canisterId - The optional canister ID.
 * @returns An Effect that resolves to the Principal of the created canister or fails with a DeploymentError.
 */
export const createCanister = (canisterId?: string) =>
	Effect.gen(function* () {
		const { users, replica } = yield* TaskCtx
		const {
			roles: {
				deployer: { identity },
			},
		} = yield* TaskCtx
		const createdCanisterId = yield* replica.createCanister({
			canisterId,
			identity,
		})
		return createdCanisterId
	})

// TODO: types for DIDJS
export const generateDIDJS = (canisterName: string, didPath: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const path = yield* Path.Path
		const { appDir, iceDir } = yield* TaskCtx
		const didString = yield* fs.readFileString(didPath)
		const didJSString = didc.did_to_js(didString)
		const didTSString = didc.did_to_ts(didString)
		const didJSPath = path.join(
			appDir,
			iceDir,
			"canisters",
			canisterName,
			`${canisterName}.did.js`,
		)
		const didTSPath = path.join(
			appDir,
			iceDir,
			"canisters",
			canisterName,
			`${canisterName}.did.ts`,
		)
		yield* fs.makeDirectory(path.dirname(didJSPath), { recursive: true })
		yield* fs.writeFile(didJSPath, Buffer.from(didJSString ?? ""))
		yield* fs.writeFile(didTSPath, Buffer.from(didTSString ?? ""))

		const didJS = yield* Effect.tryPromise({
			try: () => import(didJSPath),
			catch: (error) =>
				new DeploymentError({
					message: `Failed to import canister DID: ${error instanceof Error ? error.message : String(error)}`,
				}),
		})

		if (!didJS) {
			return yield* Effect.fail(
				new DeploymentError({ message: "Failed to convert DID to JS" }),
			)
		}
		return {
			didJS,
			didJSPath,
			didTSPath,
		}
	})

/**
 * Represents the expected structure of a dynamically imported DID module.
 */
export interface CanisterDidModule {
	idlFactory: IDL.InterfaceFactory
	init: (args: { IDL: typeof IDL }) => IDL.Type[]
}

export const encodeArgs = (args: unknown[], canisterDID: CanisterDidModule) =>
	Effect.gen(function* () {
		return yield* Effect.try({
			try: () => {
				const encodedArgs = args
					? new Uint8Array(IDL.encode(canisterDID.init({ IDL }), args))
					: new Uint8Array()
				return encodedArgs
			},
			catch: (error) => {
				// TODO: change error type
				return new DeploymentError({
					message: `Failed to encode args: ${error instanceof Error ? error.message : String(error)}, with args: ${args}`,
				})
			},
		})
	})

export const createActor = <T>({
	canisterId,
	canisterDID,
}: {
	canisterId: string
	canisterDID: any
}) =>
	Effect.gen(function* () {
		const { users, roles, replica } = yield* TaskCtx
		// TODO: do we need a separate role for this?
		const { identity } = roles.deployer
		const commandExecutor = yield* CommandExecutor.CommandExecutor

		// TODO: pic has its own createActor ? cant use HttpAgent directly?
		// TODO: optimize / cache?
		const agent = yield* Effect.tryPromise({
			try: () =>
				HttpAgent.create({
					identity,
					host: `${replica.host}:${replica.port}`,
				}),
			catch: (error) =>
				new DeploymentError({
					message: `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`,
				}),
		})
		yield* Effect.tryPromise({
			try: () => agent.fetchRootKey(),
			catch: (error) =>
				new DeploymentError({
					message: `Failed to fetch root key: ${error instanceof Error ? error.message : String(error)}`,
				}),
		})
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
			// TODO: users.deployer?
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
