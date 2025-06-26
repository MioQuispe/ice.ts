import path from "node:path"
import { Opt } from "../types"
import * as url from "node:url"
import type { ActorSubclass } from "@dfinity/agent"
import { idlFactory } from "./internet_identity.did.js"
import type {
	InternetIdentityInit,
	_SERVICE,
} from "./internet_identity.types.js"
import { customCanister, type TaskCtxShape } from "@ice.ts/runner"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

const InternetIdentityIds = {
	local: "rdmx6-jaaaa-aaaaa-aaadq-cai",
	ic: "rdmx6-jaaaa-aaaaa-aaadq-cai",
}

export type CanisterInitArgs = [
	Opt<{
		assigned_user_number_range: [bigint, bigint]
	}>,
]

// TODO: make subtasks easily overrideable. maybe helpers like withInstall(). or just let users keep chaining the builder api
type InitArgs = {
	owner: string
	assignedUserNumberRange: [bigint, bigint]
}
export const InternetIdentity = (
	initArgsOrFn?: InitArgs | ((args: { ctx: TaskCtxShape }) => InitArgs),
) => {
	return customCanister<_SERVICE, CanisterInitArgs>({
		canisterId: InternetIdentityIds.local,
		candid: path.resolve(
			__dirname,
			"./internet-identity/internet_identity.did",
		),
		wasm: path.resolve(
			__dirname,
			"./internet-identity/internet_identity.wasm.gz",
		),
	}).installArgs(async ({ mode, ctx }) => {
		// TODO: better signature
		const initArgs =
			typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx }) : initArgsOrFn
		// TODO: automatic types for actor?
		// TODO: do we need to install the canister here also?
		// const initArgs = await (typeof initArgsOrFn === "function" ? initArgsOrFn({ ctx: ctx }) : initArgsOrFn)
		// if (mode === "install" || mode === "reinstall") {
		const args: InternetIdentityInit = {
			assigned_user_number_range: initArgs.assignedUserNumberRange,
		}
		return [Opt(args)]
		// }
		// TODO: should be error, type is wrong!
		// if (mode === "reinstall") {
		//   return [Opt(initArgs.owner ?? null)]
		// }
		// if (mode === "upgrade") {
		//   // return [Opt(initArgs.owner ?? null)]
		// }
		// -m, --mode <MODE>
		// Specifies the mode of canister installation.
		// If set to 'auto', either 'install' or 'upgrade' will be used, depending on whether the canister is already installed.
		// [possible values: install, reinstall, upgrade, auto]
	})
}

InternetIdentity.id = InternetIdentityIds

InternetIdentity.idlFactory = idlFactory

export type InternetIdentityActor = ActorSubclass<
	import("./internet_identity.types")._SERVICE
>

// InternetIdentity({ owner: "123", assignedUserNumberRange: [1n, 100n] }).installArgs(async ({ mode, ctx }) => {
//   return [[{assigned_user_number_range: [1n, 100n]}]]
// })
