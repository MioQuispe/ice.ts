import { Effect, Context, Data, Config, Match, Option, Record } from "effect"
import type { Scope, Task, TaskTree } from "../types/types.js"
// import mo from "motoko"
import { Path, FileSystem } from "@effect/platform"
import type {
	CanisterScope,
	DependencyMismatchError,
	ExtractTaskEffectSuccess,
	FileDigest,
	IsValid,
	TaskCtxShape,
} from "./lib.js"
import {
	digestFile,
	isArtifactCached,
	linkChildren,
	makeInstallArgsTask,
	Tags,
} from "./lib.js"
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
	makeRemoveTask,
	makeStopTask,
	NormalizeDeps,
	normalizeDepsMap,
	ValidProvidedDeps,
	hashJson,
} from "./lib.js"
import { ActorSubclass } from "../types/actor.js"
import { TaskRegistry } from "../services/taskRegistry.js"
import { JsonValue } from "@dfinity/candid"

type CustomCanisterConfig = {
	wasm: string
	candid: string
	canisterId?: string
}

export const makeCustomBindingsTask = (
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape }) => Promise<CustomCanisterConfig>)
		| ((args: { ctx: TaskCtxShape }) => CustomCanisterConfig)
		| CustomCanisterConfig,
): Task<{
	didJS: string
	didJSPath: string
	didTSPath: string
}> => {
	return {
		_tag: "task",
		id: Symbol("customCanister/bindings"),
		dependsOn: {},
		dependencies: {
			// no deps
		},
		// TODO: do we allow a fn as args here?
		effect: Effect.gen(function* () {
			const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const didPath = canisterConfig.candid
			const wasmPath = canisterConfig.wasm
			yield* Effect.logDebug("Artifact paths", { wasmPath, didPath })

			const { didJS, didJSPath, didTSPath } = yield* generateDIDJS(
				canisterName,
				didPath,
			)
			yield* Effect.logDebug(`Generated DID JS for ${canisterName}`)
			return {
				didJS,
				didJSPath,
				didTSPath,
			}
		}),
		description: "Generate bindings for custom canister",
		tags: [Tags.CANISTER, Tags.CUSTOM, Tags.BINDINGS],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task
}

export const makeInstallTask = <
	I,
	P extends Record<string, unknown>,
	_SERVICE,
>({
	install_args,
	build,
	bindings,
	create,
}: {
	install_args: Task<{
		args: I
		encodedArgs: Uint8Array<ArrayBufferLike>
	}>
	build: Task<{
		wasmPath: string
		candidPath: string
	}>
	bindings: Task<{
		didJSPath: string
		didTSPath: string
	}>
	create: Task<string>
}): Task<{
	canisterId: string
	canisterName: string
	actor: ActorSubclass<_SERVICE>
}> => {
	type InstallInput = {
		network: string
		canisterId: string
		canisterName: string
		taskPath: string
		mode: string
		depCacheKeys: Record<string, string | undefined>
	}
	return {
		_tag: "task",
		id: Symbol("customCanister/install"),
		dependsOn: {},
		dependencies: {
			install_args,
			build,
			bindings,
			create,
		},
		effect: Effect.gen(function* () {
			yield* Effect.logDebug("Starting custom canister installation")
			const taskCtx = yield* TaskCtx
			const identity = taskCtx.roles.deployer.identity
			const { replica, args } = taskCtx
			const { dependencies } = yield* DependencyResults
			// TODO: fix. also type should be inferred?
			const argsTaskResult = dependencies.install_args.result as {
				args: I
				encodedArgs: Uint8Array<ArrayBufferLike>
			}
			const { didJSPath, didTSPath } = dependencies.bindings.result as {
				didJSPath: string
				didTSPath: string
			}
			const { wasmPath } = dependencies.build.result as {
				wasmPath: string
				candidPath: string
			}
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")

			const canisterId = yield* loadCanisterId(taskPath)
			yield* Effect.logDebug("Loaded canister ID", { canisterId })
			const fs = yield* FileSystem.FileSystem

			// TODO: 
			// they can return the values we need perhaps? instead of reading from fs
			// we need the wasm blob and candid DIDjs / idlFactory?
			const wasmContent = yield* fs.readFile(wasmPath)
			const wasm = new Uint8Array(wasmContent)
			const maxSize = 3670016
			yield* Effect.logDebug(`Installing code for ${canisterId} at ${wasmPath}`)
			yield* Effect.logDebug("argsTaskResult", argsTaskResult)
			yield* replica.installCode({
				canisterId,
				wasm,
				encodedArgs: argsTaskResult.encodedArgs,
				identity,
			})
			yield* Effect.logDebug(`Code installed for ${canisterId}`)
			yield* Effect.logDebug(`Canister ${canisterName} installed successfully`)
			// TODO: can we type it somehow?
			const canisterDID = yield* Effect.tryPromise({
				try: () => import(didJSPath),
				catch: Effect.fail,
			})
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
		// TODO: allow passing in candid as a string from CLI
		namedParams: {},
		positionalParams: [],
		params: {},
		// TODO: add network?
		computeCacheKey: (task, input: InstallInput) => {
			// TODO: pocket-ic could be restarted?
			const installInput = {
				canisterId: input.canisterId,
				network: input.network,
				mode: input.mode,
				depsHash: hashJson(input.depCacheKeys),
			}
			const cacheKey = hashJson(installInput)
			return cacheKey
		},
		input: (task) =>
			Effect.gen(function* () {
				const { taskPath } = yield* TaskInfo
				const canisterName = taskPath.split(":").slice(0, -1).join(":")
				const { dependencies } = yield* DependencyResults
				const depCacheKeys = Record.map(dependencies, (dep) => dep.cacheKey)
				const canisterId = yield* loadCanisterId(taskPath)
				const { currentNetwork } = yield* TaskCtx
				// TODO: get from flags or args?
				const mode = "install"
				// TODO: input runs before the task is executed
				// so how do we get the install args? from a previous run perhaps?
				const taskRegistry = yield* TaskRegistry
				// TODO: we need a separate cache for this?
				const input = {
					canisterId,
					canisterName,
					network: currentNetwork,
					taskPath,
					mode,
					depCacheKeys,
				} satisfies InstallInput
				return input
			}),
		// TODO: fix generic type? we shouldnt have to type this
		encode: (result: {
			canisterId: string
			canisterName: string
			actor: ActorSubclass<_SERVICE>
		}) =>
			Effect.gen(function* () {
				const encoded = JSON.stringify({
					canisterId: result.canisterId,
					canisterName: result.canisterName,
				})
				return encoded
			}),
		decode: (value) =>
			Effect.gen(function* () {
				const { canisterId, canisterName } = JSON.parse(value as string) as {
					canisterId: string
					canisterName: string
				}
				const {
					replica,
					roles: {
						deployer: { identity },
					},
				} = yield* TaskCtx
				const { dependencies } = yield* DependencyResults
				const { didJSPath } = dependencies.bindings.result as {
					didJSPath: string
				}
				// TODO: can we type it somehow?
				const canisterDID = yield* Effect.tryPromise({
					try: () => import(didJSPath),
					catch: Effect.fail,
				})
				const actor = yield* replica.createActor<_SERVICE>({
					canisterId,
					canisterDID,
					identity,
				})
				const decoded = {
					canisterId,
					canisterName,
					actor: proxyActor(canisterName, actor),
				} satisfies {
					canisterId: string
					canisterName: string
					actor: ActorSubclass<_SERVICE>
				}
				return decoded
			}),
	} satisfies Task<{
		canisterId: string
		canisterName: string
		actor: ActorSubclass<_SERVICE>
	}>
}

export const makeCustomBuildTask = <P extends Record<string, unknown>>(
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<CustomCanisterConfig>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => CustomCanisterConfig)
		| CustomCanisterConfig,
): Task<{
	wasmPath: string
	candidPath: string
}> => {
	type BuildInput = {
		canisterId: string
		canisterName: string
		taskPath: string
		wasm: FileDigest
		candid: FileDigest
		depCacheKeys: Record<string, string | undefined>
	}
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
			const appDir = yield* Config.string("APP_DIR")
			const iceDirName = yield* Config.string("ICE_DIR_NAME")
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
			return {
				wasmPath: outWasmPath,
				candidPath: outCandidPath,
			}
		}),
		computeCacheKey: (task, input: BuildInput) => {
			// TODO: pocket-ic could be restarted?
			const installInput = {
				canisterId: input.canisterId,
				wasmHash: input.wasm.sha256,
				candidHash: input.candid.sha256,
				depsHash: hashJson(input.depCacheKeys),
			}
			const cacheKey = hashJson(installInput)
			return cacheKey
		},
		input: (task) =>
			Effect.gen(function* () {
				const { taskPath } = yield* TaskInfo
				const canisterName = taskPath.split(":").slice(0, -1).join(":")
				const { dependencies } = yield* DependencyResults
				const depCacheKeys = Record.map(dependencies, (dep) => dep.cacheKey)
				const canisterId = yield* loadCanisterId(taskPath)
				const path = yield* Path.Path
				const appDir = yield* Config.string("APP_DIR")
				const iceDirName = yield* Config.string("ICE_DIR_NAME")
				const wasmPath = path.join(
					appDir,
					iceDirName,
					"canisters",
					canisterName,
					`${canisterName}.wasm`,
				)
				const candidPath = path.join(
					appDir,
					iceDirName,
					"canisters",
					canisterName,
					`${canisterName}.did`,
				)
				// TODO: we need a separate cache for this?
				const prevWasmDigest = undefined
				const { fresh, digest: wasmDigest } = yield* Effect.tryPromise({
					//
					try: () => isArtifactCached(wasmPath, prevWasmDigest),
					// TODO:
					catch: Effect.fail,
				})
				const prevCandidDigest = undefined
				const { fresh: candidFresh, digest: candidDigest } = yield* Effect.tryPromise({
					try: () => isArtifactCached(candidPath, prevCandidDigest),
					catch: Effect.fail,
				})
				const input = {
					canisterId,
					canisterName,
					taskPath,
					wasm: wasmDigest,
					candid: candidDigest,
					depCacheKeys,
				} satisfies BuildInput
				return input
			}),
		description: "Build custom canister",
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
			const canisterIdsService = yield* CanisterIdsService
			const taskCtx = yield* TaskCtx
			const currentNetwork = taskCtx.currentNetwork
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const storedCanisterIds = yield* canisterIdsService.getCanisterIds()
			const storedCanisterId: string | undefined =
				storedCanisterIds[canisterName]?.[currentNetwork]
			yield* Effect.logDebug("makeCreateTask", { storedCanisterId })
			const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
			const configCanisterId = canisterConfig?.canisterId
			// TODO: handle all edge cases related to this. what happens
			// if the user provides a new canisterId in the config? and so on
			// and how about mainnet?
			const resolvedCanisterId = storedCanisterId ?? configCanisterId
			const {
				roles: {
					deployer: { identity },
				},
				replica,
			} = yield* TaskCtx
			const isAlreadyInstalled =
				resolvedCanisterId &&
				(yield* replica.getCanisterInfo({
					canisterId: resolvedCanisterId,
					identity,
				})).status !== "not_installed"

			yield* Effect.logDebug("makeCreateTask", {
				isAlreadyInstalled,
				resolvedCanisterId,
			})

			const canisterId = isAlreadyInstalled
				? resolvedCanisterId
				: yield* replica.createCanister({
						canisterId: resolvedCanisterId,
						identity,
					})
			const appDir = yield* Config.string("APP_DIR")
			const iceDirName = yield* Config.string("ICE_DIR_NAME")
			yield* canisterIdsService.setCanisterId({
				canisterName,
				network: taskCtx.currentNetwork,
				canisterId,
			})
			const outDir = path.join(appDir, iceDirName, "canisters", canisterName)
			yield* fs.makeDirectory(outDir, { recursive: true })
			return canisterId
		}),
		description: "Create custom canister",
		// TODO:
		tags: [Tags.CANISTER, Tags.CREATE, ...tags],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task<string>
}

class CustomCanisterBuilder<
	I,
	S extends CanisterScope<_SERVICE, I, D, P>,
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
		CanisterScope<_SERVICE, I, D, P>,
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
		} satisfies CanisterScope<_SERVICE, I, D, P>
		return new CustomCanisterBuilder(updatedScope)
	}

	build(
		canisterConfigOrFn:
			| Config
			| ((args: { ctx: TaskCtxShape; deps: P }) => Config)
			| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<Config>),
	): CustomCanisterBuilder<
		I,
		CanisterScope<_SERVICE, I, D, P>,
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
		} satisfies CanisterScope<_SERVICE, I, D, P>
		return new CustomCanisterBuilder(updatedScope)
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
	): CustomCanisterBuilder<
		I,
		CanisterScope<_SERVICE, I, D, P>,
		D,
		P,
		Config,
		_SERVICE
	> {
		// TODO: is this a flag, arg, or what?
		const mode = "install"
		// TODO: passing in I makes the return type: any
		// TODO: we need to inject dependencies again! or they can be overwritten
		const dependencies = this.#scope.children.install_args.dependsOn
		const provide = this.#scope.children.install_args.dependencies
		const installArgsTask = {
			...makeInstallArgsTask<
				I,
				ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>,
				_SERVICE
			>(
				installArgsFn,
				{
					bindings: this.#scope.children.bindings,
				},
				{ customEncode },
			),
			dependsOn: dependencies,
			dependencies: provide,
		}
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				install_args: installArgsTask,
			},
		} satisfies CanisterScope<_SERVICE, I, D, P>

		return new CustomCanisterBuilder(updatedScope)
	}

	deps<UP extends Record<string, AllowedDep>, NP extends NormalizeDeps<UP>>(
		providedDeps: ValidProvidedDeps<D, UP>,
	): CustomCanisterBuilder<
		I,
		CanisterScope<_SERVICE, I, D, NP>,
		D,
		NP,
		Config,
		_SERVICE
	> {
		const finalDeps = normalizeDepsMap(providedDeps) as NP
		const installArgsTask = {
			...this.#scope.children.install_args,
			// TODO: this can cause a naming collision
			// with existing tasks... bindings, etc.
			dependencies: {
				...this.#scope.children.install_args.dependencies,
				...finalDeps,
			},
		} as Task<
			{
				args: I
				encodedArgs: Uint8Array<ArrayBufferLike>
			},
			D,
			NP
		>
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				install_args: installArgsTask,
			},
		} satisfies CanisterScope<_SERVICE, I, D, NP>
		return new CustomCanisterBuilder(updatedScope)
	}

	dependsOn<
		UD extends Record<string, AllowedDep>,
		ND extends NormalizeDeps<UD>,
	>(
		dependencies: UD,
	): CustomCanisterBuilder<
		I,
		CanisterScope<_SERVICE, I, ND, P>,
		ND,
		P,
		Config,
		_SERVICE
	> {
		const updatedDeps = normalizeDepsMap(dependencies) as ND
		const installArgsTask = {
			...this.#scope.children.install_args,
			dependsOn: {
				...this.#scope.children.install_args.dependsOn,
				...updatedDeps,
			},
		} as Task<
			{
				args: I
				encodedArgs: Uint8Array<ArrayBufferLike>
			},
			ND,
			P
		>
		const updatedScope = {
			...this.#scope,
			children: {
				...this.#scope.children,
				install_args: installArgsTask,
			},
		} satisfies CanisterScope<_SERVICE, I, ND, P>
		return new CustomCanisterBuilder(updatedScope)
	}

	make(
		this: IsValid<S> extends true
			? CustomCanisterBuilder<I, S, D, P, Config, _SERVICE>
			: DependencyMismatchError<S>,
	): S {
		// Otherwise we get a type error
		const self = this as CustomCanisterBuilder<I, S, D, P, Config, _SERVICE>
		const linkedChildren = linkChildren(self.#scope.children)
		const finalScope = {
			...self.#scope,
			id: Symbol("scope"),
			children: linkedChildren,
		} satisfies CanisterScope<_SERVICE, I, D, P>
		return finalScope
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
	CanisterScope<_SERVICE, I, {}, {}>,
	{},
	{},
	CustomCanisterConfig,
	_SERVICE
> => {
	const createTask = makeCreateTask(canisterConfigOrFn, [Tags.CUSTOM])
	const bindingsTask = makeCustomBindingsTask(canisterConfigOrFn)
	const buildTask = makeCustomBuildTask(canisterConfigOrFn)
	const stopTask = makeStopTask()
	const removeTask = makeRemoveTask({ stop: stopTask })
	const installArgsTask = makeInstallArgsTask<
		I,
		Record<string, unknown>,
		_SERVICE
	>(() => [] as unknown as I, {
		bindings: bindingsTask,
	})
	const initialScope = {
		_tag: "scope",
		id: Symbol("scope"),
		tags: [Tags.CANISTER, Tags.CUSTOM],
		description: "Custom canister scope",
		defaultTask: "deploy",
		// TODO: default implementations
		children: {
			create: createTask,
			bindings: bindingsTask,
			build: buildTask,
			install_args: installArgsTask,
			install: makeInstallTask<I, Record<string, unknown>, _SERVICE>({
				install_args: installArgsTask,
				build: buildTask,
				bindings: bindingsTask,
				create: createTask,
			}),
			stop: stopTask,
			remove: removeTask,
			deploy: makeDeployTask([Tags.CUSTOM]),
			status: makeCanisterStatusTask([Tags.CUSTOM]),
		},
	} satisfies CanisterScope<_SERVICE, I, {}, {}>

	return new CustomCanisterBuilder<
		I,
		CanisterScope<_SERVICE, I, {}, {}>,
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

// type A = Effect.Effect.Success<typeof test._scope.children.install.effect>
