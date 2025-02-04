import { Effect } from "effect";
import { type TaskCtxShape } from "../index.js";
import type { CrystalContext, Scope, Task, TaskTree } from "../types/types.js";
import { Path, FileSystem } from "@effect/platform";
export declare const Tags: {
    CANISTER: string;
    CREATE: string;
    BUILD: string;
    INSTALL: string;
    BINDINGS: string;
    DEPLOY: string;
    DELETE: string;
    SCRIPT: string;
};
export type CanisterBuilder<I = unknown> = {
    install: (fn: (args: {
        ctx: TaskCtxShape;
        mode: string;
    }) => Promise<I>) => CanisterBuilder<I>;
    build: (fn: (args: {
        ctx: TaskCtxShape;
    }) => Promise<I>) => CanisterBuilder<I>;
    deps: (...deps: Array<Task | CanisterBuilder<any> | MotokoCanisterBuilder<any>>) => CanisterBuilder<I>;
    _scope: Scope;
    _tag: "builder";
};
type CustomCanisterConfig = {
    wasm: string;
    candid: string;
    canisterId?: string;
};
export declare const customCanister: <I>(canisterConfigOrFn: CustomCanisterConfig | ((ctx: TaskCtxShape) => CustomCanisterConfig)) => CanisterBuilder<I>;
type MotokoCanisterConfig = {
    src: string;
    canisterId?: string;
};
export type MotokoCanisterBuilder<I = unknown> = {
    install: (fn: (args: {
        ctx: TaskCtxShape;
    }) => Promise<I>) => MotokoCanisterBuilder<I>;
    deps: (...deps: Array<Task | CanisterBuilder<any> | MotokoCanisterBuilder<any>>) => MotokoCanisterBuilder<I>;
    _scope: Scope;
    _tag: "builder";
};
export declare const loadCanisterId: (taskPath: string) => Effect.Effect<string, Error | import("@effect/platform/Error").PlatformError | import("effect/ConfigError").ConfigError, FileSystem.FileSystem | Path.Path>;
export declare const motokoCanister: <I>(canisterConfigOrFn: MotokoCanisterConfig | ((ctx: TaskCtxShape) => MotokoCanisterConfig)) => MotokoCanisterBuilder<I>;
type CrystalConfig = CrystalContext & {
    setup?: () => Promise<CrystalContext>;
};
export declare const scope: (description: string, children: TaskTree) => {
    _tag: string;
    tags: never[];
    description: string;
    children: TaskTree;
};
export declare const Crystal: (config?: CrystalConfig) => {};
export {};
