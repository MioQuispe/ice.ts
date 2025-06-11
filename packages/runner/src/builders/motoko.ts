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
	iceDirName,
} from "./custom.js"
import { TaskInfo } from "../tasks/run.js"
import { generateDIDJS, compileMotokoCanister } from "../canister.js"
import type {
	CanisterBuilder,
	CanisterScope,
	UniformScopeCheck,
	MergeScopeDependencies,
	MergeScopeProvide,
	ExtractProvidedDeps,
	ExtractTaskEffectSuccess,
	TaskCtxShape,
} from "./types.js"
import { Tags } from "./types.js"
import { makeCanisterStatusTask, makeDeployTask } from "./lib.js"

type MotokoCanisterConfig = {
	src: string
	canisterId?: string
}

export const makeMotokoBindingsTask = () => {
	return {
		_tag: "task",
		id: Symbol("motokoCanister/bindings"),
		dependencies: {},
		provide: {},
		// TODO: do we allow a fn as args here?
		effect: Effect.gen(function* () {
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const appDir = yield* Config.string("APP_DIR")
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
		computeCacheKey: Option.none(),
		input: Option.none(),
		namedParams: {},
		positionalParams: [],
		params: {},
	} satisfies Task
}

// const plugins = <T extends TaskTreeNode>(taskTree: T) =>
//   deployTaskPlugin(taskTree)

const makeMotokoBuildTask = <P extends Record<string, unknown>>(
	canisterConfigOrFn:
		| ((args: { ctx: TaskCtxShape; deps: P }) => Promise<MotokoCanisterConfig>)
		| ((args: { ctx: TaskCtxShape; deps: P }) => MotokoCanisterConfig)
		| MotokoCanisterConfig,
) => {
	return {
		_tag: "task",
		id: Symbol("motokoCanister/build"),
		dependencies: {},
		provide: {},
		input: Option.none(),
		computeCacheKey: Option.none(),
		effect: Effect.gen(function* () {
			const path = yield* Path.Path
			const fs = yield* FileSystem.FileSystem
			const appDir = yield* Config.string("APP_DIR")
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
			yield* compileMotokoCanister(
				path.resolve(appDir, canisterConfig.src),
				canisterName,
				wasmOutputFilePath,
			)
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
		dependencies: {},
		provide: {},
		input: Option.none(),
		computeCacheKey: Option.none(),
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

export const makeMotokoBuilder = <
	I,
	S extends CanisterScope,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	Config extends MotokoCanisterConfig,
	_SERVICE = unknown,
>(
	scope: S,
): CanisterBuilder<I, S, D, P, Config> => {
	return {
		create: (canisterConfigOrFn) => {
			const updatedScope = {
				...scope,
				children: {
					...scope.children,
					create: makeCreateTask(canisterConfigOrFn, [Tags.MOTOKO]),
				},
			} satisfies CanisterScope
			return makeMotokoBuilder<I, typeof updatedScope, D, P, Config, _SERVICE>(
				updatedScope,
			)
		},

		installArgs: (installArgsFn) => {
			// TODO: is this a flag, arg, or what?
			const mode = "install"
			// we need to inject dependencies again! or they can be overwritten
			const dependencies = scope.children.install.dependencies
			const provide = scope.children.install.provide
			const installTask = makeInstallTask<
				I,
				ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>,
				_SERVICE
			>(installArgsFn)
			const updatedScope = {
				...scope,
				children: {
					...scope.children,
					install: {
						...installTask,
						dependencies,
						provide,
					},
				},
			} satisfies CanisterScope
			return makeMotokoBuilder<I, typeof updatedScope, D, P, Config, _SERVICE>(
				updatedScope,
			)
		},

		build: (canisterConfigOrFn) => {
			const updatedScope = {
				...scope,
				children: {
					...scope.children,
					build: makeMotokoBuildTask(canisterConfigOrFn),
				},
			} satisfies CanisterScope
			return makeMotokoBuilder<I, typeof updatedScope, D, P, Config, _SERVICE>(
				updatedScope,
			)
		},

		dependsOn: (dependencies) => {
			// TODO: check that its a canister builder
			const finalDeps = Object.fromEntries(
				Object.entries(dependencies).map(([key, dep]) => {
					// if (dep._tag === "builder") {
					//   return dep._scope.children.deploy
					// }
					// if (dep._tag === "scope" && dep.children.deploy) {
					//   return [key, dep.children.deploy]
					// }
					if ("provides" in dep) {
						return [key, dep.provides]
					}
					return [key, dep satisfies Task]
				}),
			) satisfies Record<string, Task>

			const updatedScope = {
				...scope,
				children: {
					...scope.children,
					install: {
						...scope.children.install,
						dependencies: finalDeps,
					},
				},
			} satisfies CanisterScope as MergeScopeDependencies<
				S,
				ExtractProvidedDeps<typeof dependencies>
			>

			return makeMotokoBuilder<
				I,
				typeof updatedScope,
				// TODO: update type?
				ExtractProvidedDeps<typeof dependencies>,
				P,
				Config
			>(updatedScope)
		},

		deps: (providedDeps) => {
			// TODO: do we transform here?
			// TODO: do we type check here?
			const finalDeps = Object.fromEntries(
				Object.entries(providedDeps).map(([key, dep]) => {
					// if (dep._tag === "builder") {
					//   return dep._scope.children.deploy
					// }
					// if (dep._tag === "scope" && dep.children.deploy) {
					//   return [key, dep.children.deploy]
					// }
					if ("provides" in dep) {
						return [key, dep.provides]
					}
					return [key, dep satisfies Task]
				}),
			) satisfies Record<string, Task>

			// TODO: do we need to pass in to create as well?
			const updatedScope = {
				...scope,
				children: {
					...scope.children,
					install: {
						...scope.children.install,
						provide: finalDeps,
					},
				},
			} satisfies CanisterScope as MergeScopeProvide<
				S,
				ExtractProvidedDeps<typeof providedDeps>
			>

			return makeMotokoBuilder<
				I,
				typeof updatedScope,
				D,
				// TODO: update type?
				ExtractProvidedDeps<typeof providedDeps>,
				Config
			>(updatedScope)
		},

		make: () => {
			return {
				...scope,
				id: Symbol("scope"),
				children: Record.map(scope.children, (value) => ({
					...value,
					id: Symbol("task"),
				})),
			} satisfies CanisterScope as unknown as UniformScopeCheck<S>
		},

		// Add scope property to the initial builder
		_tag: "builder",
	}
}

export const motokoCanister = <
	I = unknown,
	_SERVICE = unknown,
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
		defaultTask: Option.none(),
		children: {
			create: makeCreateTask(canisterConfigOrFn, [Tags.MOTOKO]),
			build: makeMotokoBuildTask(canisterConfigOrFn),
			bindings: makeMotokoBindingsTask(),
			stop: makeStopTask(),
			// remove: makeRemoveTask(),
			install: makeInstallTask<I, Record<string, unknown>, _SERVICE>(),
			deploy: makeDeployTask([Tags.MOTOKO]),
			status: makeCanisterStatusTask([Tags.MOTOKO]),
		},
	} satisfies CanisterScope

	return makeMotokoBuilder<
		I,
		typeof initialScope,
		Record<string, Task>,
		Record<string, Task>,
		MotokoCanisterConfig,
		_SERVICE
	>(initialScope)
}

const testTask = {
	_tag: "task",
	id: Symbol("test"),
	dependencies: {},
	provide: {},
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	computeCacheKey: Option.none(),
	input: Option.none(),
	namedParams: {},
	positionalParams: [],
	params: {},
} satisfies Task

const testTask2 = {
	_tag: "task",
	id: Symbol("test"),
	dependencies: {},
	provide: {},
	effect: Effect.gen(function* () {}),
	description: "",
	tags: [],
	computeCacheKey: Option.none(),
	input: Option.none(),
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
	computeCacheKey: Option.none(),
	input: Option.none(),
	dependencies: {
		test: testTask,
	},
	provide: {
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
	computeCacheKey: Option.none(),
	input: Option.none(),
	dependencies: {
		test: testTask,
		test2: testTask,
	},
	provide: {
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
	computeCacheKey: Option.none(),
	input: Option.none(),
	dependencies: {
		test: testTask,
		// test2: testTask,
	},
	provide: {
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
	defaultTask: Option.none(),
	children: {
		providedTask,
		unProvidedTask,
	},
} satisfies CanisterScope

const testScope2 = {
	_tag: "scope",
	id: Symbol("scope"),
	tags: [Tags.CANISTER],
	description: "",
	defaultTask: Option.none(),
	children: {
		unProvidedTask2,
	},
} satisfies CanisterScope

const providedTestScope = {
	_tag: "scope",
	id: Symbol("scope"),
	tags: [Tags.CANISTER],
	description: "",
	defaultTask: Option.none(),
	children: {
		providedTask,
	},
} satisfies CanisterScope

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
