import { Effect, Record } from "effect"
import type { CachedTask, Task } from "../types/types.js"
// import mo from "motoko"
import { FileSystem, Path } from "@effect/platform"
// TODO: move to ./lib.ts
import { compileMotokoCanister, generateDIDJS } from "../canister.js"
import { ParamsToArgs } from "../tasks/lib.js"
import { InstallModes } from "../services/replica.js"
import {
	AllowedDep,
	CreateTask,
	DependencyMismatchError,
	ExtractScopeSuccesses,
	FileDigest,
	InstallTask,
	IsValid,
	NormalizeDeps,
	RemoveTask,
	StatusTask,
	StopTask,
	UpgradeTask,
	ValidProvidedDeps,
	builderRuntime,
} from "./lib.js"
import { type TaskCtxShape } from "../services/taskCtx.js"
import { getNodeByPath } from "../tasks/lib.js"
import {
	hashJson,
	isArtifactCached,
	linkChildren,
	makeCanisterStatusTask,
	makeCreateTask,
	makeInstallTask,
	makeRemoveTask,
	makeStopTask,
	normalizeDepsMap,
	resolveConfig,
	Tags,
	resolveMode,
	TaskError,
	makeUpgradeTask,
} from "./lib.js"
import { type } from "arktype"
import { deployParams } from "./custom.js"
import { ActorSubclass } from "../types/actor.js"

export type MotokoCanisterConfig = {
	src: string
	canisterId?: string
}

export type MotokoCanisterScope<
	_SERVICE = any,
	I = any,
	U = any,
	D extends Record<string, Task> = Record<string, Task>,
	P extends Record<string, Task> = Record<string, Task>,
> = {
	_tag: "scope"
	id: symbol
	tags: Array<string | symbol>
	description: string
	defaultTask: "deploy"
	// only limited to tasks
	// children: Record<string, Task>
	children: {
		// create: Task<string>
		create: CreateTask
		bindings: MotokoBindingsTask
		build: MotokoBuildTask
		install: InstallTask<_SERVICE, I, D, P>
		upgrade: UpgradeTask<_SERVICE, U, D, P>
		// D,
		// P
		stop: StopTask
		remove: RemoveTask
		// TODO: same as install?
		deploy: MotokoDeployTask<_SERVICE>
		status: StatusTask
	}
}

export const motokoDeployParams = deployParams
// export const motokoDeployParams = {
// 	mode: {
// 		type: InstallModes,
// 		description: "The mode to install the canister in",
// 		default: "install",
// 		isFlag: true as const,
// 		isOptional: true as const,
// 		isVariadic: false as const,
// 		name: "mode",
// 		aliases: ["m"],
// 		parse: (value: string) => value as InstallModes,
// 	},
// 	args: {
// 		// TODO: maybe not Uint8Array?
// 		type: type("TypedArray.Uint8"),
// 		description: "The arguments to pass to the canister as a candid string",
// 		// default: undefined,
// 		isFlag: true as const,
// 		isOptional: true as const,
// 		isVariadic: false as const,
// 		name: "args",
// 		aliases: ["a"],
// 		parse: (value: string) => {
// 			// TODO: convert to candid string
// 			return new Uint8Array(Buffer.from(value))
// 		},
// 	},
// 	// TODO: provide defaults. just read from fs by canister name
// 	// should we allow passing in wasm bytes?
// 	wasm: {
// 		type: type("string"),
// 		description: "The path to the wasm file",
// 		isFlag: true as const,
// 		isOptional: true as const,
// 		isVariadic: false as const,
// 		name: "wasm",
// 		aliases: ["w"],
// 		parse: (value: string) => value as string,
// 	},
// 	// TODO: provide defaults
// 	candid: {
// 		// TODO: should be encoded?
// 		type: type("string"),
// 		description: "The path to the candid file",
// 		isFlag: true as const,
// 		isOptional: true as const,
// 		isVariadic: false as const,
// 		name: "candid",
// 		aliases: ["c"],
// 		parse: (value: string) => value as string,
// 	},
// 	// TODO: provide defaults
// 	canisterId: {
// 		type: type("string"),
// 		description: "The canister ID to install the canister in",
// 		isFlag: true as const,
// 		isOptional: true as const,
// 		isVariadic: false as const,
// 		name: "canisterId",
// 		aliases: ["i"],
// 		parse: (value: string) => value as string,
// 	},
// }

export type MotokoDeployTask<
	_SERVICE = unknown,
	D extends Record<string, Task> = {},
	P extends Record<string, Task> = {},
> = Omit<
	Task<
		{
			canisterId: string
			canisterName: string
			actor: ActorSubclass<_SERVICE>
			mode: InstallModes
		},
		D,
		P
	>,
	"params"
> & {
	params: typeof motokoDeployParams
}

export type MotokoDeployTaskArgs = ParamsToArgs<typeof motokoDeployParams>

export const makeMotokoDeployTask = <
	_SERVICE,
	P extends Record<string, unknown>,
>(
	canisterConfigOrFn:
		| ((args: {
				ctx: TaskCtxShape
				deps: P
		  }) => Promise<MotokoCanisterConfig>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => MotokoCanisterConfig)
		| MotokoCanisterConfig,
): MotokoDeployTask<_SERVICE> => {
	return {
		_tag: "task",
		// TODO: change
		id: Symbol("canister/deploy"),
		dependsOn: {},
		// TODO: we only want to warn at a type level?
		// TODO: type Task
		dependencies: {},
		namedParams: motokoDeployParams,
		params: motokoDeployParams,
		positionalParams: [],
		effect: (taskCtx) =>
			builderRuntime.runPromise(
				Effect.fn("task_effect")(function* () {
					const { taskPath } = taskCtx
					const canisterName = taskPath
						.split(":")
						.slice(0, -1)
						.join(":")
					const parentScope = (yield* getNodeByPath(
						taskCtx,
						canisterName,
					)) as MotokoCanisterScope<_SERVICE>
					const { args, runTask } = taskCtx
					const taskArgs = args as MotokoDeployTaskArgs
					const canisterConfig = yield* resolveConfig(
						taskCtx,
						canisterConfigOrFn,
					)
					const mode =
						taskArgs.mode === "auto"
							? yield* resolveMode(
									taskCtx,
									canisterConfig?.canisterId,
								)
							: taskArgs.mode
					const [canisterId, { wasmPath, candidPath }] =
						yield* Effect.all(
							[
								Effect.gen(function* () {
									const taskPath = `${canisterName}:create`
									yield* Effect.logDebug(
										"Now running create task",
									)
									const canisterId =
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
									// Moc generates candid and wasm files in the same phase
									yield* Effect.logDebug(
										"Now running build task",
									)
									const {
										wasmPath,
										candidPath,
									} = yield* Effect.tryPromise({
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
									})
									yield* Effect.logDebug(
										"Now running bindings task",
									)
									const {
										didJSPath,
										didTSPath,
									} = yield* Effect.tryPromise({
										try: () =>
											runTask(
												parentScope.children.bindings,
												{},
											),
										catch: (error) => {
											return new TaskError({
												message: String(error),
											})
										},
									})
                                    // TODO:!!!!!
									return {
										wasmPath,
										candidPath,
										didJSPath,
										didTSPath,
									}
								}),
							],
							{
								concurrency: "unbounded",
							},
						)

					yield* Effect.logDebug("Now running install task")
					// TODO: no type error if params not provided at all
					let taskResult
					if (mode === "upgrade") {
						const result = yield* Effect.tryPromise({
							try: () =>
								runTask(parentScope.children.upgrade, {
									canisterId,
									candid: candidPath,
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
						const result = yield* Effect.tryPromise({
							try: () =>
								runTask(parentScope.children.install, {
									mode,
									// TODO: currently does nothing. they are generated inside the installTask from the installArgsFn
									// args: taskArgs.args,
									canisterId,
									candid: candidPath,
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
		tags: [Tags.CANISTER, Tags.DEPLOY, Tags.MOTOKO],
	}
}

export type MotokoBindingsTask = CachedTask<
	{
		didJSPath: string
		didTSPath: string
	},
	{},
	{},
	{
		taskPath: string
		depCacheKeys: Record<string, string | undefined>
	}
>

const motokoBindingsParams = {
	// TODO:
	wasm: {
		type: "string",
		description: "Path to the wasm file",
	},
	candid: {
		type: "string",
		description: "Path to the candid file",
	},
}
export const makeMotokoBindingsTask = (): MotokoBindingsTask => {
	return {
		_tag: "task",
		id: Symbol("motokoCanister/bindings"),
		dependsOn: {},
		dependencies: {},
		namedParams: {},
		positionalParams: [],
		params: {},
		// TODO: do we allow a fn as args here?
		effect: (taskCtx) =>
			builderRuntime.runPromise(
				Effect.fn("task_effect")(function* () {
					const path = yield* Path.Path
					const fs = yield* FileSystem.FileSystem
					const { taskPath, appDir, iceDir } = taskCtx
					const canisterName = taskPath
						.split(":")
						.slice(0, -1)
						.join(":")

					const isGzipped = yield* fs.exists(
						path.join(
							appDir,
							iceDir,
							"canisters",
							canisterName,
							`${canisterName}.wasm.gz`,
						),
					)
					const wasmPath = path.join(
						appDir,
						iceDir,
						"canisters",
						canisterName,
						isGzipped
							? `${canisterName}.wasm.gz`
							: `${canisterName}.wasm`,
					)
					const didPath = path.join(
						appDir,
						iceDir,
						"canisters",
						canisterName,
						`${canisterName}.did`,
					)
					// TODO: convert to task params instead. the above can be the defaults
					// const wasmPath = taskArgs.wasm
					// const candidPath = taskArgs.candid

					yield* Effect.logDebug("Artifact paths", {
						wasmPath,
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
		description: "Generate bindings for Motoko canister",
		tags: [Tags.CANISTER, Tags.MOTOKO, Tags.BINDINGS],
	}
}

export type MotokoBuildTask = CachedTask<
	{
		wasmPath: string
		candidPath: string
	},
	{},
	{},
	{
		taskPath: string
		src: Array<FileDigest>
		depCacheKeys: Record<string, string | undefined>
	}
>

const makeMotokoBuildTask = <P extends Record<string, unknown>>(
	canisterConfigOrFn:
		| ((args: {
				ctx: TaskCtxShape
				deps: P
		  }) => Promise<MotokoCanisterConfig>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => MotokoCanisterConfig)
		| MotokoCanisterConfig,
): MotokoBuildTask => {
	return {
		_tag: "task",
		id: Symbol("motokoCanister/build"),
		dependsOn: {},
		dependencies: {},
		effect: (taskCtx) =>
			builderRuntime.runPromise(
				Effect.fn("task_effect")(function* () {
					yield* Effect.logDebug("Building Motoko canister")
					const path = yield* Path.Path
					const fs = yield* FileSystem.FileSystem
					const { appDir, iceDir, taskPath } = taskCtx
					const canisterConfig =
						yield* resolveConfig(taskCtx, canisterConfigOrFn)
					const canisterName = taskPath
						.split(":")
						.slice(0, -1)
						.join(":")
					const isGzipped = yield* fs.exists(
						path.join(
							appDir,
							iceDir,
							"canisters",
							canisterName,
							`${canisterName}.wasm.gz`,
						),
					)
					const wasmOutputFilePath = path.join(
						appDir,
						iceDir,
						"canisters",
						canisterName,
						isGzipped
							? `${canisterName}.wasm.gz`
							: `${canisterName}.wasm`,
					)
					const outCandidPath = path.join(
						appDir,
						iceDir,
						"canisters",
						canisterName,
						`${canisterName}.did`,
					)
					// Ensure the directory exists
					yield* fs.makeDirectory(path.dirname(wasmOutputFilePath), {
						recursive: true,
					})
					yield* Effect.logDebug("Compiling Motoko canister")
					yield* compileMotokoCanister(
						path.resolve(appDir, canisterConfig.src),
						canisterName,
						wasmOutputFilePath,
					)
					yield* Effect.logDebug(
						"Motoko canister built successfully",
						{
							wasmPath: wasmOutputFilePath,
							candidPath: outCandidPath,
						},
					)
					return {
						wasmPath: wasmOutputFilePath,
						candidPath: outCandidPath,
					}
				})(),
			),
		computeCacheKey: (input) => {
			// TODO: pocket-ic could be restarted?
			const installInput = {
				taskPath: input.taskPath,
				depsHash: hashJson(input.depCacheKeys),
				// TODO: should we hash all fields though?
				srcHash: hashJson(input.src.map((s) => s.sha256)),
			}
			const cacheKey = hashJson(installInput)
			return cacheKey
		},
		input: (taskCtx) =>
			builderRuntime.runPromise(
				Effect.fn("task_input")(function* () {
					const { taskPath, depResults } = taskCtx
					const dependencies = depResults
					const depCacheKeys = Record.map(
						dependencies,
						(dep) => dep.cacheKey,
					)
					const canisterConfig =
						yield* resolveConfig(taskCtx, canisterConfigOrFn)
					const path = yield* Path.Path
					const fs = yield* FileSystem.FileSystem
					const srcDir = path.dirname(canisterConfig.src)
					const entries = yield* fs.readDirectory(srcDir, {
						recursive: true,
					})
					const srcFiles = entries.filter((entry) =>
						entry.endsWith(".mo"),
					)
					const prevSrcDigests: Array<FileDigest> = []
					const srcDigests: Array<FileDigest> = []
					for (const [index, file] of srcFiles.entries()) {
						const prevSrcDigest = prevSrcDigests?.[index]
						const filePath = path.join(srcDir, file)
						const { fresh: srcFresh, digest: srcDigest } =
							yield* Effect.tryPromise({
								try: () =>
									isArtifactCached(filePath, prevSrcDigest),
								catch: (e) =>
									new TaskError({
										message:
											"Failed to check if artifact is cached",
									}),
							})
						srcDigests.push(srcDigest)
					}
					const input = {
						taskPath,
						src: srcDigests,
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
		description: "Build Motoko canister",
		tags: [Tags.CANISTER, Tags.MOTOKO, Tags.BUILD],
		namedParams: {},
		positionalParams: [],
		params: {},
	}
}

export class MotokoCanisterBuilder<
	I extends unknown[],
	U extends unknown[],
	S extends MotokoCanisterScope<_SERVICE, I, U, D, P>,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	Config extends MotokoCanisterConfig,
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
	): MotokoCanisterBuilder<
		I,
		U,
		MotokoCanisterScope<_SERVICE, I, U, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				create: makeCreateTask<P>(canisterConfigOrFn, [Tags.MOTOKO]),
			},
		} satisfies MotokoCanisterScope<_SERVICE, I, U, D, P>
		return new MotokoCanisterBuilder(updatedScope)
	}

	build(
		canisterConfigOrFn:
			| Config
			| ((args: { ctx: TaskCtxShape; deps: P }) => Config)
			| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<Config>),
	): MotokoCanisterBuilder<
		I,
		U,
		MotokoCanisterScope<_SERVICE, I, U, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				build: makeMotokoBuildTask<P>(canisterConfigOrFn),
			},
		} satisfies MotokoCanisterScope<_SERVICE, I, U, D, P>
		return new MotokoCanisterBuilder(updatedScope)
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
	): MotokoCanisterBuilder<
		I,
		I,
		MotokoCanisterScope<_SERVICE, I, I, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		// TODO: is this a flag, arg, or what?
		const mode = "install"
		// TODO: passing in I makes the return type: any
		// TODO: we need to inject dependencies again! or they can be overwritten
		const dependsOn = this.#scope.children.install.dependsOn
		const dependencies = this.#scope.children.install.dependencies
		const installTask = {
			...makeInstallTask<
				I,
				// TODO: add bindings and create to the type?
				D,
				P,
				_SERVICE
			>(installArgsFn, { customEncode }),
			dependsOn,
			dependencies: {
				...dependencies,
				bindings: this.#scope.children.bindings,
				create: this.#scope.children.create,
			},
		}
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				install: installTask,

				// TODO: check in make instead?
				upgrade: {
					...makeUpgradeTask<I, D, P, _SERVICE>(installArgsFn, {
						customEncode,
					}),
					// TODO: ...?
					dependsOn: this.#scope.children.install.dependsOn,
					dependencies: this.#scope.children.install.dependencies,
				} as UpgradeTask<_SERVICE, I, D, P>,
			},
		} satisfies MotokoCanisterScope<_SERVICE, I, I, D, P>

		return new MotokoCanisterBuilder(updatedScope)
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
	): MotokoCanisterBuilder<
		I,
		U,
		MotokoCanisterScope<_SERVICE, I, U, D, P>,
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
				upgrade: {
					// TODO: makeUpgradeTask
					...makeUpgradeTask<U, D, P, _SERVICE>(upgradeArgsFn, {
						customEncode,
					}),
					// TODO: ...?
					dependsOn: this.#scope.children.install.dependsOn,
					dependencies: this.#scope.children.install.dependencies,
				} as UpgradeTask<_SERVICE, U, D, P>,
			},
		} satisfies MotokoCanisterScope<_SERVICE, I, U, D, P>

		return new MotokoCanisterBuilder(updatedScope)
	}

	deps<UP extends Record<string, AllowedDep>, NP extends NormalizeDeps<UP>>(
		providedDeps: ValidProvidedDeps<D, UP>,
	): MotokoCanisterBuilder<
		I,
		U,
		MotokoCanisterScope<_SERVICE, I, U, D, NP>,
		D,
		NP,
		Config,
		_SERVICE
	> {
		const finalDeps = normalizeDepsMap(providedDeps) as NP

		const installTask = {
			...this.#scope.children.install,
			dependencies: finalDeps,
		} as InstallTask<_SERVICE, I, D, NP>
		const upgradeTask = {
			...this.#scope.children.upgrade,
			dependencies: finalDeps,
		} as UpgradeTask<_SERVICE, U, D, NP>

		const updatedChildren = {
			...this.#scope.children,
			install: installTask,
			upgrade: upgradeTask,
		}

		const updatedScope = {
			...this.#scope,
			children: updatedChildren,
		} satisfies MotokoCanisterScope<_SERVICE, I, U, D, NP>
		return new MotokoCanisterBuilder(updatedScope)
	}

	dependsOn<
		UD extends Record<string, AllowedDep>,
		ND extends NormalizeDeps<UD>,
	>(
		dependencies: UD,
	): MotokoCanisterBuilder<
		I,
		U,
		MotokoCanisterScope<_SERVICE, I, U, ND, P>,
		ND,
		P,
		Config,
		_SERVICE
	> {
		const updatedDependsOn = normalizeDepsMap(dependencies) as ND
		const installTask = {
			...this.#scope.children.install,
			dependsOn: updatedDependsOn,
		} as InstallTask<_SERVICE, I, ND, P>
		const upgradeTask = {
			...this.#scope.children.upgrade,
			dependsOn: updatedDependsOn,
		} as UpgradeTask<_SERVICE, U, ND, P>
		const updatedChildren = {
			...this.#scope.children,
			install: installTask,
			upgrade: upgradeTask,
		}

		const updatedScope = {
			...this.#scope,
			children: updatedChildren,
		} satisfies MotokoCanisterScope<_SERVICE, I, U, ND, P>
		return new MotokoCanisterBuilder(updatedScope)
	}

	make(
		this: IsValid<S> extends true
			? MotokoCanisterBuilder<I, U, S, D, P, Config, _SERVICE>
			: DependencyMismatchError<S>,
	): S {
		// // Otherwise we get a type error
		const self = this as MotokoCanisterBuilder<
			I,
			U,
			S,
			D,
			P,
			Config,
			_SERVICE
		>

		// TODO: can we do this in a type-safe way?
		// so we get warnings about stale dependencies?
		const linkedChildren = linkChildren(self.#scope.children)

		const finalScope = {
			...self.#scope,
			id: Symbol("scope"),
			children: linkedChildren,
		} satisfies MotokoCanisterScope<_SERVICE, I, U, D, P>
		return finalScope
	}
}

export const motokoCanister = <
	_SERVICE = unknown,
	I extends unknown[] = unknown[],
	U extends unknown[] = unknown[],
	P extends Record<string, unknown> = Record<string, unknown>,
>(
	canisterConfigOrFn:
		| MotokoCanisterConfig
		| ((args: { ctx: TaskCtxShape; deps: P }) => MotokoCanisterConfig)
		| ((args: {
				ctx: TaskCtxShape
				deps: P
		  }) => Promise<MotokoCanisterConfig>),
) => {
	const initialScope = {
		_tag: "scope",
		id: Symbol("scope"),
		tags: [Tags.CANISTER, Tags.MOTOKO],
		description: "Motoko canister scope",
		defaultTask: "deploy",
		children: {
			create: makeCreateTask(canisterConfigOrFn, [Tags.MOTOKO]),
			build: makeMotokoBuildTask(canisterConfigOrFn),
			bindings: makeMotokoBindingsTask(),
			stop: makeStopTask(),
			remove: makeRemoveTask(),
			install: makeInstallTask<I, {}, {}, _SERVICE>(),
			upgrade: makeUpgradeTask<U, {}, {}, _SERVICE>(),
			deploy: makeMotokoDeployTask<_SERVICE, P>(canisterConfigOrFn),
			status: makeCanisterStatusTask([Tags.MOTOKO]),
		},
	} satisfies MotokoCanisterScope<_SERVICE, I, U, {}, {}>

	return new MotokoCanisterBuilder<
		I,
		U,
		MotokoCanisterScope<_SERVICE, I, U, {}, {}>,
		{},
		{},
		MotokoCanisterConfig,
		_SERVICE
	>(initialScope)
}
