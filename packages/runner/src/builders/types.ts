import type { Task } from "../types/types.js"
import type { TaskCtxShape } from "../index.js"
import type { Effect } from "effect"

type DependenciesOf<T> = T extends { dependencies: infer D } ? D : never
type ProvideOf<T> = T extends { provide: infer P } ? P : never
export type DepBuilder<T> =
  DependenciesOf<T> extends ProvideOf<T>
    ? ProvideOf<T> extends DependenciesOf<T>
      ? T
      : never
    : never
export type UniformScopeCheck<S extends CanisterScope> = S extends {
  children: infer C
}
  ? C extends { [K in keyof C]: DepBuilder<C[K]> }
    ? S
    : DependencyMismatchError
  : DependencyMismatchError

type MergeTaskDeps<T extends Task, ND extends Record<string, Task>> = {
  [K in keyof T]: K extends "dependencies" ? T[K] & ND : T[K]
}

type MergeTaskProvide<T extends Task, NP extends Record<string, Task>> = {
  [K in keyof T]: K extends "provide" ? T[K] & NP : T[K]
}

/**
 * Update every task in the children record by merging in ND.
 */
type MergeAllChildrenDeps<
  C extends Record<string, Task>,
  ND extends Record<string, Task>,
> = {
  [K in keyof C]: MergeTaskDeps<C[K], ND>
}

type MergeAllChildrenProvide<
  C extends Record<string, Task>,
  NP extends Record<string, Task>,
> = {
  [K in keyof C]: MergeTaskProvide<C[K], NP>
}
/**
 * Merge new dependencies ND into the entire scope S by updating its children.
 */
export type MergeScopeDependencies<
  S extends CanisterScope,
  ND extends Record<string, Task>,
> = Omit<S, "children"> & {
  children: MergeAllChildrenDeps<S["children"], ND>
}

export type MergeScopeProvide<
  S extends CanisterScope,
  NP extends Record<string, Task>,
> = Omit<S, "children"> & {
  children: MergeAllChildrenProvide<S["children"], NP>
}

/**
 * Extracts the success type of the Effect from each Task in a Record<string, Task>.
 *
 * @template T - A record of tasks.
 */
export type ExtractTaskEffectSuccess<T extends Record<string, Task>> = {
  [K in keyof T]: Effect.Effect.Success<T[K]["effect"]>
}


/**
 * @doc
 * [ERROR] Missing required dependencies:
 * Please call .setDependencies() with all required keys before finalizing the builder.
 */
export type DependencyMismatchError = {
  // This property key is your custom error message.
  "[CRYSTAL-ERROR: Dependency mismatch. Please provide all required dependencies.]": true
}

// Compute a boolean flag from our check.
export type IsValid<S extends CanisterScope> =
  UniformScopeCheck<S> extends DependencyMismatchError ? false : true

export type CanisterScope = {
  _tag: "scope"
  tags: Array<string>
  description: string
  // only limited to tasks
  children: Record<string, Task>
}

export interface CanisterBuilder<
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  Config,
> {
  create: (
    canisterConfigOrFn:
      | Config
      | ((ctx: TaskCtxShape) => Config)
      | ((ctx: TaskCtxShape) => Promise<Config>),
  ) => CanisterBuilder<I, S, D, P, Config>
  // install: (
  //   installArgsOrFn:
  //     | ((args: { ctx: TaskCtxShape<P>; mode: string }) => Promise<I>)
  //     | ((args: { ctx: TaskCtxShape<P>; mode: string }) => I)
  //     // | I,
  // ) => CanisterBuilder<I, S, D, P, Config>

  // TODO: due to TS limitations we cannot overload the install method with an object signature
  // the type inference will fail and the type becomes any
  // Overload signatures for install:

  // install(installArgsOrFn: I): CanisterBuilder<I, S, D, P, Config>

  // only allow functions for now
  install(
    installArgsFn: (args: {
      ctx: TaskCtxShape<ExtractTaskEffectSuccess<P>>
      mode: string
    }) => I | Promise<I>,
  ): CanisterBuilder<I, S, D, P, Config>

  build: (
    canisterConfigOrFn:
      | Config
      | ((ctx: TaskCtxShape) => Config)
      | ((ctx: TaskCtxShape) => Promise<Config>),
  ) => CanisterBuilder<I, S, D, P, Config>
  deps: <ND extends Record<string, Task>>(
    deps: ND,
  ) => CanisterBuilder<I, MergeScopeDependencies<S, ND>, ND, P, Config>
  provide: <NP extends Record<string, Task>>(
    providedDeps: NP,
  ) => CanisterBuilder<I, MergeScopeProvide<S, NP>, D, NP, Config>
  // done: () => UniformScopeCheck<S extends CanisterScope ? S : never>
  // done: () => S
  /**
   * Finalizes the builder state.
   *
   * This method is only callable if the builder is in a valid state. If not,
   * the builder does not have the required dependency fields and this method
   * will produce a compile-time error with a descriptive message.
   *
   * @returns The finalized builder state if valid.
   */
  done(
    this: IsValid<S> extends true
      ? CanisterBuilder<I, S, D, P, Config>
      : DependencyMismatchError,
  ): UniformScopeCheck<S>

  // TODO:
  //   bindings: (fn: (args: { ctx: TaskCtxShape }) => Promise<I>) => CanisterBuilder<I>
  // Internal property to store the current scope
  _scope: S
  _tag: "builder"
}

export const Tags = {
  CANISTER: "$$crystal/canister",
  CREATE: "$$crystal/create",
  BUILD: "$$crystal/build",
  INSTALL: "$$crystal/install",
  BINDINGS: "$$crystal/bindings",
  DEPLOY: "$$crystal/deploy",
  DELETE: "$$crystal/delete",
  UI: "$$crystal/ui",
  // TODO: hmm do we need this?
  SCRIPT: "$$crystal/script",
}
