import { Effect, Layer, Context } from "effect";
declare const TaskRegistry_base: Context.TagClass<TaskRegistry, "TaskRegistry", {
    readonly set: (cacheKey: string, result: unknown) => Effect.Effect<void, unknown, unknown>;
    readonly get: (cacheKey: string) => Effect.Effect<unknown, unknown, unknown>;
    readonly has: (cacheKey: string) => Effect.Effect<boolean, unknown, unknown>;
}>;
export declare class TaskRegistry extends TaskRegistry_base {
    static Live: Layer.Layer<TaskRegistry, never, never>;
}
export {};
