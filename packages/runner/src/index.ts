import { makeCliRuntime } from "./cli/index.js"
import type { ICEConfig, ICECtx } from "./types/types.js"
import type { Scope, TaskTree } from "./types/types.js"
export { Opt } from "./types/types.js"
export * from "./builders/index.js"
export type { CanisterScopeSimple } from "./builders/lib.js"
export type { CustomCanisterScope } from "./builders/custom.js"
export * from "./ids.js"
export type { InstallModes } from "./services/replica.js"

export const Ice = (
	configOrFn:
		| Partial<ICEConfig>
		| ((ctx: ICECtx) => Promise<Partial<ICEConfig>>),
) => {
	return configOrFn
}

// TODO: just use namespaces instead
export const scope = <T extends TaskTree>(description: string, children: T) => {
	return {
		_tag: "scope",
		id: Symbol("scope"),
		tags: [],
		description,
		children,
	} satisfies Scope
}

// TODO: figure out programmatic use & API
// export const publicRuntime = (globalArgs: { network: string; logLevel: string }) => {
//     const runtime = makeCliRuntime({ globalArgs })
//     return {
//         runTask: (task: Task) => runtime.runPromise(task)
//         runTaskByPath: (path: string) => runtime.runPromise(runTaskByPath(path))
//     }
// }

export { runCli } from "./cli/index.js"
export type { TaskCtxShape } from "./services/taskCtx.js"
