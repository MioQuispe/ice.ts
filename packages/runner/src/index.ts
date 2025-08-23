import type { ICEConfig, ICECtx } from "./types/types.js"
import type { Scope, TaskTree } from "./types/types.js"
export { Opt } from "./types/types.js"
export * from "./builders/index.js"
export type { CanisterScope } from "./builders/lib.js"
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


export { runCli } from "./cli/index.js"
export type { TaskCtxShape } from "./tasks/lib.js"
