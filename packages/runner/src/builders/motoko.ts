import { Effect, Context, Config, Option, Record } from "effect"
import type { Task } from "../types/types.js"
// import mo from "motoko"
import { Path, FileSystem } from "@effect/platform"
import {
	makeInstallTask,
	makeCreateTask,
	resolveConfig,
	makeStopTask,
	makeRemoveTask,
} from "./custom.js"
import { DependencyResults, TaskInfo } from "../tasks/run.js"
import { generateDIDJS, compileMotokoCanister } from "../canister.js"
import type {
	AllowedDep,
	CanisterScope,
	DependencyMismatchError,
	ExtractTaskEffectSuccess,
	IsValid,
	NormalizeDeps,
	TaskCtxShape,
	ValidProvidedDeps,
} from "./lib.js"
import {
	makeInstallArgsTask,
	normalizeDepsMap,
	Tags,
	linkChildren,
} from "./lib.js"
import { makeCanisterStatusTask, makeDeployTask } from "./lib.js"
import type { ActorSubclass } from "../types/actor.js"

type MotokoCanisterConfig = {
	src: string
	canisterId?: string
}

export const makeMotokoBindingsTask = (deps: {
	build: Task<{
		wasmPath: string
		candidPath: string
	}>
}) => {
	return {
		_tag: "task",
		id: Symbol("motokoCanister/bindings"),
		dependsOn: {},
		dependencies: deps,
		// TODO: do we allow a fn as args here?
		effect: Effect.gen(function* () {
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const { dependencies } = yield* DependencyResults
			const { result: buildResult } = dependencies.build
			// TODO: types
			// @ts-ignore
			const { wasmPath, candidPath } = buildResult

			yield* Effect.logDebug("Artifact paths", { wasmPath, candidPath })

			// yield* fs.makeDirectory(path.dirname(didPath), { recursive: true })
			yield* fs.makeDirectory(path.dirname(wasmPath), { recursive: true })

			const { didJS, didJSPath, didTSPath } = yield* generateDIDJS(
				canisterName,
				candidPath,
			)
			yield* Effect.logDebug(`Generated DID JS for ${canisterName}`)
			return {
				didJS,
				didJSPath,
				didTSPath,
			}
		}),
		description: "Generate bindings for Motoko canister",
		tags: [Tags.CANISTER, Tags.MOTOKO, Tags.BINDINGS],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task
}

const makeMotokoBuildTask = <P extends Record<string, unknown>>(
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<MotokoCanisterConfig>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => MotokoCanisterConfig)
		| MotokoCanisterConfig,
) => {
	return {
		_tag: "task",
		id: Symbol("motokoCanister/build"),
		dependsOn: {},
		dependencies: {},
		effect: Effect.gen(function* () {
			yield* Effect.logDebug("Building Motoko canister")
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const appDir = yield* Config.string("APP_DIR")
			const iceDirName = yield* Config.string("ICE_DIR_NAME")
			const { taskPath } = yield* TaskInfo
			const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
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
			const wasmOutputFilePath = path.join(
				appDir,
				iceDirName,
				"canisters",
				canisterName,
				isGzipped ? `${canisterName}.wasm.gz` : `${canisterName}.wasm`,
			)
			const outCandidPath = path.join(
				appDir,
				iceDirName,
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
			yield* Effect.logDebug("Motoko canister built successfully")
			return {
				wasmPath: wasmOutputFilePath,
				candidPath: outCandidPath,
			}
		}),
		description: "Build Motoko canister",
		tags: [Tags.CANISTER, Tags.MOTOKO, Tags.BUILD],
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task
}

const makeMotokoRemoveTask = (): Task => {
	return {
		_tag: "task",
		id: Symbol("motokoCanister/remove"),
		dependsOn: {},
		dependencies: {},
		effect: Effect.gen(function* () {
			// yield* removeCanister(canisterId)
		}),
		description: "Remove Motoko canister",
		tags: [Tags.CANISTER, Tags.MOTOKO, Tags.REMOVE],
		namedParams: {},
		positionalParams: [],
		params: {},
	}
}

class MotokoCanisterBuilder<
	I,
	S extends CanisterScope<_SERVICE, I, D, P>,
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
				create: makeCreateTask<P>(canisterConfigOrFn, [Tags.MOTOKO]),
			},
		} satisfies CanisterScope<_SERVICE, I, D, P>
		return new MotokoCanisterBuilder(updatedScope)
	}

	build(
		canisterConfigOrFn:
			| Config
			| ((args: { ctx: TaskCtxShape; deps: P }) => Config)
			| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<Config>),
	): MotokoCanisterBuilder<
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
				build: makeMotokoBuildTask<P>(canisterConfigOrFn),
			},
		} satisfies CanisterScope<_SERVICE, I, D, P>
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
		// TODO: use linkChildren here

		return new MotokoCanisterBuilder(updatedScope)
	}

	deps<UP extends Record<string, AllowedDep>, NP extends NormalizeDeps<UP>>(
		providedDeps: ValidProvidedDeps<D, UP>,
	): MotokoCanisterBuilder<
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
			dependencies: finalDeps,
		} as Task<
			{
				args: I
				encodedArgs: Uint8Array<ArrayBufferLike>
			},
			D,
			NP
		>

		const updatedChildren = {
			...this.#scope.children,
			install_args: installArgsTask,
		}

		const updatedScope = {
			...this.#scope,
			children: updatedChildren,
		} satisfies CanisterScope<_SERVICE, I, D, NP>
		return new MotokoCanisterBuilder(updatedScope)
	}

	dependsOn<
		UD extends Record<string, AllowedDep>,
		ND extends NormalizeDeps<UD>,
	>(
		dependencies: UD,
	): MotokoCanisterBuilder<
		I,
		CanisterScope<_SERVICE, I, ND, P>,
		ND,
		P,
		Config,
		_SERVICE
	> {
		const updatedDependsOn = normalizeDepsMap(dependencies) as ND
		const installArgsTask = {
			...this.#scope.children.install_args,
			dependsOn: updatedDependsOn,
		} as Task<
			{
				args: I
				encodedArgs: Uint8Array<ArrayBufferLike>
			},
			ND,
			P
		>
		const updatedChildren = {
			...this.#scope.children,
			install_args: installArgsTask,
		}

		const updatedScope = {
			...this.#scope,
			children: updatedChildren,
		} satisfies CanisterScope<_SERVICE, I, ND, P>
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
		} satisfies CanisterScope<_SERVICE, I, D, P>
		return finalScope
	}
}

export const motokoCanister = <
	_SERVICE = unknown,
	I = unknown,
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
		tags: [Tags.CANISTER, Tags.MOTOKO],
		description: "Motoko canister scope",
		defaultTask: "deploy",
		children: {
			create: createTask,
			build: buildTask,
			bindings: bindingsTask,
			install_args: installArgsTask,
			stop: makeStopTask(),
			remove: makeRemoveTask(),
			install: makeInstallTask<I, Record<string, unknown>, _SERVICE>({
				install_args: installArgsTask,
				build: buildTask,
				bindings: bindingsTask,
				create: createTask,
			}),
			deploy: makeDeployTask([Tags.MOTOKO]),
			status: makeCanisterStatusTask([Tags.MOTOKO]),
		},
	} satisfies CanisterScope<_SERVICE, I, {}, {}>

	return new MotokoCanisterBuilder<
		I,
		CanisterScope<_SERVICE, I, {}, {}>,
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
