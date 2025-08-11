import { IDL } from "@dfinity/candid";
import { FileSystem, Path } from "@effect/platform";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { type } from "arktype";
import { Data, Effect, Option, Record } from "effect";
import { readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { encodeArgs } from "../canister.js";
import { CanisterIdsService } from "../services/canisterIds.js";
import {
  CanisterStatus,
  type CanisterStatusResult,
  InstallModes,
} from "../services/replica.js";
import { TaskRegistry } from "../services/taskRegistry.js";
import type {
  ParamsToArgs,
  TaskCtxShape,
  TaskParamsToArgs,
  TaskSuccess,
} from "../tasks/lib.js";
import { getNodeByPath, TaskCtx } from "../tasks/lib.js";
import { runTask } from "../tasks/run.js";
import type { ActorSubclass } from "../types/actor.js";
import type { CachedTask, Task } from "../types/types.js";
import { proxyActor } from "../utils/extension.js";
import { ExtractArgsFromTaskParams } from "./task.js";
import { deployParams } from "./custom.js";
export type { TaskCtxShape };

export class TaskError extends Data.TaggedError("TaskError")<{
  message?: string;
  op?: string;
}> {}

export const loadCanisterId = (taskPath: string) =>
  Effect.gen(function* () {
    const canisterName = taskPath.split(":").slice(0, -1).join(":");
    const canisterIdsService = yield* CanisterIdsService;
    const canisterIds = yield* canisterIdsService.getCanisterIds();
    const { currentNetwork } = yield* TaskCtx;
    const canisterId = canisterIds[canisterName]?.[currentNetwork];
    if (canisterId) {
      return Option.some(canisterId as string);
    }
    return Option.none();
  });

export const resolveConfig = <T, P extends Record<string, unknown>>(
  configOrFn:
    | ((args: { ctx: TaskCtxShape; deps: P }) => Promise<T>)
    | ((args: { ctx: TaskCtxShape; deps: P }) => T)
    | T
) =>
  Effect.gen(function* () {
    const taskCtx = yield* TaskCtx;
    if (typeof configOrFn === "function") {
      const configFn = configOrFn as (args: {
        ctx: TaskCtxShape;
      }) => Promise<T> | T;
      const configResult = configFn({ ctx: taskCtx });
      if (configResult instanceof Promise) {
        return yield* Effect.tryPromise({
          try: () => configResult,
          catch: (error) => {
            return new TaskError({ message: String(error) });
          },
        });
      }
      return configResult;
    }
    return configOrFn;
  });

export type CreateConfig = {
  canisterId?: string;
};
export const makeCreateTask = <P extends Record<string, unknown>>(
  canisterConfigOrFn:
    | ((args: { ctx: TaskCtxShape; deps: P }) => Promise<CreateConfig>)
    | ((args: { ctx: TaskCtxShape; deps: P }) => CreateConfig)
    | CreateConfig,
  tags: string[] = []
): CreateTask => {
  const id = Symbol("canister/create");
  return {
    _tag: "task",
    id,
    dependsOn: {},
    dependencies: {},
    effect: Effect.gen(function* () {
      const path = yield* Path.Path;
      const fs = yield* FileSystem.FileSystem;
      const canisterIdsService = yield* CanisterIdsService;
      const taskCtx = yield* TaskCtx;
      const currentNetwork = taskCtx.currentNetwork;
      const { taskPath } = yield* TaskCtx;
      const canisterName = taskPath.split(":").slice(0, -1).join(":");
      const storedCanisterIds = yield* canisterIdsService.getCanisterIds();
      const storedCanisterId: string | undefined =
        storedCanisterIds[canisterName]?.[currentNetwork];
      yield* Effect.logDebug("makeCreateTask", { storedCanisterId });
      const canisterConfig = yield* resolveConfig(canisterConfigOrFn);
      const configCanisterId = canisterConfig?.canisterId;
      // TODO: handle all edge cases related to this. what happens
      // if the user provides a new canisterId in the config? and so on
      // and how about mainnet?
      const resolvedCanisterId = storedCanisterId ?? configCanisterId;
      const {
        roles: {
          deployer: { identity },
        },
        replica,
      } = yield* TaskCtx;
      yield* Effect.logDebug("resolvedCanisterId", { resolvedCanisterId });
      const canisterInfo = resolvedCanisterId
        ? yield* replica
            .getCanisterInfo({
              canisterId: resolvedCanisterId,
              identity,
            })
            .pipe(
              Effect.catchTag("CanisterStatusError", (err) => {
                return Effect.succeed({
                  status: CanisterStatus.NOT_FOUND,
                });
              })
            )
        : {
            status: CanisterStatus.NOT_FOUND,
          };
      const isAlreadyInstalled =
        resolvedCanisterId && canisterInfo.status !== CanisterStatus.NOT_FOUND;

      yield* Effect.logDebug("makeCreateTask", {
        isAlreadyInstalled,
        resolvedCanisterId,
      });

      const canisterId = isAlreadyInstalled
        ? resolvedCanisterId
        : yield* replica.createCanister({
            canisterId: resolvedCanisterId,
            identity,
          });
      const { appDir, iceDir } = yield* TaskCtx;
      yield* Effect.logDebug("create Task: setting canisterId", canisterId);
      // TODO: integrate with cache?
      yield* canisterIdsService.setCanisterId({
        canisterName,
        network: taskCtx.currentNetwork,
        canisterId,
      });
      const outDir = path.join(appDir, iceDir, "canisters", canisterName);
      yield* fs.makeDirectory(outDir, { recursive: true });
      return canisterId;
    }),
    description: "Create custom canister",
    // TODO: caching? now task handles it already
    tags: [Tags.CANISTER, Tags.CREATE, ...tags],
    namedParams: {},
    positionalParams: [],
    params: {},
  } satisfies CreateTask;
};

export function hashUint8(data: Uint8Array): string {
  // noble/sha256 is universal (no Buffer, no crypto module)
  return bytesToHex(sha256(data));
}

// ensure deterministic key order
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      // sort *all* object keys deterministically
      return Object.keys(val)
        .sort()
        .reduce<Record<string, unknown>>(
          (acc, k) => ((acc[k] = (val as any)[k]), acc),
          {}
        );
    }
    return val; // primitives & arrays unchanged
  });
}

export function hashJson(value: unknown): string {
  const ordered = stableStringify(value);
  return hashUint8(utf8ToBytes(ordered));
}

export type FileDigest = {
  path: string;
  mtimeMs: number;
  sha256: string;
};

export function digestFile(path: string): FileDigest {
  const buf = readFileSync(path);
  return {
    path,
    // mtimeMs: statSync(path).mtimeMs,
    // TODO:
    mtimeMs: 0,
    sha256: bytesToHex(sha256(buf)),
  };
}

export async function isArtifactCached(
  path: string,
  prev: FileDigest | undefined // last run (undefined = cache miss)
): Promise<{ fresh: boolean; digest: FileDigest }> {
  // No previous record – must rebuild
  if (!prev) {
    return { fresh: false, digest: digestFile(path) };
  }

  // 1️⃣ fast-path : stat only
  const currentStat = await stat(path);
  if (currentStat.mtimeMs === prev.mtimeMs) {
    return { fresh: true, digest: prev }; // timestamps match ⟹ assume fresh
  }

  // 2️⃣ slow-path : hash check
  const digest = digestFile(path);
  const fresh = digest.sha256 === prev.sha256;
  return { fresh, digest };
}

export const digestFileEffect = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const buf = yield* fs.readFile(path);
    const stat = yield* fs.stat(path);
    const mtimeMs = Option.isSome(stat.mtime) ? stat.mtime.value.getTime() : 0;
    return {
      path,
      mtimeMs,
      sha256: bytesToHex(sha256(buf)),
    };
  });

export const isArtifactCachedEffect = (
  path: string,
  prev: FileDigest | undefined // last run (undefined = cache miss)
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    // No previous record – must rebuild
    if (!prev) {
      const digest = yield* digestFileEffect(path);
      return { fresh: false, digest };
    }

    // 1️⃣ fast-path : stat only
    const currentStat = yield* fs.stat(path);
    const mtimeMs = Option.isSome(currentStat.mtime)
      ? currentStat.mtime.value.getTime()
      : 0;
    if (mtimeMs === prev.mtimeMs) {
      return { fresh: true, digest: prev }; // timestamps match ⟹ assume fresh
    }

    // 2️⃣ slow-path : hash check
    const digest = yield* digestFileEffect(path);
    const fresh = digest.sha256 === prev.sha256;
    return { fresh, digest };
  });

/**
 * Hash the *transpiled* JS produced by tsx/ESBuild,
 * normalising obvious sources of noise (WS, CRLF).
 */
// TODO: support objects as well
export function hashConfig(config: Function | object): string {
  // 1. grab the transpiled source
  let txt =
    typeof config === "function" ? config.toString() : JSON.stringify(config);

  // 2. normalise line-endings and strip leading WS
  txt = txt
    .replace(/\r\n/g, "\n") // CRLF ⇒ LF
    .replace(/^[\s\t]+/gm, "") // leading indent
    .replace(/\s+$/gm, ""); // trailing WS

  // 3. hash
  return bytesToHex(sha256(utf8ToBytes(txt)));
}

export type MergeTaskDependsOn<
  T extends { dependsOn: Record<string, Task> },
  ND extends Record<string, Task>,
> = Omit<T, "dependsOn"> & {
  dependsOn: T["dependsOn"] & ND;
};
// > = {
// 	[K in keyof T]: K extends "dependsOn" ? T[K] & ND : T[K]
// } & Partial<
// 	Pick<
// 		Task,
// 		"computeCacheKey" | "input" | "decode" | "encode" | "encodingFormat"
// 	>
// >

export type MergeTaskDependencies<
  T extends { dependencies: Record<string, Task> },
  P extends Record<string, Task>,
> = Omit<T, "dependencies"> & {
  dependencies: T["dependencies"] & P;
};
// > = {
// 	[K in keyof T]: K extends "dependencies" ? T[K] & NP : T[K]
// } & Partial<
// 	Pick<
// 		Task,
// 		"computeCacheKey" | "input" | "decode" | "encode" | "encodingFormat"
// 	>
// >

export type MergeScopeDependsOn<
  S extends CanisterScopeSimple,
  D extends Record<string, Task>,
> = Omit<S, "children"> & {
  children: Omit<S["children"], "install"> & {
    install: MergeTaskDependsOn<S["children"]["install"], D>;
  };
};

// export type MergeScopeDependencies<
// 	S extends CanisterScope,
// 	NP extends Record<string, Task>,
// > = Omit<S, "children"> & {
// 	children: MergeAllChildrenDependencies<S["children"], NP>
// }

export type MergeScopeDependencies<
  S extends CanisterScopeSimple,
  D extends Record<string, Task>,
> = Omit<S, "children"> & {
  children: Omit<S["children"], "install"> & {
    install: MergeTaskDependencies<S["children"]["install"], D>;
  };
};

/**
 * Extracts the success type of the Effect from each Task in a Record<string, Task>.
 *
 * @template T - A record of tasks.
 */
export type ExtractScopeSuccesses<T extends Record<string, Task>> = {
  [K in keyof T]: TaskSuccess<T[K]>;
};

// TODO: create types
export type CreateTask = Task<string>;
export type BindingsTask = CachedTask<
  {
    didJSPath: string;
    didTSPath: string;
  },
  {},
  {},
  {
    taskPath: string;
    depCacheKeys: Record<string, string | undefined>;
  }
>;
export type BuildTask = CachedTask<
  {
    wasmPath: string;
    candidPath: string;
  },
  {},
  {},
  {
    canisterName: string;
    taskPath: string;
    wasm: FileDigest;
    candid: FileDigest;
    depCacheKeys: Record<string, string | undefined>;
  }
>;

export type InstallTask<
  _SERVICE = unknown,
  I = unknown,
  D extends Record<string, Task> = {},
  P extends Record<string, Task> = {},
> = Omit<
  CachedTask<
    {
      canisterId: string;
      canisterName: string;
      actor: ActorSubclass<_SERVICE>;
      mode: InstallModes;
      args: I;
      encodedArgs: Uint8Array<ArrayBufferLike>;
    },
    D,
    P,
    {
      network: string;
      canisterId: string;
      canisterName: string;
      taskPath: string;
      mode: string;
      depCacheKeys: Record<string, string | undefined>;
      installArgsFn: Function;
    }
  >,
  "params"
> & {
  params: typeof installParams;
};

// D,
// P
export type StopTask = Task<void>;
export type RemoveTask = Task<void>;
export type DeployTask<
  _SERVICE = unknown,
  D extends Record<string, Task> = {},
  P extends Record<string, Task> = {},
> = Omit<
  Task<
    {
      canisterId: string;
      canisterName: string;
      actor: ActorSubclass<_SERVICE>;
      mode: InstallModes;
    },
    D,
    P
  >,
  "params"
> & {
  params: typeof deployParams;
};

// InstallTask<_SERVICE>
export type StatusTask = Task<{
  canisterName: string;
  canisterId: string | undefined;
  status: CanisterStatus;
  info: CanisterStatusResult | undefined;
}>;

// TODO: use Scope type
export type CanisterScope<
  _SERVICE = unknown,
  I = unknown,
  U = unknown,
  D extends Record<string, Task> = Record<string, Task>,
  P extends Record<string, Task> = Record<string, Task>,
> = {
  _tag: "scope";
  id: symbol;
  tags: Array<string | symbol>;
  description: string;
  defaultTask: "deploy";
  // only limited to tasks
  // children: Record<string, Task>
  children: {
    // create: Task<string>
    create: CreateTask;
    bindings: BindingsTask;
    build: BuildTask;
    install: InstallTask<_SERVICE, I, D, P>;
    upgrade: InstallTask<_SERVICE, U, D, P>;
    // D,
    // P
    stop: StopTask;
    remove: RemoveTask;
    deploy: DeployTask<_SERVICE>;
    status: StatusTask;
  };
};

export type CanisterScopeSimple = {
  _tag: "scope";
  id: symbol;
  tags: Array<string | symbol>;
  description: string;
  defaultTask: "deploy";
  // only limited to tasks
  // children: Record<string, Task>
  children: {
    // create: Task<string>
    create: Task;
    bindings: Task;
    build: Task;
    install: Task;
    upgrade: Task;
    // D,
    // P
    stop: Task;
    remove: Task;
    // TODO: same as install?
    deploy: Task;
    status: Task;
  };
};

export const Tags = {
  HIDDEN: "$$ice/hidden",

  CANISTER: "$$ice/canister",
  CUSTOM: "$$ice/canister/custom",
  MOTOKO: "$$ice/canister/motoko",
  RUST: "$$ice/canister/rust",
  AZLE: "$$ice/canister/azle",
  KYBRA: "$$ice/canister/kybra",

  CREATE: "$$ice/canister/create",
  STATUS: "$$ice/canister/status",
  BUILD: "$$ice/canister/build",
  INSTALL: "$$ice/canister/install",
  UPGRADE: "$$ice/canister/upgrade",
  BINDINGS: "$$ice/canister/bindings",
  DEPLOY: "$$ice/canister/deploy",
  STOP: "$$ice/canister/stop",
  REMOVE: "$$ice/canister/remove",
  UI: "$$ice/canister/ui",
};

// TODO: dont pass in tags, just make the effect

export type TaskReturnValue<T extends Task> = T extends {
  effect: Effect.Effect<infer S, any, any>;
}
  ? S
  : never;

export type CompareTaskEffects<
  D extends Record<string, Task>,
  P extends Record<string, Task>,
> = (keyof D extends keyof P ? true : false) extends true
  ? {
      [K in keyof D & keyof P]: TaskReturnValue<D[K]> extends TaskReturnValue<
        P[K]
      >
        ? never
        : K;
    }[keyof D & keyof P] extends never
    ? P
    : never
  : never;

export type AllowedDep = Task | CanisterScopeSimple;

/**
 * If T is already a Task, it stays the same.
 * If T is a CanisterScope, returns its provided Task (assumed to be under the "provides" property).
 */
export type NormalizeDep<T> = T extends Task
  ? T
  : T extends CanisterScopeSimple
    ? T["children"]["deploy"] extends Task
      ? T["children"]["deploy"]
      : never
    : never;

/**
 * Normalizes a record of dependencies.
 */
// export type NormalizeDeps<Deps extends Record<string, AllowedDep>> = {
// 	[K in keyof Deps]: NormalizeDep<Deps[K]> extends Task
// 		? NormalizeDep<Deps[K]>
// 		: never
// }

export type NormalizeDeps<Deps extends Record<string, AllowedDep>> = {
  [K in keyof Deps]: Deps[K] extends Task
    ? Deps[K]
    : Deps[K] extends CanisterScopeSimple
      ? Deps[K]["children"]["deploy"]
      : never;
};

export type ValidProvidedDeps<
  D extends Record<string, AllowedDep>,
  P extends Record<string, AllowedDep>,
> =
  CompareTaskEffects<NormalizeDeps<D>, NormalizeDeps<P>> extends never
    ? never
    : P;

export type CompareTaskReturnValues<T extends Task> = T extends {
  effect: Effect.Effect<infer S, any, any>;
}
  ? S
  : never;

export type DependenciesOf<T> = T extends { dependsOn: infer D } ? D : never;
export type ProvideOf<T> = T extends { dependencies: infer P } ? P : never;

export type DependencyReturnValues<T> =
  DependenciesOf<T> extends Record<string, Task>
    ? {
        [K in keyof DependenciesOf<T>]: CompareTaskReturnValues<
          DependenciesOf<T>[K]
        >;
      }
    : never;

export type ProvideReturnValues<T> =
  ProvideOf<T> extends Record<string, Task>
    ? { [K in keyof ProvideOf<T>]: CompareTaskReturnValues<ProvideOf<T>[K]> }
    : never;

export type DepBuilder<T> =
  Exclude<
    Extract<keyof DependencyReturnValues<T>, string>,
    keyof ProvideReturnValues<T>
  > extends never
    ? DependencyReturnValues<T> extends Pick<
        ProvideReturnValues<T>,
        Extract<keyof DependencyReturnValues<T>, string>
      >
      ? T
      : never
    : never;

export type DependencyMismatchError<S extends CanisterScopeSimple> = {
  // This property key is your custom error message.
  "[ICE-ERROR: Dependency mismatch. Please provide all required dependencies.]": true;
};

export type UniformScopeCheck<S extends CanisterScopeSimple> = S extends {
  children: {
    deploy: infer C;
  };
}
  ? C extends DepBuilder<C>
    ? S
    : DependencyMismatchError<S>
  : DependencyMismatchError<S>;

// Compute a boolean flag from our check.
export type IsValid<S extends CanisterScopeSimple> =
  UniformScopeCheck<S> extends DependencyMismatchError<S> ? false : true;

//
// Helper Functions
//

// TODO: arktype match?
export function normalizeDep(dep: Task | CanisterScopeSimple): Task {
  if ("_tag" in dep && dep._tag === "task") return dep;
  if ("_tag" in dep && dep._tag === "scope" && dep.children?.deploy)
    return dep.children.deploy as Task;
  throw new Error("Invalid dependency type provided to normalizeDep");
}

/**
 * Normalizes a record of dependencies.
 */
export function normalizeDepsMap(
  dependencies: Record<string, AllowedDep>
): Record<string, Task> {
  return Object.fromEntries(
    Object.entries(dependencies).map(([key, dep]) => [key, normalizeDep(dep)])
  );
}

export const makeStopTask = (): StopTask => {
  return {
    _tag: "task",
    id: Symbol("customCanister/stop"),
    dependsOn: {},
    dependencies: {},
    // TODO: do we allow a fn as args here?
    effect: Effect.gen(function* () {
      const { taskPath } = yield* TaskCtx;
      const canisterName = taskPath.split(":").slice(0, -1).join(":");
      // TODO: handle error
      const maybeCanisterId = yield* loadCanisterId(taskPath);
      if (Option.isNone(maybeCanisterId)) {
        yield* Effect.logDebug(
          `Canister ${canisterName} is not installed`,
          maybeCanisterId
        );
        return;
      }
      const canisterId = maybeCanisterId.value;
      const {
        roles: {
          deployer: { identity },
        },
        replica,
      } = yield* TaskCtx;
      // TODO: check if canister is running / stopped
      // get status first
      const status = yield* replica.getCanisterStatus({
        canisterId,
        identity,
      });
      if (status === CanisterStatus.STOPPED) {
        yield* Effect.logDebug(
          `Canister ${canisterName} is already stopped or not installed`,
          status
        );
        return;
      }
      yield* replica.stopCanister({
        canisterId,
        identity,
      });
      yield* Effect.logDebug(`Stopped canister ${canisterName}`);
    }),
    description: "Stop canister",
    // TODO: no tag custom
    tags: [Tags.CANISTER, Tags.STOP],
    namedParams: {},
    positionalParams: [],
    params: {},
  } satisfies Task<void>;
};

export const makeRemoveTask = (): RemoveTask => {
  return {
    _tag: "task",
    id: Symbol("customCanister/remove"),
    dependsOn: {},
    dependencies: {},
    // TODO: do we allow a fn as args here?
    effect: Effect.gen(function* () {
      const { taskPath } = yield* TaskCtx;
      const canisterName = taskPath.split(":").slice(0, -1).join(":");
      // TODO: handle error
      const maybeCanisterId = yield* loadCanisterId(taskPath);
      if (Option.isNone(maybeCanisterId)) {
        yield* Effect.logDebug(
          `Canister ${canisterName} is not installed`,
          maybeCanisterId
        );
        return;
      }
      const canisterId = maybeCanisterId.value;
      const {
        roles: {
          deployer: { identity },
        },
        replica,
      } = yield* TaskCtx;
      yield* replica.removeCanister({
        canisterId,
        identity,
      });
      const canisterIdsService = yield* CanisterIdsService;
      yield* canisterIdsService.removeCanisterId(canisterName);
      yield* Effect.logDebug(`Removed canister ${canisterName}`);
    }),
    description: "Remove canister",
    // TODO: no tag custom
    tags: [Tags.CANISTER, Tags.REMOVE],
    namedParams: {},
    positionalParams: [],
    params: {},
  } satisfies RemoveTask;
};

export const makeCanisterStatusTask = (tags: string[]): StatusTask => {
  return {
    _tag: "task",
    // TODO: change
    id: Symbol("canister/status"),
    dependsOn: {},
    // TODO: we only want to warn at a type level?
    // TODO: type Task
    dependencies: {},
    effect: Effect.gen(function* () {
      // TODO:
      const { replica, currentNetwork } = yield* TaskCtx;
      const { taskPath } = yield* TaskCtx;
      const canisterName = taskPath.split(":").slice(0, -1).join(":");
      const canisterIdsService = yield* CanisterIdsService;
      const canisterIdsMap = yield* canisterIdsService.getCanisterIds();
      // TODO: if deleted doesnt exist
      const canisterIds = canisterIdsMap[canisterName];
      if (!canisterIds) {
        return {
          canisterName,
          canisterId: undefined,
          status: CanisterStatus.NOT_FOUND,
          info: undefined,
        };
      }
      const canisterId = canisterIds[currentNetwork];
      if (!canisterId) {
        // TODO: fix format
        return {
          canisterName,
          canisterId,
          status: CanisterStatus.NOT_FOUND,
          info: undefined,
        };
      }
      // export interface canister_status_result {
      //   'status' : { 'stopped' : null } |
      //     { 'stopping' : null } |
      //     { 'running' : null },
      //   'memory_size' : bigint,
      //   'cycles' : bigint,
      //   'settings' : definite_canister_settings,
      //   'query_stats' : {
      //     'response_payload_bytes_total' : bigint,
      //     'num_instructions_total' : bigint,
      //     'num_calls_total' : bigint,
      //     'request_payload_bytes_total' : bigint,
      //   },
      //   'idle_cycles_burned_per_day' : bigint,
      //   'module_hash' : [] | [Array<number>],
      //   'reserved_cycles' : bigint,
      // }

      // const status = yield* Effect.tryPromise({
      // 	try: () =>
      // 		mgmt.canister_status({
      // 			canister_id: Principal.fromText(canisterId),
      // 		}),
      // 	catch: (err) =>
      // 		new DeploymentError({
      // 			message: `Failed to get status for ${canisterName}: ${
      // 				err instanceof Error ? err.message : String(err)
      // 			}`,
      // 		}),
      // // })
      const {
        roles: {
          deployer: { identity },
        },
      } = yield* TaskCtx;
      const canisterInfo = yield* replica.getCanisterInfo({
        canisterId,
        identity,
      });
      const status = canisterInfo.status;
      return { canisterName, canisterId, status, info: canisterInfo };
    }),
    description: "Get canister status",
    tags: [Tags.CANISTER, Tags.STATUS, ...tags],
    namedParams: {},
    positionalParams: [],
    params: {},
  } satisfies StatusTask;
};

export const resolveMode = () => {
  return Effect.gen(function* () {
    const {
      replica,
      args,
      currentNetwork,
      roles: {
        deployer: { identity },
      },
    } = yield* TaskCtx;
    const { taskPath } = yield* TaskCtx;
    // const taskArgs = args as {
    // 	mode: InstallModes
    // }
    const canisterName = taskPath.split(":").slice(0, -1).join(":");
    const canisterIdsService = yield* CanisterIdsService;
    const canisterIdsMap = yield* canisterIdsService.getCanisterIds();
    const canisterId =
      canisterIdsMap[canisterName]?.[currentNetwork] ?? undefined;
    // TODO: use Option.Option?
    const canisterInfo = canisterId
      ? yield* replica
          .getCanisterInfo({
            canisterId,
            identity,
          })
          .pipe(
            Effect.catchTag("CanisterStatusError", (err) => {
              // TODO: previous canister_ids could exist
              // but canister not even created
              return Effect.succeed({
                status: CanisterStatus.NOT_FOUND,
              });
            })
          )
      : ({
          status: CanisterStatus.NOT_FOUND,
        } as const);

    // yield* Effect.logDebug("canisterInfo", canisterInfo)
    // TODO: reinstall // user can pass it in?
    // TODO: what happens to stopped / stopping canisters here?

    // TODO: from installArgsTask::::::
    /////////////////////////////
    // const taskArgs = args as {
    // 	// TODO: use option
    // 	// mode: Option.Option<"install" | "upgrade" | "reinstall">
    // 	mode: "install" | "upgrade" | "reinstall"
    // }
    // // TODO: needs to check canister status and other things
    // let mode: "install" | "upgrade" | "reinstall" = "install"
    // if ("mode" in taskArgs) {
    // 	mode = taskArgs.mode
    // } else {
    // 	// TODO: check status and other things
    // 	// const mode = taskArgs.mode ?? "install"
    // 	// const mode = parentArgs?.mode ?? "install"
    // 	// const mode = "install"
    // 	mode = "install"
    // }

    // if ("mode" in taskArgs && taskArgs.mode !== undefined) {
    // 	return taskArgs.mode
    // }

    const notInstalled =
      canisterInfo.status !== CanisterStatus.NOT_FOUND &&
      canisterInfo.module_hash.length === 0;
    // let mode = taskArgs?.mode
    let mode: InstallModes = "install";
    // TODO: taskArgs should override this!!!
    // or throw error???
    if (canisterInfo.status === CanisterStatus.STOPPING) {
      mode = "reinstall";
      if (notInstalled) {
        mode = "install";
      }
    } else if (canisterInfo.status === CanisterStatus.NOT_FOUND) {
      mode = "install";
    } else if (canisterInfo.status === CanisterStatus.STOPPED) {
      mode = "upgrade";
      if (notInstalled) {
        mode = "install";
      }
    } else if (canisterInfo.status === CanisterStatus.RUNNING) {
      mode = "upgrade";
      if (notInstalled) {
        mode = "install";
      }
    }
    return mode;
  });
};

// TODO: temporary hack!!!!!!
const uint8ArrayToJsonString = (uint8Array: Uint8Array) => {
  const jsonString = Array.from(uint8Array, (byte) =>
    String.fromCharCode(byte)
  ).join("");
  // return JSON.parse(jsonString)
  return jsonString;
};
// TODO: temporary hack!!!!!!
const jsonStringToUint8Array = (jsonString: string): Uint8Array => {
  return new Uint8Array(Array.from(jsonString, (char) => char.charCodeAt(0)));
};

export class InstallTaskError extends Data.TaggedError("InstallTaskError")<{
  message?: string;
}> {}

// Encoding with type information
const encodeWithBigInt = (obj: unknown) =>
  Effect.try<string, TaskError>({
    try: () =>
      JSON.stringify(obj, (_, value) => {
        if (typeof value === "bigint") {
          return { __type__: "bigint", value: value.toString() };
        }
        return value;
      }),
    catch: (e) =>
      new TaskError({
        message: "Encoding failed",
      }),
  });

// Decoding with type restoration
const decodeWithBigInt = (str: string) =>
  Effect.try<unknown, TaskError>({
    try: () =>
      JSON.parse(str, (_, value) => {
        if (value && typeof value === "object" && value.__type__ === "bigint") {
          return BigInt(value.value);
        }
        return value;
      }),
    catch: (e) =>
      new TaskError({
        message: "Decoding failed",
      }),
  });

export const installParams = {
  mode: {
    type: InstallModes,
    description: "The mode to install the canister in",
    default: "install" as const,
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
      return new Uint8Array(Buffer.from(value));
    },
  },
  // TODO: provide defaults. just read from fs by canister name
  // should we allow passing in wasm bytes?
  wasm: {
    type: type("string"),
    description: "The path to the wasm file",
    isFlag: true as const,
    isOptional: false as const,
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
    default: "aaaaa-aa",
    isOptional: false as const,
    isVariadic: false as const,
    name: "canisterId",
    aliases: ["i"],
    parse: (value: string) => value as string,
  },
};

export type InstallTaskArgs = ParamsToArgs<typeof installParams>;

export const makeInstallTask = <
  I,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  _SERVICE,
>(
  installArgsFn: (args: {
    ctx: TaskCtxShape;
    mode: InstallModes;
    deps: ExtractScopeSuccesses<D> & ExtractScopeSuccesses<P>;
  }) => Promise<I> | I = () => [] as unknown as I,
  {
    customEncode,
    // customInitIDL,
  }: {
    customEncode:
      | undefined
      | ((args: I) => Promise<Uint8Array<ArrayBufferLike>>);
    // customInitIDL: IDL.Type[] | undefined
  } = {
    customEncode: undefined,
    // customInitIDL: undefined,
  }
): InstallTask<_SERVICE, I, D, P> => {
  return {
    _tag: "task",
    id: Symbol("customCanister/install"),
    dependsOn: {} as D,
    dependencies: {} as P,
    // TODO: allow passing in candid as a string from CLI
    namedParams: installParams,
    positionalParams: [],
    params: installParams,
    effect: Effect.gen(function* () {
      yield* Effect.logDebug("Starting custom canister installation");
      const taskCtx = yield* TaskCtx;
      const path = yield* Path.Path;
      // TODO: can I pass in the task itself as a type parameter to get automatic type inference?
      // To avoid having to use "as"
      const { appDir, iceDir } = yield* TaskCtx;
      const identity = taskCtx.roles.deployer.identity;
      const { replica, args, depResults } = taskCtx;
      const taskArgs = args as InstallTaskArgs;
      const { taskPath } = yield* TaskCtx;
      const canisterName = taskPath.split(":").slice(0, -1).join(":");

      const {
        canisterId,
        wasm: wasmPath,
        candid,
        // TODO: support raw args
        args: rawInstallArgs,
        mode,
      } = taskArgs;

      yield* Effect.logDebug("Starting install args generation");

      let initArgs = [] as unknown as I;
      yield* Effect.logDebug("Executing install args function");

      // TODO:
      // const didJSPath =
      const didJSPath = path.join(
        appDir,
        iceDir,
        "canisters",
        canisterName,
        `${canisterName}.did.js`
      );

      // TODO: should it catch errors?
      // TODO: handle different modes
      const deps = Record.map(
        depResults,
        (dep) => dep.result
      ) as ExtractScopeSuccesses<D> & ExtractScopeSuccesses<P>;
      const installResult = installArgsFn({
        mode,
        ctx: taskCtx,
        deps,
      });
      if (installResult instanceof Promise) {
        initArgs = yield* Effect.tryPromise({
          try: () => installResult,
          catch: (e) =>
            new TaskError({
              message: `Install args function failed for: ${canisterName},
							typeof installArgsFn: ${typeof installArgsFn},
							 typeof installResult: ${typeof installResult}
							 error: ${e},
							 installArgsFn: ${installArgsFn},
							 installResult: ${installResult},
							 `,
            }),
        });
      } else {
        initArgs = installResult;
      }
      yield* Effect.logDebug("installArgsFn effect result:", installResult);
      yield* Effect.logDebug("Install args generated", { args: initArgs });

      const canisterDID = yield* Effect.tryPromise({
        try: () => import(didJSPath) as Promise<CanisterDidModule>,
        catch: (e) => {
          return new TaskError({
            message: "Failed to load canisterDID",
          });
        },
      });
      yield* Effect.logDebug("Loaded canisterDID", { canisterDID });

      yield* Effect.logDebug("Encoding args", {
        installArgs: initArgs,
        canisterDID,
      });

      // TODO: do we accept simple objects as well?
      const encodedArgs = customEncode
        ? yield* Effect.tryPromise({
            try: () => customEncode(initArgs),
            catch: (error) => {
              return new TaskError({
                message: `customEncode failed, error: ${error}`,
              });
            },
          })
        : yield* encodeArgs(initArgs as unknown[], canisterDID);

      yield* Effect.logDebug("Loaded canister ID", { canisterId });
      const fs = yield* FileSystem.FileSystem;

      const canisterInfo = yield* replica.getCanisterInfo({
        canisterId,
        identity,
      });
      yield* Effect.logDebug("canisterInfo", canisterInfo);
      // TODO:
      // they can return the values we need perhaps? instead of reading from fs
      // we need the wasm blob and candid DIDjs / idlFactory?
      const wasmContent = yield* fs.readFile(wasmPath);
      const wasm = new Uint8Array(wasmContent);
      const maxSize = 3670016;
      yield* Effect.logDebug(
        `Installing code for ${canisterId} at ${wasmPath} with mode ${mode}`
      );
      yield* replica.installCode({
        canisterId,
        wasm,
        encodedArgs,
        identity,
        mode,
      });
      yield* Effect.logDebug(`Code installed for ${canisterId}`);
      yield* Effect.logDebug(`Canister ${canisterName} installed successfully`);
      const actor = yield* replica.createActor<_SERVICE>({
        canisterId,
        canisterDID,
        identity,
      });
      return {
        args: initArgs,
        encodedArgs,
        canisterId,
        canisterName,
        mode,
        actor: proxyActor(canisterName, actor),
      };
    }),
    description: "Install canister code",
    tags: [Tags.CANISTER, Tags.CUSTOM, Tags.INSTALL],
    // TODO: add network?
    computeCacheKey: (input) => {
      // TODO: pocket-ic could be restarted?
      const installInput = {
        argFnHash: hashConfig(input.installArgsFn),
        depsHash: hashJson(input.depCacheKeys),
        canisterId: input.canisterId,
        network: input.network,
        mode: input.mode,
      };
      const cacheKey = hashJson(installInput);
      return cacheKey;
    },
    input: () =>
      Effect.gen(function* () {
        const { args } = yield* TaskCtx;
        const { taskPath, depResults } = yield* TaskCtx;
        const taskArgs = args as {
          mode: InstallModes;
          args: string;
        };
        const canisterName = taskPath.split(":").slice(0, -1).join(":");
        const dependencies = depResults as {
          [K in keyof P]: {
            result: TaskReturnValue<P[K]>;
            cacheKey: string | undefined;
          };
        };
        const depCacheKeys = Record.map(dependencies, (dep) => dep.cacheKey);
        const maybeCanisterId = yield* loadCanisterId(taskPath);
        if (Option.isNone(maybeCanisterId)) {
          yield* Effect.logDebug(
            `Canister ${canisterName} is not installed`,
            maybeCanisterId
          );
          return yield* Effect.fail(
            new TaskError({
              message: `Canister ${canisterName} is not installed`,
            })
          );
        }
        const canisterId = maybeCanisterId.value;
        const { currentNetwork } = yield* TaskCtx;
        const mode = taskArgs.mode;

        const taskRegistry = yield* TaskRegistry;
        // TODO: we need a separate cache for this?
        const input = {
          canisterId,
          canisterName,
          network: currentNetwork,
          // TODO: remove?
          taskPath,
          ///////////////
          mode,
          depCacheKeys,
          installArgsFn,
        };
        return input;
      }),
    encodingFormat: "string",

    // // TODO: noEncodeArgs messes this up
    // decode: (prev, input) =>
    // 	Effect.gen(function* () {
    // 		// TODO: fix
    // 		const encoded = prev as Uint8Array<ArrayBufferLike>
    // 		const { args } = yield* TaskCtx
    // 		const taskArgs = args as InstallArgsTaskArgs
    // 		const didJSPath = taskArgs.candid
    // 		// const path = yield* Path.Path
    // 		// const { appDir, iceDir, taskPath } = yield* TaskCtx
    // 		// const canisterName = taskPath.split(":").slice(0, -1).join(":")
    // 		// const didJSPath = path.join(
    // 		// 	appDir,
    // 		// 	iceDir,
    // 		// 	"canisters",
    // 		// 	canisterName,
    // 		// 	`${canisterName}.did.js`,
    // 		// )

    // 		if (customEncode) {
    // 			const decoded = JSON.parse(encoded as unknown as string) as A
    // 			// TODO: use customEncode again
    // 			const customEncoded = yield* customEncode(decoded)
    // 			return {
    // 				encodedArgs: customEncoded,
    // 				args: decoded,
    // 				mode: input.mode,
    // 			}
    // 		}

    // 		// TODO: can we type it somehow?
    // 		const canisterDID = yield* Effect.tryPromise({
    // 			try: () => import(didJSPath) as Promise<CanisterDidModule>,
    // 			catch: Effect.fail,
    // 		})

    // 		// TODO: will .init work with upgrades?

    // 		// TODO: custom init IDL. mainly for nns canisters
    // 		// const idl = customInitIDL ?? canisterDID.init({ IDL })
    // 		const idl = canisterDID.init({ IDL })
    // 		yield* Effect.logDebug(
    // 			"decoding value",
    // 			"with type:",
    // 			typeof encoded,
    // 			"with value:",
    // 			encoded,
    // 			"with idl:",
    // 			idl,
    // 		)
    // 		// TODO: customEncode maybe messes this up?
    // 		const decoded = IDL.decode(idl, encoded.slice().buffer) as A

    // 		yield* Effect.logDebug("decoded:", decoded)
    // 		return {
    // 			encodedArgs: encoded,
    // 			args: decoded,
    // 			mode: input.mode,
    // 		}
    // 	}),
    encode: (result, input) =>
      Effect.gen(function* () {
        yield* Effect.logDebug("encoding:", result);
        if (customEncode) {
          // TODO: stringify? or uint8array?

          // return JSON.stringify(result.args)

          // return JSON.stringify(result.args, (_, value) =>
          // 	typeof value === "bigint" ? value.toString() : value,
          // )

          // canisterId: string
          // canisterName: string
          // mode: InstallModes
          // encodedArgs: string
          // args: I
          return yield* encodeWithBigInt({
            canisterId: result.canisterId,
            canisterName: result.canisterName,
            mode: result.mode,
            encodedArgs: uint8ArrayToJsonString(result.encodedArgs),
            args: result.args,
          });
        }
        // TODO: need to encode mode as well?
        // return result.encodedArgs

        // const encoded = yield* encodeWithBigInt(result.args)
        return yield* encodeWithBigInt({
          canisterId: result.canisterId,
          canisterName: result.canisterName,
          mode: result.mode,
          encodedArgs: uint8ArrayToJsonString(result.encodedArgs),
          args: result.args,
        });

        // const encoded = yield* Effect.try({
        // 	try: () =>
        // 		JSON.stringify({
        // 			canisterId: result.canisterId,
        // 			canisterName: result.canisterName,
        // 			mode: result.mode,
        // 			encodedArgs: uint8ArrayToJsonString(result.encodedArgs),
        // 			// TODO: bigint!
        // 			args: result.args,
        // 		}),
        // 	catch: (e) =>
        // 		new TaskError({
        // 			message: "Encoding failed",
        // 		}),
        // })
        // return encoded
        // return ""
      }),
    decode: (value, input) =>
      Effect.gen(function* () {
        const {
          canisterId,
          canisterName,
          mode,
          encodedArgs: encodedArgsString,
          args: initArgs,
        } = (yield* decodeWithBigInt(value as string)) as {
          canisterId: string;
          canisterName: string;
          mode: InstallModes;
          encodedArgs: string;
          args: I;
        };
        const encodedArgs = jsonStringToUint8Array(encodedArgsString);
        // const initArgs = {} as unknown as I
        const {
          replica,
          roles: {
            deployer: { identity },
          },
        } = yield* TaskCtx;
        const { appDir, iceDir, args } = yield* TaskCtx;
        const taskArgs = args as InstallTaskArgs;
        // const { candid: didJSPath } = taskArgs
        const path = yield* Path.Path;
        const didJSPath = path.join(
          appDir,
          iceDir,
          "canisters",
          canisterName,
          `${canisterName}.did.js`
        );
        // TODO: we should create a service that caches these?
        // expensive to import every time
        const canisterDID = yield* Effect.tryPromise({
          try: () => import(didJSPath) as Promise<CanisterDidModule>,
          catch: (e) =>
            new TaskError({
              message: "Failed to load canisterDID",
            }),
        });
        const actor = yield* replica.createActor<_SERVICE>({
          canisterId,
          canisterDID,
          identity,
        });
        // const encodedArgs = customEncode
        // 	? yield* customEncode(initArgs)
        // 	: yield* encodeArgs(initArgs as unknown[], canisterDID)

        const decoded = {
          mode,
          canisterId,
          canisterName,
          actor: proxyActor(canisterName, actor),
          encodedArgs,
          args: initArgs,
        };
        return decoded;
      }),
  };
};

export const makeUpgradeTask = <
  U,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  _SERVICE,
>(
  upgradeArgsFn: (args: {
    ctx: TaskCtxShape;
    deps: ExtractScopeSuccesses<D> & ExtractScopeSuccesses<P>;
  }) => Promise<U> | U = () => [] as unknown as U,
  {
    customEncode,
  }: {
    customEncode:
      | undefined
      | ((args: U) => Promise<Uint8Array<ArrayBufferLike>>);
  } = {
    customEncode: undefined,
  }
): InstallTask<_SERVICE, U, D, P> => {
  return {
    ...makeInstallTask<U, D, P, _SERVICE>(upgradeArgsFn, {
      customEncode,
    }),
    tags: [Tags.CANISTER, Tags.CUSTOM, Tags.UPGRADE],
  };
};

export const linkChildren = <A extends Record<string, Task>>(
  children: A
): A => {
  // 1️⃣  fresh copies with new ids
  const fresh = Record.map(children, (task) => ({
    ...task,
    id: Symbol("task"),
  })) as A;

  // 2️⃣  start with fresh, then relink all edges to the final map
  const linked = { ...fresh } as A;

  for (const k in linked) {
    const t = linked[k] as Task;
    // @ts-ignore
    linked[k] = {
      ...t,
      dependsOn: Record.map(t.dependsOn, (v, key) =>
        key in linked ? linked[key as keyof A] : v
      ),
      dependencies: Record.map(t.dependencies, (v, key) =>
        key in linked ? linked[key as keyof A] : v
      ),
    } as Task;
  }

  return linked;
};

/**
 * Represents the expected structure of a dynamically imported DID module.
 */
export interface CanisterDidModule {
  idlFactory: IDL.InterfaceFactory;
  init: (args: { IDL: typeof IDL }) => IDL.Type[];
}

const testTask = {
  _tag: "task",
  id: Symbol("test"),
  dependsOn: {},
  dependencies: {},
  effect: Effect.gen(function* () {
    return { testTask: "test" };
  }),
  description: "",
  tags: [],
  namedParams: {},
  positionalParams: [],
  params: {},
} satisfies Task;

const testTask2 = {
  _tag: "task",
  id: Symbol("test"),
  dependsOn: {},
  dependencies: {},
  effect: Effect.gen(function* () {
    return { testTask2: "test" };
  }),
  description: "",
  tags: [],
  namedParams: {},
  positionalParams: [],
  params: {},
} satisfies Task;

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
} satisfies Task;

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
} satisfies Task;

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
} satisfies Task;

const testScope = {
  _tag: "scope",
  tags: [Tags.CANISTER],
  description: "",
  id: Symbol("scope"),
  children: {
    providedTask,
    unProvidedTask,
  },
};

const testScope2 = {
  _tag: "scope",
  tags: [Tags.CANISTER],
  description: "",
  id: Symbol("scope"),
  children: {
    unProvidedTask2,
  },
};

const providedTestScope = {
  _tag: "scope",
  tags: [Tags.CANISTER],
  description: "",
  id: Symbol("scope"),
  children: {
    providedTask,
  },
};

const encodingTask = {
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
  encodingFormat: "string",
  encode: (result, input) =>
    Effect.gen(function* () {
      return JSON.stringify(result);
    }),
  decode: (prev, input) =>
    Effect.gen(function* () {
      return JSON.parse(prev as unknown as string);
    }),
  computeCacheKey: (input) => "",
  input: () => Effect.succeed({}),
} satisfies CachedTask;
