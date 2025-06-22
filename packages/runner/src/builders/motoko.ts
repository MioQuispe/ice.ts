import { Effect, Context, Config, Option, Record } from "effect"
import type { Task } from "../types/types.js"
// import mo from "motoko"
import { Path, FileSystem } from "@effect/platform"
import {
	canisterBuildGuard,
	makeInstallTask,
	makeCreateTask,
	resolveConfig,
	makeStopTask,
	makeRemoveTask,
} from "./custom.js"
import { TaskInfo } from "../tasks/run.js"
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
import { normalizeDepsMap, Tags } from "./lib.js"
import { makeCanisterStatusTask, makeDeployTask } from "./lib.js"
import type { ActorSubclass } from "../types/actor.js"

type MotokoCanisterConfig = {
	src: string
	canisterId?: string
}

export const makeMotokoBindingsTask = () => {
	return {
		_tag: "task",
		id: Symbol("motokoCanister/bindings"),
		dependsOn: {},
		dependencies: {},
		// TODO: do we allow a fn as args here?
		effect: Effect.gen(function* () {
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const appDir = yield* Config.string("APP_DIR")
			const iceDirName = yield* Config.string("ICE_DIR_NAME")
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			yield* canisterBuildGuard
			yield* Effect.logDebug(
				`Bindings build guard check passed for ${canisterName}`,
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
			const didPath = path.join(
				appDir,
				iceDirName,
				"canisters",
				canisterName,
				`${canisterName}.did`,
			)
			yield* Effect.logDebug("Artifact paths", { wasmPath, didPath })

			// yield* fs.makeDirectory(path.dirname(didPath), { recursive: true })
			yield* fs.makeDirectory(path.dirname(wasmPath), { recursive: true })

			yield* generateDIDJS(canisterName, didPath)
			yield* Effect.logDebug(`Generated DID JS for ${canisterName}`)
		}),
		description: "some description",
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
		}),
		description: "some description",
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
		description: "some description",
		tags: [Tags.CANISTER, Tags.MOTOKO, Tags.REMOVE],
		namedParams: {},
		positionalParams: [],
		params: {},
	}
}

class MotokoCanisterBuilder<
	I,
	S extends CanisterScope<_SERVICE, D, P>,
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
				create: makeCreateTask<P>(canisterConfigOrFn, [Tags.MOTOKO]),
			},
		} satisfies CanisterScope<_SERVICE, D, P>
		return new MotokoCanisterBuilder(updatedScope)
	}

	build(
		canisterConfigOrFn:
			| Config
			| ((args: { ctx: TaskCtxShape; deps: P }) => Config)
			| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<Config>),
	): MotokoCanisterBuilder<
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
				build: makeMotokoBuildTask<P>(canisterConfigOrFn),
			},
		} satisfies CanisterScope<_SERVICE, D, P>
		return new MotokoCanisterBuilder(updatedScope)
	}

	installArgs(
		installArgsFn: (args: {
			ctx: TaskCtxShape
			deps: ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
			mode: string
		}) => I | Promise<I>,
	): MotokoCanisterBuilder<
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
		>()
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

		return new MotokoCanisterBuilder(updatedScope)
	}

	deps<UP extends Record<string, AllowedDep>, NP extends NormalizeDeps<UP>>(
		providedDeps: ValidProvidedDeps<D, UP>,
	): MotokoCanisterBuilder<
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
		return new MotokoCanisterBuilder(updatedScope)
	}

	dependsOn<
		UD extends Record<string, AllowedDep>,
		ND extends NormalizeDeps<UD>,
	>(
		dependencies: UD,
	): MotokoCanisterBuilder<
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
		return new MotokoCanisterBuilder(updatedScope)
	}

	make(
		this: IsValid<S> extends true
			? MotokoCanisterBuilder<I, S, D, P, Config, _SERVICE>
			: DependencyMismatchError<S>,
	): S {
		// Otherwise we get a type error
		const self = this as MotokoCanisterBuilder<I, S, D, P, Config, _SERVICE>
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
	const initialScope = {
		_tag: "scope",
		id: Symbol("scope"),
		tags: [Tags.CANISTER, Tags.MOTOKO],
		description: "some description",
		defaultTask: "deploy",
		children: {
			create: makeCreateTask(canisterConfigOrFn, [Tags.MOTOKO]),
			build: makeMotokoBuildTask(canisterConfigOrFn),
			bindings: makeMotokoBindingsTask(),
			stop: makeStopTask(),
			remove: makeRemoveTask(),
			install: makeInstallTask<I, Record<string, unknown>, _SERVICE>(),
			deploy: makeDeployTask([Tags.MOTOKO]),
			status: makeCanisterStatusTask([Tags.MOTOKO]),
		},
	} satisfies CanisterScope

	return new MotokoCanisterBuilder<I, CanisterScope<_SERVICE, {}, {}>, {}, {}, MotokoCanisterConfig, _SERVICE>(initialScope)
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
