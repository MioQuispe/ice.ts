import { Context, Effect, Layer } from "effect"
import { ICEConfig, ICEUser, InitializedICEConfig } from "../types/types.js"
import { Ids } from "../ids.js"
import { DefaultReplica, Replica } from "./replica.js"
import { DfxReplica } from "./dfx.js"
import { picReplicaImpl } from "./pic/pic.js"
import { NodeContext } from "@effect/platform-node"
import { configLayer } from "../index.js"

// const DfxReplicaService = DfxReplica.pipe(
// 	Layer.provide(NodeContext.layer),
// 	Layer.provide(configLayer),
// )

export class DefaultConfig extends Context.Tag("DefaultConfig")<
	DefaultConfig,
	ICEConfig
>() {
	static readonly Live = Layer.effect(
		DefaultConfig,
		Effect.gen(function* () {
			const defaultReplica = yield* DefaultReplica
			const defaultUser = yield* Effect.tryPromise({
				try: () => Ids.fromDfx("default"),
				// TODO: tagged error
				catch: () => new Error("Failed to get default user"),
			})
			const defaultNetworks = {
				local: {
					replica: defaultReplica,
					host: "https://0.0.0.0",
					port: 8080,
				},
				staging: {
					replica: defaultReplica,
					host: "https://staging.ic0.app",
					port: 80,
				},
				ic: {
					replica: defaultReplica,
					host: "https://ic0.app",
					port: 80,
				},
			}
			const defaultUsers = {
				default: defaultUser,
			}
			// const defaultRoles = {
			// 	deployer: defaultUsers.default,
			// 	minter: defaultUsers.default,
			// 	controller: defaultUsers.default,
			// 	treasury: defaultUsers.default,
			// }
			const defaultRoles = {
				deployer: "default",
				minter: "default",
				controller: "default",
				treasury: "default",
			}

			return {
				users: defaultUsers,
				roles: defaultRoles,
                networks: defaultNetworks,
			}
		}),
	)
}
