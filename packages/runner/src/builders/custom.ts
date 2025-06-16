import { Effect, Context, Data, Config, Match, Option, Record } from "effect"
import type { Scope, Task, TaskTree } from "../types/types.js"
// import mo from "motoko"
import { Path, FileSystem } from "@effect/platform"
import type {
	CanisterScope,
	DependencyMismatchError,
	ExtractTaskEffectSuccess,
	IsValid,
	TaskCtxShape,
} from "./lib.js"
import { Tags } from "./lib.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { proxyActor } from "../utils/extension.js"
import { TaskInfo } from "../tasks/run.js"
import { TaskCtx } from "../tasks/lib.js"
import { DependencyResults } from "../tasks/run.js"
import { generateDIDJS, encodeArgs } from "../canister.js"
import {
	AllowedDep,
	makeCanisterStatusTask,
	makeDeployTask,
	NormalizeDeps,
	normalizeDepsMap,
	ValidProvidedDeps,
} from "./lib.js"
import { ActorSubclass } from "../types/actor.js"

type CustomCanisterConfig = {
	wasm: string
	candid: string
	canisterId?: string
	noEncodeArgs?: boolean
}

export const iceDirName = ".ice"

export const makeStopTask = (): Task<void> => {
	return {
		_tag: "task",
		id: Symbol("customCanister/stop"),
		dependsOn: {},
		dependencies: {},
		// TODO: do we allow a fn as args here?
		effect: Effect.gen(function* () {
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const appDir = yield* Config.string("APP_DIR")
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			// TODO: handle error
			const canisterId = yield* loadCanisterId(taskPath)
			const {
				roles: {
					deployer: { identity },
				},
				replica,
			} = yield* TaskCtx
			yield* replica.stopCanister({
				canisterId,
				identity,
			})
			yield* Effect.logDebug(`Stopped canister ${canisterName}`)
		}),
		description: "some description",
		// TODO: no tag custom
		tags: [Tags.CANISTER, Tags.STOP],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task<void>
}

export const makeRemoveTask = (): Task<void> => {
	return {
		_tag: "task",
		id: Symbol("customCanister/remove"),
		dependsOn: {},
		dependencies: {},
		// TODO: do we allow a fn as args here?
		effect: Effect.gen(function* () {
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const appDir = yield* Config.string("APP_DIR")
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			// TODO: handle error
			const canisterId = yield* loadCanisterId(taskPath)
			const {
				roles: {
					deployer: { identity },
				},
				replica,
			} = yield* TaskCtx
			yield* replica.removeCanister({
				canisterId,
				identity,
			})
			const canisterIdsService = yield* CanisterIdsService
			yield* canisterIdsService.removeCanisterId(canisterName)
			yield* Effect.logDebug(`Removed canister ${canisterName}`)
		}),
		description: "some description",
		// TODO: no tag custom
		tags: [Tags.CANISTER, Tags.REMOVE],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task<void>
}

export const makeCustomBindingsTask = (
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape }) => Promise<CustomCanisterConfig>)
		| ((args: { ctx: TaskCtxShape }) => CustomCanisterConfig)
		| CustomCanisterConfig,
): Task<void> => {
	return {
		_tag: "task",
		id: Symbol("customCanister/bindings"),
		dependsOn: {},
		dependencies: {},
		// TODO: do we allow a fn as args here?
		effect: Effect.gen(function* () {
			const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const appDir = yield* Config.string("APP_DIR")
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const didPath = canisterConfig.candid
			const wasmPath = canisterConfig.wasm
			yield* Effect.logDebug("Artifact paths", { wasmPath, didPath })

			yield* generateDIDJS(canisterName, didPath)
			yield* Effect.logDebug(`Generated DID JS for ${canisterName}`)
		}),
		description: "some description",
		tags: [Tags.CANISTER, Tags.CUSTOM, Tags.BINDINGS],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task
}

export const makeInstallTask = <I, P extends Record<string, unknown>, _SERVICE>(
	installArgsFn?: (args: {
		ctx: TaskCtxShape
		mode: string
		deps: P
	}) => Promise<I> | I,
	noEncodeArgs = false,
): Task<{
	canisterId: string
	canisterName: string
	actor: ActorSubclass<_SERVICE>
}> => {
	return {
		_tag: "task",
		id: Symbol("customCanister/install"),
		dependsOn: {},
		dependencies: {},
		effect: Effect.gen(function* () {
			yield* Effect.logDebug("Starting custom canister installation")
			const taskCtx = yield* TaskCtx
			const identity = taskCtx.roles.deployer.identity
			const { replica } = taskCtx
			const { dependencies } = yield* DependencyResults
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")

			yield* Effect.logDebug("No encode args", { noEncodeArgs, canisterName })

			const canisterId = yield* loadCanisterId(taskPath)
			yield* Effect.logDebug("Loaded canister ID", { canisterId })

			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const appDir = yield* Config.string("APP_DIR")

			yield* canisterBuildGuard
			yield* Effect.logDebug("Build guard check passed")

			const didJSPath = path.join(
				appDir,
				iceDirName,
				"canisters",
				canisterName,
				`${canisterName}.did.js`,
			)
			// TODO: can we type it somehow?
			const canisterDID = yield* Effect.tryPromise({
				try: () => import(didJSPath),
				catch: Effect.fail,
			})
			yield* Effect.logDebug("Loaded canisterDID", { canisterDID })

			let installArgs = [] as unknown as I
			if (installArgsFn) {
				yield* Effect.logDebug("Executing install args function")

				const installFn = installArgsFn as (args: {
					ctx: TaskCtxShape
					mode: string
					deps: P
				}) => Promise<I> | I
				// TODO: should it catch errors?
				// TODO: handle different modes
				const installResult = installFn({
					mode: "install",
					ctx: taskCtx,
					deps: dependencies as P,
				})
				if (installResult instanceof Promise) {
					installArgs = yield* Effect.tryPromise({
						try: () => installResult,
						catch: (error) => {
							// TODO: proper error handling
							return error instanceof Error ? error : new Error(String(error))
						},
					})
				}
				yield* Effect.logDebug("Install args generated", { args: installArgs })
			}

			yield* Effect.logDebug("Encoding args", { installArgs, canisterDID })
			const encodedArgs = noEncodeArgs
				? (installArgs as unknown as Uint8Array)
				: yield* Effect.try({
						// TODO: do we accept simple objects as well?
						// @ts-ignore
						try: () => encodeArgs(installArgs, canisterDID),
						catch: (error) => {
							throw new Error(
								`Failed to encode args: ${error instanceof Error ? error.message : String(error)}`,
							)
						},
					})
			yield* Effect.logDebug("Args encoded successfully")

			const isGzipped = yield* fs.exists(
				path.join(
					appDir,
					iceDirName,
					"canisters",
					canisterName,
					`${canisterName}.wasm.gz`,
				),
			)
			const wasmPath = path.join(
				appDir,
				iceDirName,
				"canisters",
				canisterName,
				isGzipped ? `${canisterName}.wasm.gz` : `${canisterName}.wasm`,
			)
			const wasmContent = yield* fs.readFile(wasmPath)
			const wasm = new Uint8Array(wasmContent)
			const maxSize = 3670016
			// const identity =
			yield* Effect.logDebug(`Installing code for ${canisterId} at ${wasmPath}`)
			yield* replica.installCode({
				canisterId,
				wasm,
				encodedArgs,
				identity,
			})
			yield* Effect.logDebug(`Code installed for ${canisterId}`)
			yield* Effect.logDebug(`Canister ${canisterName} installed successfully`)
			const actor = yield* replica.createActor<_SERVICE>({
				canisterId,
				canisterDID,
				identity,
			})
			return {
				canisterId,
				canisterName,
				actor: proxyActor(canisterName, actor),
			}
		}),
		description: "Install canister code",
		tags: [Tags.CANISTER, Tags.CUSTOM, Tags.INSTALL],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task<{
		canisterId: string
		canisterName: string
		actor: ActorSubclass<_SERVICE>
	}>
}

const makeBuildTask = <P extends Record<string, unknown>>(
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<CustomCanisterConfig>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => CustomCanisterConfig)
		| CustomCanisterConfig,
): Task<void> => {
	return {
		_tag: "task",
		id: Symbol("customCanister/build"),
		dependsOn: {},
		dependencies: {},
		effect: Effect.gen(function* () {
			const taskCtx = yield* TaskCtx
			const fs = yield* FileSystem.FileSystem
			const path = yield* Path.Path
			const appDir = yield* Config.string("APP_DIR")
			// TODO: could be a promise
			const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
			const { taskPath } = yield* TaskInfo
			// TODO: pass in as arg instead?
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const isGzipped = yield* fs.exists(
				path.join(
					appDir,
					iceDirName,
					"canisters",
					canisterName,
					`${canisterName}.wasm.gz`,
				),
			)
			const outWasmPath = path.join(
				appDir,
				iceDirName,
				"canisters",
				canisterName,
				isGzipped ? `${canisterName}.wasm.gz` : `${canisterName}.wasm`,
			)
			const wasm = yield* fs.readFile(canisterConfig.wasm)
			// Ensure the directory exists
			yield* fs.makeDirectory(path.dirname(outWasmPath), { recursive: true })
			yield* fs.writeFile(outWasmPath, wasm)

			const outCandidPath = path.join(
				appDir,
				iceDirName,
				"canisters",
				canisterName,
				`${canisterName}.did`,
			)
			const candid = yield* fs.readFile(canisterConfig.candid)
			yield* fs.writeFile(outCandidPath, candid)

			// if (fn) {
			//   yield* Effect.tryPromise({
			//     // TODO: why are we passing this in?
			//     try: () => fn(taskCtx),
			//     catch: Effect.fail,
			//   })
			// }
		}),
		description: "some description",
		tags: [Tags.CANISTER, Tags.CUSTOM, Tags.BUILD],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task<void>
}

export const resolveConfig = <T, P extends Record<string, unknown>>(
	configOrFn:
		| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<T>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => T)
		| T,
) =>
	Effect.gen(function* () {
		const taskCtx = yield* TaskCtx
		if (typeof configOrFn === "function") {
			const configFn = configOrFn as (args: {
				ctx: TaskCtxShape
			}) => Promise<T> | T
			const configResult = configFn({ ctx: taskCtx })
			if (configResult instanceof Promise) {
				return yield* Effect.tryPromise({
					try: () => configResult,
					catch: (error) => {
						// TODO: proper error handling
						console.error("Error resolving config function:", error)
						return error instanceof Error ? error : new Error(String(error))
					},
				})
			}
			return configResult
		}
		return configOrFn
	})

type CreateConfig = {
	canisterId?: string
}
export const makeCreateTask = <P extends Record<string, unknown>>(
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<CreateConfig>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => CreateConfig)
		| CreateConfig,
	tags: string[] = [],
): Task<string> => {
	const id = Symbol("canister/create")
	return {
		_tag: "task",
		id,
		dependsOn: {},
		dependencies: {},
		effect: Effect.gen(function* () {
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const taskCtx = yield* TaskCtx
			const { taskPath } = yield* TaskInfo
			const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
			const configCanisterId = canisterConfig?.canisterId
			// TODO: do we need to optimize this?
			// TODO: use this directly instead of getCanisterInfo
			// const { roles: { deployer: { identity } }, replica } = yield* TaskCtx
			// const canisterInfo = yield* replica.getCanisterInfo({
			// 	canisterId,
			// 	identity,
			// })
			const {
				roles: {
					deployer: { identity },
				},
				replica,
			} = yield* TaskCtx
			const isAlreadyInstalled =
				configCanisterId &&
				(yield* replica.getCanisterInfo({
					canisterId: configCanisterId,
					identity,
				})).status !== "not_installed"

			const canisterId = isAlreadyInstalled
				? configCanisterId
				: yield* replica.createCanister({
						canisterId: configCanisterId,
						identity,
					})

			const canisterIdsService = yield* CanisterIdsService
			const appDir = yield* Config.string("APP_DIR")
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			yield* canisterIdsService.setCanisterId({
				canisterName,
				network: taskCtx.currentNetwork,
				canisterId,
			})
			const outDir = path.join(appDir, iceDirName, "canisters", canisterName)
			yield* fs.makeDirectory(outDir, { recursive: true })
			return canisterId
		}),
		description: "some description",
		// TODO:
		tags: [Tags.CANISTER, Tags.CREATE, ...tags],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task<string>
}

class CustomCanisterBuilder<
	I,
	S extends CanisterScope<_SERVICE, D, P>,
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
		CanisterScope<_SERVICE, D, P>,
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
		} satisfies CanisterScope<_SERVICE, D, P>
		return new CustomCanisterBuilder(updatedScope)
	}

	build(
		canisterConfigOrFn:
			| Config
			| ((args: { ctx: TaskCtxShape; deps: P }) => Config)
			| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<Config>),
	): CustomCanisterBuilder<
		I,
		CanisterScope<_SERVICE, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				build: makeBuildTask<P>(canisterConfigOrFn),
			},
		} satisfies CanisterScope<_SERVICE, D, P>
		return new CustomCanisterBuilder(updatedScope)
	}

	installArgs(
		installArgsFn: (args: {
			ctx: TaskCtxShape
			deps: ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
			mode: string
		}) => I | Promise<I>,
		{ noEncodeArgs }: { noEncodeArgs?: boolean } = {
			noEncodeArgs: false,
		},
	): CustomCanisterBuilder<
		I,
		CanisterScope<_SERVICE, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		// TODO: is this a flag, arg, or what?
		const mode = "install"
		// TODO: passing in I makes the return type: any
		// TODO: we need to inject dependencies again! or they can be overwritten
		const dependencies = this.#scope.children.install.dependsOn
		const provide = this.#scope.children.install.dependencies
		const installTask = makeInstallTask<
			I,
			ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>,
			_SERVICE
		>(installArgsFn, noEncodeArgs)
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				install: {
					...installTask,
					dependsOn: dependencies,
					dependencies: provide,
				},
			},
		} satisfies CanisterScope<_SERVICE, D, P>

		return new CustomCanisterBuilder(updatedScope)
	}

	deps<UP extends Record<string, AllowedDep>, NP extends NormalizeDeps<UP>>(
		providedDeps: ValidProvidedDeps<D, UP>,
	): CustomCanisterBuilder<
		I,
		CanisterScope<_SERVICE, D, NP>,
		D,
		NP,
		Config,
		_SERVICE
	> {
		const finalDeps = normalizeDepsMap(providedDeps) as NP
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				install: {
					...this.#scope.children.install,
					dependencies: finalDeps,
				} as Task<
					{
						canisterId: string
						canisterName: string
						actor: ActorSubclass<_SERVICE>
					},
					D,
					NP
				>,
			},
		} satisfies CanisterScope<_SERVICE, D, NP>
		return new CustomCanisterBuilder(updatedScope)
	}

	dependsOn<
		UD extends Record<string, AllowedDep>,
		ND extends NormalizeDeps<UD>,
	>(
		dependencies: UD,
	): CustomCanisterBuilder<
		I,
		CanisterScope<_SERVICE, ND, P>,
		ND,
		P,
		Config,
		_SERVICE
	> {
		const updatedDeps = normalizeDepsMap(dependencies) as ND
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				install: {
					...this.#scope.children.install,
					dependsOn: updatedDeps,
				} as Task<
					{
						canisterId: string
						canisterName: string
						actor: ActorSubclass<_SERVICE>
					},
					ND,
					P
				>,
			},
		} satisfies CanisterScope<_SERVICE, ND, P>
		return new CustomCanisterBuilder(updatedScope)
	}

	make(
		this: IsValid<S> extends true
			? CustomCanisterBuilder<I, S, D, P, Config, _SERVICE>
			: DependencyMismatchError<S>,
	): S {
		// Otherwise we get a type error
		const self = this as CustomCanisterBuilder<I, S, D, P, Config, _SERVICE>
		return {
			...self.#scope,
			id: Symbol("scope"),
			children: Record.map(self.#scope.children, (value) => ({
				...value,
				id: Symbol("task"),
			})),
		} satisfies CanisterScope<_SERVICE, D, P>
	}
}

// TODO: some kind of metadata?
// TODO: warn about context if not provided
export const customCanister = <_SERVICE = unknown, I = unknown>(
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape }) => Promise<CustomCanisterConfig>)
		| ((args: { ctx: TaskCtxShape }) => CustomCanisterConfig)
		| CustomCanisterConfig,
): CustomCanisterBuilder<
	I,
	CanisterScope<_SERVICE>,
	{},
	{},
	CustomCanisterConfig,
	_SERVICE
> => {
	const initialScope = {
		_tag: "scope",
		id: Symbol("scope"),
		tags: [Tags.CANISTER, Tags.CUSTOM],
		description: "some description",
		defaultTask: "deploy",
		// TODO: default implementations
		children: {
			create: makeCreateTask(canisterConfigOrFn, [Tags.CUSTOM]),
			bindings: makeCustomBindingsTask(canisterConfigOrFn),
			build: makeBuildTask(canisterConfigOrFn),
			install: makeInstallTask<I, Record<string, unknown>, _SERVICE>(),
			stop: makeStopTask(),
			remove: makeRemoveTask(),
			deploy: makeDeployTask([Tags.CUSTOM]),
			status: makeCanisterStatusTask([Tags.CUSTOM]),
		},
	} satisfies CanisterScope<_SERVICE>

	return new CustomCanisterBuilder<
		I,
		CanisterScope<_SERVICE>,
		{},
		{},
		CustomCanisterConfig,
		_SERVICE
	>(initialScope)
}

export const loadCanisterId = (taskPath: string) =>
	Effect.gen(function* () {
		const canisterName = taskPath.split(":").slice(0, -1).join(":")
		const canisterIdsService = yield* CanisterIdsService
		const canisterIds = yield* canisterIdsService.getCanisterIds()
		const { currentNetwork } = yield* TaskCtx
		const canisterId = canisterIds[canisterName]?.[currentNetwork]
		if (canisterId) {
			return canisterId as string
		}
		return yield* Effect.fail(new Error("Canister ID not found"))
	})

export const canisterBuildGuard = Effect.gen(function* () {
	const path = yield* Path.Path
	const fs = yield* FileSystem.FileSystem
	const appDir = yield* Config.string("APP_DIR")
	// TODO: dont wanna pass around id everywhere
	const { taskPath } = yield* TaskInfo
	const canisterName = taskPath.split(":").slice(0, -1).join(":")
	const didPath = path.join(
		appDir,
		iceDirName,
		"canisters",
		canisterName,
		`${canisterName}.did`,
	)
	const isGzipped = yield* fs.exists(
		path.join(
			appDir,
			iceDirName,
			"canisters",
			canisterName,
			`${canisterName}.wasm.gz`,
		),
	)
	const wasmPath = path.join(
		appDir,
		iceDirName,
		"canisters",
		canisterName,
		isGzipped ? `${canisterName}.wasm.gz` : `${canisterName}.wasm`,
	)
	const didExists = yield* fs.exists(didPath)
	if (!didExists) {
		yield* Effect.fail(
			new Error(
				`Candid file not found: ${didPath}, ${canisterName}, taskPath: ${taskPath}`,
			),
		)
	}
	const wasmExists = yield* fs
		.exists(wasmPath)
		.pipe(Effect.mapError((e) => new Error("Wasm file not found")))
	if (!wasmExists) {
		yield* Effect.fail(new Error("Wasm file not found"))
	}
	return true
})

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
	})
	.make()
// t.children.install.computeCacheKey
// // t.children.install.dependencies

// type A = Effect.Effect.Success<typeof test._scope.children.install.effect>
