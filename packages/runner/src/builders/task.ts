import type { CanisterConstructor, Task } from "../types/types.js"
import { Effect, Option } from "effect"
import type {
	ExtractTaskEffectSuccess,
	MergeTaskDeps,
	MergeTaskProvide,
	CanisterScope,
} from "./types.js"
import { TaskCtx } from "../tasks/lib.js"
import { TaskInfo } from "../tasks/run.js"
import { DependencyResults } from "../tasks/run.js"
import { runWithPatchedConsole } from "../utils/instrumentActor.js"
import { Tags, type TaskCtxShape } from "./types.js"

function normalizeDep(dep: Task | CanisterScope | CanisterConstructor): Task {
	if ("_tag" in dep && dep._tag === "task") return dep
	if ("provides" in dep) return dep.provides as Task
	if ("_tag" in dep && dep._tag === "scope" && dep.children?.install)
		return dep.children.install as Task
	throw new Error("Invalid dependency type provided to normalizeDep")
}
//
// Existing types
//

type AllowedDep = Task | CanisterScope | CanisterConstructor

/**
 * If T is already a Task, it stays the same.
 * If T is a CanisterScope, returns its provided Task (assumed to be under the "provides" property).
 */
type NormalizeDep<T> = T extends Task
	? T
	: T extends CanisterConstructor
		? T["provides"] extends Task
			? T["provides"]
			: never
		: T extends CanisterScope
			? T["children"]["install"] extends Task
				? T["children"]["install"]
				: never
			: never

/**
 * Normalizes a record of dependencies.
 */
type NormalizeDeps<Deps extends Record<string, AllowedDep>> = {
	[K in keyof Deps]: NormalizeDep<Deps[K]> extends Task
		? NormalizeDep<Deps[K]>
		: never
}

type ValidProvidedDeps<
	D extends Record<string, AllowedDep>,
	NP extends Record<string, AllowedDep>,
> = CompareTaskEffects<NormalizeDeps<D>, NormalizeDeps<NP>> extends never
	? never
	: NP

type CompareTaskEffects<
	D extends Record<string, Task>,
	P extends Record<string, Task>,
> = (keyof D extends keyof P ? true : false) extends true
	? {
			[K in keyof D & keyof P]: TaskReturnValue<D[K]> extends TaskReturnValue<
				P[K]
			>
				? never
				: K
		}[keyof D & keyof P] extends never
		? P
		: never
	: never

type TaskReturnValue<T extends Task> = T extends {
	effect: Effect.Effect<infer S, any, any>
}
	? S
	: never

//
// Builder Phase Interfaces
//

/**
 * The builder returned from `task()` which allows:
 * - Adding dependencies (.deps())
 * - Providing dependencies (.provide())
 * - Finalizing the task with an effect (.run())
 */
interface TaskBuilderInitial<
	I,
	T extends Task,
	D extends Record<string, Task> = {},
	P extends Record<string, Task> = {},
> {
	dependsOn<ND extends Record<string, AllowedDep>>(
		deps: ND,
	): TaskBuilderDeps<
		I,
		MergeTaskDeps<T, NormalizeDeps<ND>>,
		NormalizeDeps<ND>,
		P
	>
	deps<NP extends Record<string, AllowedDep>>(
		providedDeps: ValidProvidedDeps<D, NP>,
	): TaskBuilderProvide<
		I,
		MergeTaskProvide<T, NormalizeDeps<ValidProvidedDeps<D, NP>>>,
		D,
		NormalizeDeps<ValidProvidedDeps<D, NP>>
	>
	run<Output>(
		fn: (args: {
			ctx: TaskCtxShape
			deps: ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
		}) => Promise<Output>,
	): TaskBuilderRun<
		I,
		Omit<T, "effect"> & {
			effect: Effect.Effect<
				Output,
				Error,
				TaskCtx | TaskInfo | DependencyResults
			>
		},
		D,
		P
	>
}

/**
 * Builder phase after calling .deps(). Only .provide() is allowed next.
 */
interface TaskBuilderDeps<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
> {
	deps<NP extends Record<string, AllowedDep>>(
		providedDeps: ValidProvidedDeps<D, NP>,
	): TaskBuilderProvide<
		I,
		MergeTaskProvide<T, NormalizeDeps<ValidProvidedDeps<D, NP>>>,
		D,
		NormalizeDeps<ValidProvidedDeps<D, NP>>
	>
}

/**
 * Builder phase after calling .provide(). Only .run() is allowed next.
 */
interface TaskBuilderProvide<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
> {
	run<Output>(
		fn: (args: {
			ctx: TaskCtxShape
			deps: ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
		}) => Promise<Output>,
	): TaskBuilderRun<
		I,
		Omit<T, "effect"> & {
			effect: Effect.Effect<
				Output,
				Error,
				TaskCtx | TaskInfo | DependencyResults
			>
		},
		D,
		P
	>
}

/**
 * Builder phase after calling .run(), which is final.
 */
interface TaskBuilderRun<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
> {
	done(): T
	_tag: "builder"
}

//
// Helper Functions
//

/**
 * Normalizes a record of dependencies.
 */
function normalizeDepsMap(
	dependencies: Record<string, AllowedDep>,
): Record<string, Task> {
	return Object.fromEntries(
		Object.entries(dependencies).map(([key, dep]) => [key, normalizeDep(dep)]),
	)
}

/**
 * Helper for executing the run logic without duplicating code.
 */
function runTask<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	Output,
>(
	task: T,
	fn: (args: {
		ctx: TaskCtxShape
		deps: ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
	}) => Promise<Output>,
): TaskBuilderRun<
	I,
	Omit<T, "effect"> & {
		effect: Effect.Effect<Output, Error, TaskCtx | TaskInfo | DependencyResults>
	},
	D,
	P
> {
	const newTask = {
		...task,
		effect: Effect.gen(function* () {
			const taskCtx = yield* TaskCtx
			const taskInfo = yield* TaskInfo
			const { dependencies } = yield* DependencyResults
			const result = yield* Effect.tryPromise({
				try: () =>
					runWithPatchedConsole(() =>
						fn({
							ctx: taskCtx,
							deps: dependencies as ExtractTaskEffectSuccess<P> &
								ExtractTaskEffectSuccess<D>,
						}),
					),
				catch: (error) => {
					console.error("Error executing task:", error)
					return error instanceof Error ? error : new Error(String(error))
				},
			})
			return result
		}),
	} satisfies Task

	return makeTaskBuilderRun<I, typeof newTask, D, P>(newTask)
}

/**
 * Shared handler for the `.deps()` transition.
 */
function handleDeps<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	ND extends Record<string, AllowedDep>,
>(
	task: T,
	dependencies: ND,
): TaskBuilderDeps<
	I,
	MergeTaskDeps<T, NormalizeDeps<ND>>,
	NormalizeDeps<ND>,
	P
> {
	const finalDeps = normalizeDepsMap(dependencies) as NormalizeDeps<
		typeof dependencies
	>
	const updatedTask = {
		...task,
		dependencies: finalDeps,
	} satisfies Task as MergeTaskDeps<T, NormalizeDeps<typeof dependencies>>
	return makeTaskBuilderDeps<
		I,
		typeof updatedTask,
		NormalizeDeps<typeof dependencies>,
		P
	>(updatedTask)
}

/**
 * Shared handler for the `.provide()` transition.
 */
function handleProvide<
	I,
	T extends Task,
	D extends Record<string, Task>,
	NP extends Record<string, AllowedDep>,
>(
	task: T,
	providedDeps: NP,
): TaskBuilderProvide<
	I,
	MergeTaskProvide<T, NormalizeDeps<ValidProvidedDeps<D, NP>>>,
	D,
	NormalizeDeps<ValidProvidedDeps<D, NP>>
> {
	const finalDeps = normalizeDepsMap(providedDeps) as NormalizeDeps<
		typeof providedDeps
	>
	const updatedTask = {
		...task,
		provide: finalDeps,
	} satisfies Task as MergeTaskProvide<
		T,
		NormalizeDeps<ValidProvidedDeps<D, typeof providedDeps>>
	>
	return makeTaskBuilderProvide<
		I,
		typeof updatedTask,
		D,
		NormalizeDeps<ValidProvidedDeps<D, typeof providedDeps>>
	>(updatedTask)
}

//
// Builder Phase Implementations
//

/**
 * Initial phase: returned by task(). Allows .deps(), .provide(), and .run().
 */
function makeTaskBuilderInitial<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
>(task: T): TaskBuilderInitial<I, T, D, P> {
	return {
		dependsOn: (dependencies) =>
			handleDeps<I, T, D, P, typeof dependencies>(task, dependencies),
		deps: (providedDeps) =>
			handleProvide<I, T, D, typeof providedDeps>(task, providedDeps),
		run: (fn) => runTask<I, T, D, P, any>(task, fn),
	}
}

/**
 * Deps phase: only .provide() is allowed.
 */
function makeTaskBuilderDeps<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
>(task: T): TaskBuilderDeps<I, T, D, P> {
	return {
		deps: (providedDeps) =>
			handleProvide<I, T, D, typeof providedDeps>(task, providedDeps),
	}
}

/**
 * Provide phase: only .run() is allowed.
 */
function makeTaskBuilderProvide<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
>(task: T): TaskBuilderProvide<I, T, D, P> {
	return {
		run: (fn) => runTask<I, T, D, P, any>(task, fn),
	}
}

/**
 * Run phase: only .done() is allowed.
 */
function makeTaskBuilderRun<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
>(task: T): TaskBuilderRun<I, T, D, P> {
	return {
		done: () => task,
		_tag: "builder",
	}
}

//
// Entry Point
//

export function task<I = unknown>(description = "description") {
	const baseTask: Task = {
		_tag: "task",
		id: Symbol("task"),
		description,
		computeCacheKey: Option.none(),
		input: Option.none(),
		dependencies: {},
		provide: {},
		tags: [],
		effect: Effect.gen(function* () {}),
	}
	return makeTaskBuilderInitial<I, typeof baseTask, {}, {}>(baseTask)
}

//
// Test Cases
//

/** Example A: task -> deps -> provide -> run -> done */
const numberTask = task()
	.run(async () => {
		// returns a number
		return 12
	})
	.done()

const stringTask = task()
	.run(async () => {
		// returns a string
		return "hello"
	})
	.done()

const objTask = task()
	.run(async () => {
		return { a: 1, b: 2 }
	})
	.done()

const canScope = {
	_tag: "scope",
	tags: [],
	description: "canScope",
	defaultTask: Option.none(),
	children: {
		install: objTask,
	},
} satisfies CanisterScope

/** Example B: task -> deps -> provide -> run -> done */
const task2 = task("description of task2")
	.dependsOn({
		depB: numberTask,
		depC: canScope,
	})
	.deps({
		depA: stringTask,
		depC: canScope,
		depB: numberTask,
	})
	.run(async ({ ctx, deps }) => {
		// use provided dependencies from ctx
		deps.depC
		return "hello"
	})
	.done()
