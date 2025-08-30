import path from "node:path"
import { customCanister, task } from "../../src/index.js"

const __dirname = path.resolve(import.meta.dirname)

export const dependency_canister = customCanister({
    wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
    candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
}).installArgs(async ({ ctx }) => {
    return []
}).make()

export const main_canister = customCanister({
    wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
    candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
})
    .dependsOn({
        dependency_canister,
    })
    .deps({
        dependency_canister,
    })
    .installArgs(async ({ ctx, deps }) => {
        // Use the dependency canister in install args
        // expect(deps.dependency_canister.canisterId).toBeTruthy()
        return []
    })
    .make()

export const test_task = task("test task")
    .run(async ({ ctx }) => {
        console.log("running test task")
        const result = await ctx.runTask(main_canister.children.deploy)
        console.log("test task result", result)
        return result
    })
    .make()

// const taskTree = {
//     dependency_canister,
//     main_canister,
// }

// const runtime = makeTestRuntime({}, taskTree)

// const result = await runtime.runPromise(
//     Effect.gen(function* () {
//         // const result1 = yield* runTask(dependency_canister.children.deploy)
//         // TODO: deps dont work?
//         const result = yield* runTask(main_canister.children.deploy)
//         return result
//     }),
// )