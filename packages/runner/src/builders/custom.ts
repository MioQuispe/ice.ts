import { Effect, Record } from "effect"
import type { Scope, Task, TaskTree } from "../types/types.js"
// import mo from "motoko"
import { FileSystem, Path } from "@effect/platform"
import { InstallModes } from "../services/replica.js"
import type {
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
} from "./lib.js"
import { getNodeByPath, ParamsToArgs } from "../tasks/lib.js"
import { runTask } from "../tasks/run.js"
import {
	AllowedDep,
	hashConfig,
	hashJson,
	isArtifactCachedEffect,
	linkChildren,
	makeCanisterStatusTask,
	makeCreateTask,
	makeInstallTask,
	installParams,
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

export const makeCustomDeployTask = <_SERVICE>(): DeployTask<_SERVICE> => {
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
		effect: Effect.gen(function* () {
			const { taskPath } = yield* TaskCtx
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			// TODO: include this in taskCtx instead? as { scope }
			const parentScope = (yield* getNodeByPath(
				canisterName,
			)) as CanisterScope<_SERVICE>
			const { args } = yield* TaskCtx
			const taskArgs = args as DeployTaskArgs
			// const mode = yield* resolveMode()
			const mode =
				taskArgs.mode === "auto" ? yield* resolveMode() : taskArgs.mode
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
						yield* Effect.logDebug("Now running create task")
						const { result: canisterId } = yield* runTask(
							parentScope.children.create,
						)
						yield* Effect.logDebug("Finished running create task")
						return canisterId
					}),
					Effect.gen(function* () {
						return yield* Effect.all(
							[
								runTask(parentScope.children.build),
								runTask(parentScope.children.bindings),
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
			const { result: installResult } = yield* runTask(
				parentScope.children.install,
				{
					mode,
					// TODO: currently does nothing. they are generated inside the installTask from the installArgsFn
					// do we run the installArgsFn here instead? separate the task again?
					// args: taskArgs.args,
					canisterId,
					wasm: wasmPath,
				},
			)
			yield* Effect.logDebug("Canister deployed successfully")
			return installResult
		}),
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
		effect: Effect.gen(function* () {
			const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
			const { taskPath } = yield* TaskCtx
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const didPath = canisterConfig.candid
			yield* Effect.logDebug("Bindings task", canisterName, { didPath })

			const { didJS, didJSPath, didTSPath } = yield* generateDIDJS(
				canisterName,
				didPath,
			)
			yield* Effect.logDebug(`Generated DID JS for ${canisterName}`)
			return {
				didJSPath,
				didTSPath,
			}
		}),
		computeCacheKey: (input) => {
			return hashJson({
				depsHash: hashJson(input.depCacheKeys),
				taskPath: input.taskPath,
				configHash: hashConfig(canisterConfigOrFn),
			})
		},
		input: () =>
			Effect.gen(function* () {
				const { taskPath, depResults } = yield* TaskCtx
				const depCacheKeys = Record.map(
					depResults,
					(dep) => dep.cacheKey,
				)
				const input = {
					taskPath,
					depCacheKeys,
				}
				return input
			}),
		encode: (value) => Effect.succeed(JSON.stringify(value)),
		decode: (value) => Effect.succeed(JSON.parse(value as string)),
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
		effect: Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem
			const path = yield* Path.Path
			// TODO: could be a promise
			const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
			const { taskPath, appDir, iceDir } = yield* TaskCtx
			// TODO: pass in as arg instead?
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
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
				isGzipped ? `${canisterName}.wasm.gz` : `${canisterName}.wasm`,
			)
			yield* Effect.logDebug("Reading wasm file", canisterConfig.wasm)
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
		}),
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
		input: () =>
			Effect.gen(function* () {
				const { taskPath, depResults } = yield* TaskCtx
				const canisterName = taskPath.split(":").slice(0, -1).join(":")
				const depCacheKeys = Record.map(
					depResults,
					(dep) => dep.cacheKey,
				)
				const path = yield* Path.Path
				const { appDir, iceDir } = yield* TaskCtx
				// TODO...? might be problematic if user does lots of async
				const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
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
					yield* isArtifactCachedEffect(candidPath, prevCandidDigest)
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
			}),
		encode: (value) => Effect.succeed(JSON.stringify(value)),
		decode: (value) => Effect.succeed(JSON.parse(value as string)),
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
			mode: InstallModes
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
			},
		} satisfies CanisterScope<_SERVICE, I, U, D, P>

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
				// TODO: add these to the task type
				upgrade: {
					// TODO: makeUpgradeTask
					...makeUpgradeTask<U, D, P, _SERVICE>(upgradeArgsFn, {
						customEncode,
					}),
					// TODO: ...?
					dependsOn: this.#scope.children.install.dependsOn,
					dependencies: this.#scope.children.install.dependencies,
				} as InstallTask<_SERVICE, U, D, P>,
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
				} as InstallTask<_SERVICE, U, D, NP>,
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
				} as InstallTask<_SERVICE, U, ND, P>,
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
export const customCanister = <
	_SERVICE = unknown,
	I = unknown[],
	U = unknown[],
>(
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
			deploy: makeCustomDeployTask<_SERVICE>(),
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

// TODO: Do more here?
const scope = <T extends TaskTree>(description: string, children: T) => {
	return {
		_tag: "scope",
		id: Symbol("scope"),
		tags: [],
		description,
		children,
	} satisfies Scope
}

const testTask = {
	_tag: "task",
	id: Symbol("test"),
	dependsOn: {},
	dependencies: {},
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const testTask2 = {
	_tag: "task",
	id: Symbol("test"),
	dependsOn: {},
	dependencies: {},
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const providedTask = {
	_tag: "task",
	id: Symbol("test"),
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	dependsOn: {
		test: testTask,
	},
	dependencies: {
		test: testTask,
	},
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const unProvidedTask = {
	_tag: "task",
	id: Symbol("test"),
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	dependsOn: {
		test: testTask,
		test2: testTask,
	},
	dependencies: {
		test: testTask,
		// TODO: does not raise a warning?
		// test2: testTask2,
		// test2: testTask,
		// test3: testTask,
	},
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const unProvidedTask2 = {
	_tag: "task",
	id: Symbol("test"),
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	dependsOn: {
		test: testTask,
		// test2: testTask,
	},
	dependencies: {
		// test: testTask,
		// TODO: does not raise a warning?
		// test2: testTask2,
		// test2: testTask,
		// test3: testTask,
	},
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const testScope = {
	_tag: "scope",
	id: Symbol("scope"),
	tags: [Tags.CANISTER],
	description: "",
	children: {
		providedTask,
		unProvidedTask,
	},
}

const testScope2 = {
	_tag: "scope",
	id: Symbol("scope"),
	tags: [Tags.CANISTER],
	description: "",
	children: {
		unProvidedTask2,
	},
}

const providedTestScope = {
	_tag: "scope",
	id: Symbol("scope"),
	tags: [Tags.CANISTER],
	description: "",
	children: {
		providedTask,
	},
}

// Type checks
// const pt = providedTask satisfies DepBuilder<typeof providedTask>
// const upt = unProvidedTask satisfies DepBuilder<typeof unProvidedTask>
// const uts = testScope satisfies UniformScopeCheck<typeof testScope>
// const pts = providedTestScope satisfies UniformScopeCheck<
//   typeof providedTestScope
// >
// const uts2 = testScope2 satisfies UniformScopeCheck<typeof testScope2>

const test = customCanister(async () => ({
	wasm: "",
	candid: "",
}))

// // // test._scope.children.install.computeCacheKey = (task) => {
// // //   return task.id.toString()
// // // }

const t = test
	.dependsOn({
		asd: test.make().children.install,
	})
	.deps({
		asd: test.make().children.install,
		// TODO: extras also cause errors? should it be allowed?
		// asd2: test._scope.children.install,
	})
	// ._scope.children
	.installArgs(async ({ ctx, mode, deps }) => {
		// TODO: allow chaining builders with ice.customCanister()
		// to pass in context?
		// ctx.users.default
		// TODO: type the actors
		// ctx.dependencies.asd.actor
		deps.asd.actor
		return []
	})
	.make()
// t.children.install.computeCacheKey
// // t.children.install.dependencies
