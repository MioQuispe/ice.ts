import { Context, Effect, Layer } from "effect"
import { InitializedICEConfig } from "../types/types.js"
import { Ids } from "../ids.js"
import { DefaultReplica } from "./replica.js"
export class DefaultConfig extends Context.Tag("DefaultConfig")<
	DefaultConfig,
	InitializedICEConfig
>() {
	static readonly Live = Layer.effect(
		DefaultConfig,
		Effect.gen(function* () {
			// // TODO: move to services
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
			// const { config } = yield* ICEConfigService
			// yield* Effect.logDebug("Got config")
			// // TODO: get from cli args
			// const currentNetwork = "local"
			// const currentNetworkConfig =
			// 	config?.networks?.[currentNetwork] ?? defaultNetworks[currentNetwork]
			// const currentReplica = currentNetworkConfig.replica
			// const currentRoles = config?.roles ?? defaultConfig.roles
			// const currentUsers = config?.users ?? defaultConfig.users
			// const networks = config?.networks ?? defaultConfig.networks
			const defaultUsers = {
				default: defaultUser,
			}
			const defaultRoles = {
				deployer: "default",
				minter: "default",
				controller: "default",
				treasury: "default",
			}
            // TODO: types
			const initializedRoles = Object.fromEntries(
				Object.entries(defaultRoles).map(([name, user]) => {
					return [name, defaultUsers.default]
				}),
            )

			return {
				users: defaultUsers,
				roles: initializedRoles,
                networks: defaultNetworks,
			}
		}),
	)
}
