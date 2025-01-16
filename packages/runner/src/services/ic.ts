import { Principal } from "@dfinity/principal"
import { Context, Data, Effect, Layer } from "effect"
import { DfxService } from "./dfx.js"
const ICError = Data.TaggedError("ICError")<{
  readonly message: string
}>

export class ICService extends Context.Tag("ICService")<
  ICService,
  {
    readonly start: () => Effect.Effect<void, typeof ICError>
    readonly kill: () => Effect.Effect<void, typeof ICError>
    readonly deployCanister: (params: {
      canisterName: string
      wasm: Uint8Array
      candid: any
      args?: any[]
      controllers?: Principal[]
    }) => Effect.Effect<string, typeof ICError>
    // TODO: not sure if this should be here. only dfx specific?
    readonly getIdentity: () => Effect.Effect<Principal, typeof ICError>
    // readonly createCanister: (params: {
    //   canisterName: string
    //   args?: any[]
    // }) => Effect.Effect<string, DfxError>
    // readonly installCanister: (params: {
    //   canisterName: string
    //   args?: any[]
    // }) => Effect.Effect<string, DfxError>
    // readonly createManagementActor: () => Effect.Effect<
    //   ManagementActor,
    //   DfxError
    // >
  }
>() {
  static Live = Layer.effect(
    ICService,
    ICService.of(DfxService.Live),
  )
}
