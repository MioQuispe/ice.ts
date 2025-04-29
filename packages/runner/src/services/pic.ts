import { Effect, Layer, Context, Data, Config, Ref } from "effect"
import { Command, CommandExecutor, Path, FileSystem } from "@effect/platform"
import { Principal } from "@dfinity/principal"
import { Actor, HttpAgent, type SignIdentity } from "@dfinity/agent"
import { IDL } from "@dfinity/candid"
import find from "find-process"
import { idlFactory } from "../canisters/management_latest/management.did.js"
import { Ed25519KeyIdentity } from "@dfinity/identity"
import type { DfxJson } from "../types/schema.js"
import { ConfigError } from "../index.js"
import type { ManagementActor } from "../types/types.js"
import type { PlatformError } from "@effect/platform/Error"
import os from "node:os"
import psList from "ps-list"
import { PocketIc, PocketIcServer } from "@dfinity/pic"
import { SubnetType } from "@dfinity/pic/dist/pocket-ic-client-types.js"

// Error types
export class PocketICError extends Data.TaggedError("PocketICError")<{
	readonly message: string
}> {}

export class PocketICService extends Context.Tag("PocketICService")<
	PocketICService,
	{
		// readonly start: () => Effect.Effect<void, PlatformError>
		// readonly stop: () => Effect.Effect<void, PocketICError>
		readonly getUrl: () => Effect.Effect<string, PocketICError>
		readonly network: string
		readonly createCanister: (args: {
			canisterId?: string
			identity: SignIdentity
		}) => Effect.Effect<string, PocketICError>
		readonly installCode: (args: {
			canisterId: string
			wasm: Uint8Array
			encodedArgs: Uint8Array
			identity: SignIdentity
		}) => Effect.Effect<void, PocketICError>
	}
>() {
	static Live = Layer.effect(
		PocketICService,
		Effect.gen(function* () {
			const commandExecutor = yield* CommandExecutor.CommandExecutor
			const fs = yield* FileSystem.FileSystem
			const path = yield* Path.Path
			const dfxPort = "8080"
			const host = "http://0.0.0.0"

			const picServer = yield* Effect.tryPromise(() => PocketIcServer.start())
			const url = picServer.getUrl()
			const pic = yield* Effect.tryPromise(() => PocketIc.create(url))
			const NNS_SUBNET_ID =
				"nt6ha-vabpm-j6nog-bkr62-vbgbt-swwzc-u54zn-odtoy-igwlu-ab7uj-4qe"

			const command = Command.make("./pocket-ic", "--port", dfxPort)
			yield* Effect.log(`Starting pocket-ic: ${command.toString()}`)
			const pocketIcProcess = yield* commandExecutor
				.start(command)
				.pipe(Effect.scoped)

			yield* Effect.log(`Pocket-ic started: ${pocketIcProcess.pid}`)

			return PocketICService.of({
				network: "local",
				createCanister: ({ canisterId, identity }) =>
					Effect.gen(function* () {
						const createdCanisterId = yield* Effect.tryPromise({
							try: () =>
								pic.createCanister({
									sender: identity.getPrincipal(),
									...(canisterId
										? {
												targetCanisterId: Principal.fromText(canisterId),
												// targetSubnetId: Principal.fromText(NNS_SUBNET_ID),
											}
										: {}),
								}),
							catch: (error) =>
								new PocketICError({
									message: `Failed to create canister: ${error instanceof Error ? error.message : String(error)}`,
								}),
						})
						return createdCanisterId.toText()
					}),
				installCode: ({ canisterId, wasm, encodedArgs, identity }) =>
					Effect.gen(function* () {
						yield* Effect.tryPromise({
							try: () =>
								// TODO: mode: install / reinstall etc.
								pic.reinstallCode({
									arg: encodedArgs.buffer,
									sender: identity.getPrincipal(),
									canisterId: Principal.fromText(canisterId),
									wasm: wasm.buffer,
									// targetSubnetId: Principal.fromText(NNS_SUBNET_ID),
								}),
							catch: (error) =>
								new PocketICError({
									message: `Failed to install code: ${error instanceof Error ? error.message : String(error)}`,
								}),
						})
					}),
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
				getUrl: () => Effect.succeed(url),
			})
		}),
	)
}
