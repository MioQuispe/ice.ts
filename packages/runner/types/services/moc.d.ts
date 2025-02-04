import { Effect, Layer, Context } from "effect";
import { CommandExecutor, Path, FileSystem } from "@effect/platform";
declare const MocError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "MocError";
} & Readonly<A>;
export declare class MocError extends MocError_base<{
    readonly message: string;
}> {
}
declare const Moc_base: Context.TagClass<Moc, "Moc", {
    readonly compile: (src: string, output: string) => Effect.Effect<void, MocError>;
    readonly version: string;
}>;
export declare class Moc extends Moc_base {
    static Live: Layer.Layer<Moc, import("@effect/platform/Error").PlatformError | MocError, CommandExecutor.CommandExecutor | FileSystem.FileSystem | Path.Path>;
}
export {};
