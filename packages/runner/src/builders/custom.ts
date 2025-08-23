import { Effect, Record } from "effect"
import type { Scope, Task, TaskTree } from "../types/types.js"
// import mo from "motoko"
import { FileSystem, Path } from "@effect/platform"
import { InstallModes } from "../services/replica.js"
import {
	BindingsTask,
	BuildTask,
	DeployTask,
	CanisterScope,
	DependencyMismatchError,
	ExtractScopeSuccesses,
	InstallTask,
	InstallTaskArgs,
	IsValid,
	TaskCtxShape,
	UpgradeTask,
	TaskError,
	builderRuntime,
} from "./lib.js"
import { getNodeByPath, ParamsToArgs, TaskParamsToArgs } from "../tasks/lib.js"
import {
	AllowedDep,
	hashConfig,
	hashJson,
	isArtifactCachedEffect,
	linkChildren,
	makeCanisterStatusTask,
	makeCreateTask,
	makeInstallTask,
	makeRemoveTask,
	makeStopTask,
	NormalizeDeps,
	normalizeDepsMap,
	resolveConfig,
	Tags,
	ValidProvidedDeps,
	resolveMode,
	makeUpgradeTask,
} from "./lib.js"
// TODO: move to lib.ts
import { generateDIDJS } from "../canister.js"
import { TaskCtx } from "../tasks/lib.js"
import { type } from "arktype"

export type CustomCanisterConfig = {
	wasm: string
	candid: string
	canisterId?: string
}

export const deployParams = {
	mode: {
		type: InstallModes.or("'auto'"),
		description: "The mode to install the canister in",
		// TODO: add "auto"
		default: "auto" as const,
		isFlag: true as const,
		isOptional: true as const,
		isVariadic: false as const,
		name: "mode",
		aliases: ["m"],
		parse: (value: string) => value as InstallModes,
	},
	args: {
		// TODO: maybe not Uint8Array?
		type: type("TypedArray.Uint8"),
		description: "The arguments to pass to the canister as a candid string",
		// default: undefined,
		isFlag: true as const,
		isOptional: true as const,
		isVariadic: false as const,
		name: "args",
		aliases: ["a"],
		parse: (value: string) => {
			// TODO: convert to candid string
			return new Uint8Array(Buffer.from(value))
		},
	},
	// TODO: provide defaults. just read from fs by canister name
	// should we allow passing in wasm bytes?
	wasm: {
		type: type("string"),
		description: "The path to the wasm file",
		isFlag: true as const,
		isOptional: true as const,
		isVariadic: false as const,
		name: "wasm",
		aliases: ["w"],
		parse: (value: string) => value as string,
	},
	// TODO: provide defaults
	candid: {
		// TODO: should be encoded?
		type: type("string"),
		description: "The path to the candid file",
		isFlag: true as const,
		isOptional: true as const,
		isVariadic: false as const,
		name: "candid",
		aliases: ["c"],
		parse: (value: string) => value as string,
	},
	// TODO: provide defaults
	canisterId: {
		type: type("string"),
		description: "The canister ID to install the canister in",
		isFlag: true as const,
		isOptional: true as const,
		isVariadic: false as const,
		name: "canisterId",
		aliases: ["i"],
		parse: (value: string) => value as string,
	},
}

export type DeployTaskArgs = ParamsToArgs<typeof deployParams>

export const makeCustomDeployTask = <_SERVICE>(
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape }) => Promise<CustomCanisterConfig>)
		| ((args: { ctx: TaskCtxShape }) => CustomCanisterConfig)
		| CustomCanisterConfig,
): DeployTask<_SERVICE> => {
	return {
		_tag: "task",
		// TODO: change
		id: Symbol("canister/deploy"),
		dependsOn: {},
		// TODO: we only want to warn at a type level?
		// TODO: type Task
		dependencies: {},
		namedParams: deployParams,
		params: deployParams,
		positionalParams: [],
		effect: (taskCtx) =>
			builderRuntime.runPromise(
				Effect.fn("task_effect")(function* () {
					const { taskPath, runTask } = taskCtx
					const canisterName = taskPath
						.split(":")
						.slice(0, -1)
						.join(":")
					const canisterConfig = yield* resolveConfig(
						taskCtx,
						canisterConfigOrFn,
					)
					// TODO: include this in taskCtx instead? as { scope }
					const parentScope = (yield* getNodeByPath(
						taskCtx,
						canisterName,
					)) as CanisterScope<_SERVICE>
					const { args } = taskCtx
					const taskArgs = args as DeployTaskArgs
					// const mode = yield* resolveMode()

					// TODO: this requires create, because some have canisterId hardcoded?
					const mode =
						taskArgs.mode === "auto"
							? yield* resolveMode(
									taskCtx,
									canisterConfig?.canisterId,
								)
							: taskArgs.mode
					console.log("mode", mode, "taskArgs.mode", taskArgs.mode)
					const [
						canisterId,
						[
							{
								result: { wasmPath, candidPath },
							},
						],
					] = yield* Effect.all(
						[
							Effect.gen(function* () {
								yield* Effect.logDebug(
									"Now running create task",
								)
								const { result: canisterId } =
									yield* Effect.tryPromise({
										try: () =>
											runTask(
												parentScope.children.create,
												{},
											),
										catch: (error) => {
											return new TaskError({
												message: String(error),
											})
										},
									})
								yield* Effect.logDebug(
									"Finished running create task",
								)
								return canisterId
							}),
							Effect.gen(function* () {
								return yield* Effect.all(
									[
										Effect.tryPromise({
											try: () =>
												runTask(
													parentScope.children.build,
													{},
												),
											catch: (error) => {
												return new TaskError({
													message: String(error),
												})
											},
										}),
										// runTaskEffect(
										// 	parentScope.children.build,
										// 	{},
										// ),
										Effect.tryPromise({
											try: () =>
												runTask(
													parentScope.children
														.bindings,
													{},
												),
											catch: (error) => {
												return new TaskError({
													message: String(error),
												})
											},
										}),
										// runTaskEffect(
										// 	parentScope.children.bindings,
										// 	{},
										// ),
									],
									{
										concurrency: "unbounded",
									},
								)
							}),
						],
						{
							concurrency: "unbounded",
						},
					)

					yield* Effect.logDebug("Now running install task")
					let taskResult
					if (mode === "upgrade") {
						// TODO: but if its the first time, unnecessary? how do we know to run it
						const { result } = yield* Effect.tryPromise({
							try: () =>
								runTask(parentScope.children.upgrade, {
									canisterId,
									wasm: wasmPath,
								}),
							catch: (error) => {
								return new TaskError({
									message: String(error),
								})
							},
						})
						taskResult = result
					} else {
						const { result } = yield* Effect.tryPromise({
							try: () =>
								runTask(parentScope.children.install, {
									mode,
									// TODO: currently does nothing. they are generated inside the installTask from the installArgsFn
									// do we run the installArgsFn here instead? separate the task again?
									// args: taskArgs.args,
									canisterId,
									wasm: wasmPath,
								}),
							catch: (error) => {
								return new TaskError({
									message: String(error),
								})
							},
						})
						taskResult = result
					}
					yield* Effect.logDebug("Canister deployed successfully")
					return taskResult
				})(),
			),
		description: "Deploy canister code",
		tags: [Tags.CANISTER, Tags.DEPLOY, Tags.CUSTOM],
	} satisfies DeployTask<_SERVICE>
}

export const makeBindingsTask = (
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape }) => Promise<CustomCanisterConfig>)
		| ((args: { ctx: TaskCtxShape }) => CustomCanisterConfig)
		| CustomCanisterConfig,
): BindingsTask => {
	return {
		_tag: "task",
		id: Symbol("customCanister/bindings"),
		dependsOn: {},
		dependencies: {},
		// TODO: do we allow a fn as args here?
		effect: (taskCtx) =>
			builderRuntime.runPromise(
				Effect.fn("task_effect")(function* () {
					const canisterConfig = yield* resolveConfig(
						taskCtx,
						canisterConfigOrFn,
					)
					const { taskPath } = taskCtx
					const canisterName = taskPath
						.split(":")
						.slice(0, -1)
						.join(":")
					const didPath = canisterConfig.candid
					yield* Effect.logDebug("Bindings task", canisterName, {
						didPath,
					})

					const { didJS, didJSPath, didTSPath } =
						yield* generateDIDJS(taskCtx, canisterName, didPath)
					yield* Effect.logDebug(
						`Generated DID JS for ${canisterName}`,
					)
					return {
						didJSPath,
						didTSPath,
					}
				})(),
			),
		computeCacheKey: (input) => {
			return hashJson({
				depsHash: hashJson(input.depCacheKeys),
				taskPath: input.taskPath,
				configHash: hashConfig(canisterConfigOrFn),
			})
		},
		input: (taskCtx) =>
			builderRuntime.runPromise(
				Effect.fn("task_input")(function* () {
					const { taskPath, depResults } = taskCtx
					const depCacheKeys = Record.map(
						depResults,
						(dep) => dep.cacheKey,
					)
					const input = {
						taskPath,
						depCacheKeys,
					}
					return input
				})(),
			),
		encode: (taskCtx, value) =>
			builderRuntime.runPromise(
				Effect.fn("task_encode")(function* () {
					return JSON.stringify(value)
				})(),
			),
		decode: (taskCtx, value) =>
			builderRuntime.runPromise(
				Effect.fn("task_decode")(function* () {
					return JSON.parse(value as string)
				})(),
			),
		encodingFormat: "string",
		description: "Generate bindings for custom canister",
		tags: [Tags.CANISTER, Tags.CUSTOM, Tags.BINDINGS],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies BindingsTask
}

// TODO: pass in wasm and candid as task params instead?
export const makeCustomBuildTask = <P extends Record<string, unknown>>(
	canisterConfigOrFn:
		| ((args: {
				ctx: TaskCtxShape
				deps: P
		  }) => Promise<CustomCanisterConfig>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => CustomCanisterConfig)
		| CustomCanisterConfig,
): BuildTask => {
	return {
		_tag: "task",
		id: Symbol("customCanister/build"),
		dependsOn: {},
		dependencies: {
			// no deps
		},
		effect: (taskCtx) =>
			builderRuntime.runPromise(
				Effect.fn("task_effect")(function* () {
					const fs = yield* FileSystem.FileSystem
					const path = yield* Path.Path
					// TODO: could be a promise
					const canisterConfig = yield* resolveConfig(
						taskCtx,
						canisterConfigOrFn,
					)
					const { taskPath, appDir, iceDir } = taskCtx
					// TODO: pass in as arg instead?
					const canisterName = taskPath
						.split(":")
						.slice(0, -1)
						.join(":")
					// TODO: look at the canisterConfig.wasm directly instead
					const isGzipped = canisterConfig.wasm.endsWith(".gz")
					// const isGzipped = yield* fs.exists(
					// 	path.join(
					// 		appDir,
					// 		iceDir,
					// 		"canisters",
					// 		canisterName,
					// 		`${canisterName}.wasm.gz`,
					// 	),
					// )
					const outWasmPath = path.join(
						appDir,
						iceDir,
						"canisters",
						canisterName,
						isGzipped
							? `${canisterName}.wasm.gz`
							: `${canisterName}.wasm`,
					)
					yield* Effect.logDebug(
						"Reading wasm file",
						canisterConfig.wasm,
					)
					const wasm = yield* fs.readFile(canisterConfig.wasm)
					// Ensure the directory exists
					yield* fs.makeDirectory(path.dirname(outWasmPath), {
						recursive: true,
					})
					yield* fs.writeFile(outWasmPath, wasm)

					const outCandidPath = path.join(
						appDir,
						iceDir,
						"canisters",
						canisterName,
						`${canisterName}.did`,
					)
					const candid = yield* fs.readFile(canisterConfig.candid)
					yield* fs.writeFile(outCandidPath, candid)
					yield* Effect.logDebug("Built custom canister", {
						wasmPath: outWasmPath,
						candidPath: outCandidPath,
					})
					return {
						wasmPath: outWasmPath,
						candidPath: outCandidPath,
					}
				})(),
			),
		computeCacheKey: (input) => {
			// TODO: pocket-ic could be restarted?
			const installInput = {
				wasmHash: input.wasm.sha256,
				candidHash: input.candid.sha256,
				depsHash: hashJson(input.depCacheKeys),
				configHash: hashConfig(canisterConfigOrFn),
			}
			const cacheKey = hashJson(installInput)
			return cacheKey
		},
		input: (taskCtx) =>
			builderRuntime.runPromise(
				Effect.fn("task_input")(function* () {
					const { taskPath, depResults } = taskCtx
					const canisterName = taskPath
						.split(":")
						.slice(0, -1)
						.join(":")
					const depCacheKeys = Record.map(
						depResults,
						(dep) => dep.cacheKey,
					)
					const path = yield* Path.Path
					const { appDir, iceDir } = taskCtx
					// TODO...? might be problematic if user does lots of async
					const canisterConfig = yield* resolveConfig(
						taskCtx,
						canisterConfigOrFn,
					)
					const wasmPath = canisterConfig.wasm
					const candidPath = canisterConfig.candid
					// TODO: we need a separate cache for this?
					const prevWasmDigest = undefined
					const { fresh, digest: wasmDigest } =
						yield* isArtifactCachedEffect(wasmPath, prevWasmDigest)
					// yield* Effect.tryPromise({
					// 	//
					// 	try: () => isArtifactCached(wasmPath, prevWasmDigest),
					// 	// TODO:
					// 	catch: Effect.fail,
					// })
					const prevCandidDigest = undefined
					const { fresh: candidFresh, digest: candidDigest } =
						yield* isArtifactCachedEffect(
							candidPath,
							prevCandidDigest,
						)
					// yield* Effect.tryPromise({
					// 	try: () => isArtifactCached(candidPath, prevCandidDigest),
					// 	catch: Effect.fail,
					// })
					const input = {
						canisterName,
						taskPath,
						wasm: wasmDigest,
						candid: candidDigest,
						depCacheKeys,
					}
					return input
				})(),
			),
		encode: (taskCtx, value) =>
			builderRuntime.runPromise(
				Effect.fn("task_encode")(function* () {
					return JSON.stringify(value)
				})(),
			),
		decode: (taskCtx, value) =>
			builderRuntime.runPromise(
				Effect.fn("task_decode")(function* () {
					return JSON.parse(value as string)
				})(),
			),
		encodingFormat: "string",
		description: "Build custom canister",
		tags: [Tags.CANISTER, Tags.CUSTOM, Tags.BUILD],
		namedParams: {},
		positionalParams: [],
		params: {},
	}
}

export class CustomCanisterBuilder<
	I,
	U,
	S extends CanisterScope<_SERVICE, I, U, D, P>,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	Config extends CustomCanisterConfig,
	_SERVICE = unknown,
> {
	#scope: S
	constructor(scope: S) {
		this.#scope = scope
	}

	create(
		canisterConfigOrFn:
			| Config
			| ((args: { ctx: TaskCtxShape; deps: P }) => Config)
			| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<Config>),
	): CustomCanisterBuilder<
		I,
		U,
		CanisterScope<_SERVICE, I, U, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				create: makeCreateTask<P>(canisterConfigOrFn, [Tags.CUSTOM]),
			},
		} satisfies CanisterScope<_SERVICE, I, U, D, P>
		return new CustomCanisterBuilder(updatedScope)
	}

	build(
		canisterConfigOrFn:
			| Config
			| ((args: { ctx: TaskCtxShape; deps: P }) => Config)
			| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<Config>),
	): CustomCanisterBuilder<
		I,
		U,
		CanisterScope<_SERVICE, I, U, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				build: makeCustomBuildTask<P>(canisterConfigOrFn),
			},
		} satisfies CanisterScope<_SERVICE, I, U, D, P>
		return new CustomCanisterBuilder(updatedScope)
	}

	installArgs(
		installArgsFn: (args: {
			ctx: TaskCtxShape
			deps: ExtractScopeSuccesses<D> & ExtractScopeSuccesses<P>
		}) => I | Promise<I>,
		{
			customEncode,
		}: {
			customEncode:
				| undefined
				| ((args: I) => Promise<Uint8Array<ArrayBufferLike>>)
		} = {
			customEncode: undefined,
		},
	): CustomCanisterBuilder<
		I,
		U,
		CanisterScope<_SERVICE, I, U, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		// TODO: passing in I makes the return type: any
		// TODO: we need to inject dependencies again! or they can be overwritten

		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				// TODO: add these to the task type
				install: {
					...makeInstallTask<I, D, P, _SERVICE>(installArgsFn, {
						customEncode,
					}),
					dependsOn: this.#scope.children.install.dependsOn,
					dependencies: this.#scope.children.install.dependencies,
				} as InstallTask<_SERVICE, I, D, P>,
				// reuse installTask as upgradeTask by default unless overridden by user
				// how will it affect caching? both get invalidated when argsFn has changed

				// TODO: check in make instead?
				upgrade: {
					// TODO: makeUpgradeTask
					...makeUpgradeTask<I, D, P, _SERVICE>(installArgsFn, {
						customEncode,
					}),
					// TODO: ...?
					dependsOn: this.#scope.children.install.dependsOn,
					dependencies: this.#scope.children.install.dependencies,
				} as UpgradeTask<_SERVICE, I, D, P>,
			},
		} satisfies CanisterScope<_SERVICE, I, I, D, P>

		return new CustomCanisterBuilder(updatedScope)
	}

	upgradeArgs(
		upgradeArgsFn: (args: {
			ctx: TaskCtxShape
			deps: ExtractScopeSuccesses<D> & ExtractScopeSuccesses<P>
		}) => U | Promise<U>,
		{
			customEncode,
		}: {
			customEncode:
				| undefined
				| ((args: U) => Promise<Uint8Array<ArrayBufferLike>>)
		} = {
			customEncode: undefined,
		},
	): CustomCanisterBuilder<
		I,
		U,
		CanisterScope<_SERVICE, I, U, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		// TODO: passing in I makes the return type: any
		// TODO: we need to inject dependencies again! or they can be overwritten

		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				upgrade: {
					...makeUpgradeTask<U, D, P, _SERVICE>(upgradeArgsFn, {
						customEncode,
					}),
					// TODO: ...?
					dependsOn: this.#scope.children.install.dependsOn,
					dependencies: this.#scope.children.install.dependencies,
				} as UpgradeTask<_SERVICE, U, D, P>,
			},
		} satisfies CanisterScope<_SERVICE, I, U, D, P>

		return new CustomCanisterBuilder(updatedScope)
	}

	deps<UP extends Record<string, AllowedDep>, NP extends NormalizeDeps<UP>>(
		dependencies: ValidProvidedDeps<D, UP>,
	): CustomCanisterBuilder<
		I,
		U,
		CanisterScope<_SERVICE, I, U, D, NP>,
		D,
		NP,
		Config,
		_SERVICE
	> {
		const updatedDependencies = normalizeDepsMap(dependencies) as NP
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				install: {
					...this.#scope.children.install,
					dependencies: updatedDependencies,
				} as InstallTask<_SERVICE, I, D, NP>,
				upgrade: {
					...this.#scope.children.upgrade,
					dependencies: updatedDependencies,
				} as UpgradeTask<_SERVICE, U, D, NP>,
			},
		} satisfies CanisterScope<_SERVICE, I, U, D, NP>
		return new CustomCanisterBuilder(updatedScope)
	}

	dependsOn<
		UD extends Record<string, AllowedDep>,
		ND extends NormalizeDeps<UD>,
	>(
		dependsOn: UD,
	): CustomCanisterBuilder<
		I,
		U,
		CanisterScope<_SERVICE, I, U, ND, P>,
		ND,
		P,
		Config,
		_SERVICE
	> {
		const updatedDependsOn = normalizeDepsMap(dependsOn) as ND
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				install: {
					...this.#scope.children.install,
					dependsOn: updatedDependsOn,
				} as InstallTask<_SERVICE, I, ND, P>,
				upgrade: {
					...this.#scope.children.upgrade,
					dependsOn: updatedDependsOn,
				} as UpgradeTask<_SERVICE, U, ND, P>,
			},
		} satisfies CanisterScope<_SERVICE, I, U, ND, P>
		return new CustomCanisterBuilder(updatedScope)
	}

	make(
		this: IsValid<S> extends true
			? CustomCanisterBuilder<I, U, S, D, P, Config, _SERVICE>
			: DependencyMismatchError<S>,
	): S {
		// Otherwise we get a type error
		const self = this as CustomCanisterBuilder<
			I,
			U,
			S,
			D,
			P,
			Config,
			_SERVICE
		>
		const linkedChildren = linkChildren(self.#scope.children)
		const finalScope = {
			...self.#scope,
			id: Symbol("scope"),
			children: linkedChildren,
		} satisfies CanisterScope<_SERVICE, I, U, D, P>
		return finalScope
		// const self = this as CustomCanisterBuilder<I, S, D, P, Config, _SERVICE>
		// return {
		// 	...self.#scope,
		// 	id: Symbol("scope"),
		// 	children: Record.map(self.#scope.children, (value) => ({
		// 		...value,
		// 		id: Symbol("task"),
		// 	})),
		// } satisfies CanisterScope<_SERVICE, I, D, P>
	}
}

// TODO: some kind of metadata?
// TODO: warn about context if not provided
export const customCanister = <_SERVICE = unknown, I = unknown, U = unknown>(
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape }) => Promise<CustomCanisterConfig>)
		| ((args: { ctx: TaskCtxShape }) => CustomCanisterConfig)
		| CustomCanisterConfig,
): CustomCanisterBuilder<
	I,
	U,
	CanisterScope<_SERVICE, I, U, {}, {}>,
	{},
	{},
	CustomCanisterConfig,
	_SERVICE
> => {
	const initialScope = {
		_tag: "scope",
		id: Symbol("scope"),
		tags: [Tags.CANISTER, Tags.CUSTOM],
		description: "Custom canister scope",
		defaultTask: "deploy",
		// TODO: default implementations
		children: {
			create: makeCreateTask(canisterConfigOrFn, [Tags.CUSTOM]),
			bindings: makeBindingsTask(canisterConfigOrFn),
			build: makeCustomBuildTask(canisterConfigOrFn),
			install: makeInstallTask<I, {}, {}, _SERVICE>(),
			upgrade: makeUpgradeTask<U, {}, {}, _SERVICE>(),
			stop: makeStopTask(),
			remove: makeRemoveTask(),
			deploy: makeCustomDeployTask<_SERVICE>(canisterConfigOrFn),
			status: makeCanisterStatusTask([Tags.CUSTOM]),
		},
	} satisfies CanisterScope<_SERVICE, I, U, {}, {}>

	return new CustomCanisterBuilder<
		I,
		U,
		CanisterScope<_SERVICE, I, U, {}, {}>,
		{},
		{},
		CustomCanisterConfig,
		_SERVICE
	>(initialScope)
}
