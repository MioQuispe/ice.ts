import { Effect, Record } from "effect"
import type { CachedTask, Task } from "../types/types.js"
// import mo from "motoko"
import { FileSystem, Path } from "@effect/platform"
// TODO: move to ./lib.ts
import { compileMotokoCanister, generateDIDJS } from "../canister.js"
import { TaskCtx } from "../tasks/lib.js"
import type {
	AllowedDep,
	CreateTask,
	DependencyMismatchError,
	DeployTask,
	ExtractTaskEffectSuccess,
	FileDigest,
	InstallArgsTask,
	InstallTask,
	IsValid,
	NormalizeDeps,
	RemoveTask,
	StatusTask,
	StopTask,
	TaskCtxShape,
	TaskReturnValue,
	ValidProvidedDeps
} from "./lib.js"
import {
	hashJson,
	isArtifactCached,
	linkChildren,
	makeCanisterStatusTask,
	makeCreateTask,
	makeDeployTask,
	makeInstallArgsTask,
	makeInstallTask,
	makeRemoveTask,
	makeStopTask,
	normalizeDepsMap,
	resolveConfig,
	Tags
} from "./lib.js"

type MotokoCanisterConfig = {
	src: string
	canisterId?: string
}


export type MotokoCanisterScope<
	_SERVICE = any,
	I = any,
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
		install_args: InstallArgsTask<I, D, P>
		// install_args: ReturnType<typeof makeInstallArgsTask>
		install: InstallTask<_SERVICE, D, P>
		// D,
		// P
		stop: StopTask
		remove: RemoveTask
		// TODO: same as install?
		deploy: DeployTask<_SERVICE>
		status: StatusTask
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
export const makeMotokoBindingsTask = (deps: {
	build: MotokoBuildTask
}): MotokoBindingsTask => {
	return {
		_tag: "task",
		id: Symbol("motokoCanister/bindings"),
		dependsOn: {},
		dependencies: deps,
		// TODO: do we allow a fn as args here?
		effect: Effect.gen(function* () {
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const { taskPath, depResults } = yield* TaskCtx
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const dependencies = depResults as {
				[K in keyof typeof deps]: {
					result: TaskReturnValue<typeof deps[K]>
					cacheKey: string | undefined
				}
			}
			const { result: buildResult } = dependencies.build
			const { wasmPath, candidPath } = buildResult

			yield* Effect.logDebug("Artifact paths", { wasmPath, candidPath })

			const { didJS, didJSPath, didTSPath } = yield* generateDIDJS(
				canisterName,
				candidPath,
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
			})
		},
		input: () =>
			Effect.gen(function* () {
				const { taskPath, depResults } = yield* TaskCtx
				const dependencies = depResults as {
					[K in keyof typeof deps]: {
						result: TaskReturnValue<typeof deps[K]>
						cacheKey: string | undefined
					}
				}
				const depCacheKeys = Record.map(dependencies, (dep) => dep.cacheKey)
				const input = {
					taskPath,
					depCacheKeys,
				}
				return input
			}),
		encode: (value) => Effect.succeed(JSON.stringify(value)),
		decode: (value) => Effect.succeed(JSON.parse(value as string)),
		encodingFormat: "string",
		description: "Generate bindings for Motoko canister",
		tags: [Tags.CANISTER, Tags.MOTOKO, Tags.BINDINGS],
		namedParams: {},
		positionalParams: [],
		params: {},
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
		| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<MotokoCanisterConfig>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => MotokoCanisterConfig)
		| MotokoCanisterConfig,
): MotokoBuildTask => {
	return {
		_tag: "task",
		id: Symbol("motokoCanister/build"),
		dependsOn: {},
		dependencies: {},
		effect: Effect.gen(function* () {
			yield* Effect.logDebug("Building Motoko canister")
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const { appDir, iceDir, taskPath } = yield* TaskCtx
			const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
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
				isGzipped ? `${canisterName}.wasm.gz` : `${canisterName}.wasm`,
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
			yield* Effect.logDebug("Motoko canister built successfully", {
				wasmPath: wasmOutputFilePath,
				candidPath: outCandidPath,
			})
			return {
				wasmPath: wasmOutputFilePath,
				candidPath: outCandidPath,
			}
		}),
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
		input: () =>
			Effect.gen(function* () {
				const { taskPath, depResults } = yield* TaskCtx
				const dependencies = depResults
				const depCacheKeys = Record.map(dependencies, (dep) => dep.cacheKey)
				const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
				const path = yield* Path.Path
				const fs = yield* FileSystem.FileSystem
				const srcDir = path.dirname(canisterConfig.src)
				const entries = yield* fs.readDirectory(srcDir, {
					recursive: true,
				})
				const srcFiles = entries.filter((entry) => entry.endsWith(".mo"))
				const prevSrcDigests: Array<FileDigest> = []
				const srcDigests: Array<FileDigest> = []
				for (const [index, file] of srcFiles.entries()) {
					const prevSrcDigest = prevSrcDigests?.[index]
					const filePath = path.join(srcDir, file)
					const { fresh: srcFresh, digest: srcDigest } =
						yield* Effect.tryPromise({
							try: () => isArtifactCached(filePath, prevSrcDigest),
							catch: Effect.fail,
						})
					srcDigests.push(srcDigest)
				}
				const input = {
					taskPath,
					src: srcDigests,
					depCacheKeys,
				}
				return input
			}),
		encode: (value) => Effect.succeed(JSON.stringify(value)),
		decode: (value) => Effect.succeed(JSON.parse(value as string)),
		encodingFormat: "string",
		description: "Build Motoko canister",
		tags: [Tags.CANISTER, Tags.MOTOKO, Tags.BUILD],
		namedParams: {},
		positionalParams: [],
		params: {},
	}
}

class MotokoCanisterBuilder<
	I extends unknown[],
	S extends MotokoCanisterScope<_SERVICE, I, D, P>,
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
		MotokoCanisterScope<_SERVICE, I, D, P>,
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
		} satisfies MotokoCanisterScope<_SERVICE, I, D, P>
		return new MotokoCanisterBuilder(updatedScope)
	}

	build(
		canisterConfigOrFn:
			| Config
			| ((args: { ctx: TaskCtxShape; deps: P }) => Config)
			| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<Config>),
	): MotokoCanisterBuilder<
		I,
		MotokoCanisterScope<_SERVICE, I, D, P>,
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
		} satisfies MotokoCanisterScope<_SERVICE, I, D, P>
		return new MotokoCanisterBuilder(updatedScope)
	}

	installArgs(
		installArgsFn: (args: {
			ctx: TaskCtxShape
			deps: ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
			mode: string
		}) => I | Promise<I>,
		{
			customEncode,
		}: {
			customEncode:
				| undefined
				| ((args: I) => Effect.Effect<Uint8Array<ArrayBufferLike>>)
		} = {
			customEncode: undefined,
		},
	): MotokoCanisterBuilder<
		I,
		MotokoCanisterScope<_SERVICE, I, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		// TODO: is this a flag, arg, or what?
		const mode = "install"
		// TODO: passing in I makes the return type: any
		// TODO: we need to inject dependencies again! or they can be overwritten
		const dependsOn = this.#scope.children.install_args.dependsOn
		const dependencies = this.#scope.children.install_args.dependencies
		const installArgsTask = {
			...makeInstallArgsTask<
				I,
				_SERVICE,
				// TODO: add bindings and create to the type?
				D,
				P
			>(
				installArgsFn,
				dependsOn,
				{
					...dependencies,
					bindings: this.#scope.children.bindings,
					create: this.#scope.children.create,
				},
				{ customEncode },
			),
			// dependsOn,
			// dependencies,
		}
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				install_args: installArgsTask,
			},
		} satisfies MotokoCanisterScope<_SERVICE, I, D, P>
		// TODO: use linkChildren here

		return new MotokoCanisterBuilder(updatedScope)
	}

	deps<UP extends Record<string, AllowedDep>, NP extends NormalizeDeps<UP>>(
		providedDeps: ValidProvidedDeps<D, UP>,
	): MotokoCanisterBuilder<
		I,
		MotokoCanisterScope<_SERVICE, I, D, NP>,
		D,
		NP,
		Config,
		_SERVICE
	> {
		const finalDeps = normalizeDepsMap(providedDeps) as NP
		const installArgsTask = {
			...this.#scope.children.install_args,
			dependencies: finalDeps,
		} as InstallArgsTask<I, D, NP>

		const installTask = {
			...this.#scope.children.install,
			dependencies: finalDeps,
		} as InstallTask<_SERVICE, D, NP>

		const updatedChildren = {
			...this.#scope.children,
			install_args: installArgsTask,
			install: installTask,
		}

		const updatedScope = {
			...this.#scope,
			children: updatedChildren,
		} satisfies MotokoCanisterScope<_SERVICE, I, D, NP>
		return new MotokoCanisterBuilder(updatedScope)
	}

	dependsOn<
		UD extends Record<string, AllowedDep>,
		ND extends NormalizeDeps<UD>,
	>(
		dependencies: UD,
	): MotokoCanisterBuilder<
		I,
		MotokoCanisterScope<_SERVICE, I, ND, P>,
		ND,
		P,
		Config,
		_SERVICE
	> {
		const updatedDependsOn = normalizeDepsMap(dependencies) as ND
		const installArgsTask = {
			...this.#scope.children.install_args,
			dependsOn: updatedDependsOn,
		} as InstallArgsTask<I, ND, P>
		const installTask = {
			...this.#scope.children.install,
			dependsOn: updatedDependsOn,
		} as InstallTask<_SERVICE, ND, P>
		const updatedChildren = {
			...this.#scope.children,
			install_args: installArgsTask,
			install: installTask,
		}

		const updatedScope = {
			...this.#scope,
			children: updatedChildren,
		} satisfies MotokoCanisterScope<_SERVICE, I, ND, P>
		return new MotokoCanisterBuilder(updatedScope)
	}

	make(
		this: IsValid<S> extends true
			? MotokoCanisterBuilder<I, S, D, P, Config, _SERVICE>
			: DependencyMismatchError<S>,
	): S {
		// // Otherwise we get a type error
		const self = this as MotokoCanisterBuilder<I, S, D, P, Config, _SERVICE>

		// TODO: can we do this in a type-safe way?
		// so we get warnings about stale dependencies?
		const linkedChildren = linkChildren(self.#scope.children)

		const finalScope = {
			...self.#scope,
			id: Symbol("scope"),
			children: linkedChildren,
		} satisfies MotokoCanisterScope<_SERVICE, I, D, P>
		return finalScope
	}
}

export const motokoCanister = <
	_SERVICE = unknown,
	I extends unknown[] = unknown[],
	P extends Record<string, unknown> = Record<string, unknown>,
>(
	canisterConfigOrFn:
		| MotokoCanisterConfig
		| ((args: { ctx: TaskCtxShape; deps: P }) => MotokoCanisterConfig)
		| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<MotokoCanisterConfig>),
) => {
	const buildTask = makeMotokoBuildTask(canisterConfigOrFn)
	const bindingsTask = makeMotokoBindingsTask({
		build: buildTask,
	})
	const createTask = makeCreateTask(canisterConfigOrFn, [Tags.MOTOKO])
	const stopTask = makeStopTask()
	const removeTask = makeRemoveTask({ stop: stopTask })
	const installArgsTask = makeInstallArgsTask<
		I,
		_SERVICE,
		{},
		{}
		// {
		// 	bindings: typeof bindingsTask,
		// }
	>(
		() => [] as unknown as I,
		{},
		{
			bindings: bindingsTask,
			create: createTask,
		},
	)
	const initialScope = {
		_tag: "scope",
		id: Symbol("scope"),
		tags: [Tags.CANISTER, Tags.MOTOKO],
		description: "Motoko canister scope",
		defaultTask: "deploy",
		children: {
			create: createTask,
			build: buildTask,
			bindings: bindingsTask,
			install_args: installArgsTask,
			stop: stopTask,
			remove: removeTask,
			install: makeInstallTask<I, {}, {}, _SERVICE>({
				install_args: installArgsTask,
				build: buildTask,
				bindings: bindingsTask,
				create: createTask,
			}),
			deploy: makeDeployTask<_SERVICE>([Tags.MOTOKO]),
			status: makeCanisterStatusTask([Tags.MOTOKO]),
		},
	} satisfies MotokoCanisterScope<_SERVICE, I, {}, {}>

	return new MotokoCanisterBuilder<
		I,
		MotokoCanisterScope<_SERVICE, I, {}, {}>,
		{},
		{},
		MotokoCanisterConfig,
		_SERVICE
	>(initialScope)
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
	effect: Effect.gen(function* () {
		return "some value"
	}),
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
	tags: [Tags.CANISTER],
	id: Symbol("scope"),
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

// const test = customCanister(async () => ({
//   wasm: "",
//   candid: "",
// }))

// // test._scope.children.install.computeCacheKey = (task) => {
// //   return task.id.toString()
// // }

// const t = test.deps({ asd: test._scope.children.create }).provide({
//   asd: test._scope.children.create,
//   // TODO: extras also cause errors? should it be allowed?
//   // asd2: test._scope.children.create,
// }).make()
// t.children.install.computeCacheKey
// // t.children.install.dependencies

// const testMotokoCanister = motokoCanister(async () => ({ src: "src/motoko/canister.mo" }))
// .dependsOn({
//   providedTask: providedTask,
// })
// .deps({
//   providedTask2: providedTask,
// })
// .installArgs(async ({ ctx, mode, deps }) => {
//   deps.providedTask
// })
// .make()
