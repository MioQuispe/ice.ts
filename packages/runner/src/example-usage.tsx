// import { Effect, Layer, ManagedRuntime, Context } from "effect"
import { Crystal } from "@crystal/runner";
import { InternetIdentity } from "@crystal/canisters";

export const crystal = Crystal();

export const crystal_test_backend = crystal.motokoCanister({
  src: "src/crystal_test_backend/main.mo",
  canisterId: "ryjl3-tyaaa-aaaaa-aaaba-cai",
});

export const internet_identity = InternetIdentity({
  owner: "ryjl3-tyaaa-aaaaa-aaaba-cai",
})

export const example_task = crystal.task(async (ctx) => {
  const result = await ctx.runTask(internet_identity.install)
  // TODO: can we depend on a whole scope? or should it just be a task of tasks?
  const result2 = await ctx.runTask(internet_identity)
  // const result = await ctx.installed(internet_identity)
  return result
})
