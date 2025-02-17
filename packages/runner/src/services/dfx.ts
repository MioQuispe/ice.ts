import { Effect, Layer, Context, Data, Config } from "effect"
import { Command, CommandExecutor, Path, FileSystem } from "@effect/platform"
import type { Principal } from "@dfinity/principal"
import { Actor, HttpAgent, type SignIdentity } from "@dfinity/agent"
import { IDL } from "@dfinity/candid"
import find from "find-process"
import { idlFactory } from "../canisters/management_latest/management.did.js"
import { Ed25519KeyIdentity } from "@dfinity/identity"
import type { DfxJson } from "../types/schema.js"
import { ConfigError } from "../index.js"
import type { ManagementActor } from "../types/types.js"
import type { PlatformError } from "@effect/platform/Error"
import os from "node:os"
import psList from "ps-list"

/**
 * Parses a PEM encoded ED25519 private key and returns a SignIdentity.
 *
 * The DER structure we receive from a DFX identity PEM file embeds both the private and public key parts.
 * Since the upgraded @dfinity/identity now expects only a 32-byte private key, we slice the first 32 bytes.
 *
 * @param pem The PEM string
 * @returns The ED25519 identity extracted from the PEM
 */
const parseEd25519PrivateKey = (pem: string) => {
  const cleanedPem = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "")
    .trim();
  // Obtain the DER hex string by base64-decoding the cleaned PEM.
  const derHex = Buffer.from(cleanedPem, "base64").toString("hex");
  // Remove the DER header information.
  // (This static removal works if the key structure is as expected.)
  const rawHex = derHex
    .replace("3053020101300506032b657004220420", "")
    .replace("a123032100", "");
  const keyBytes = new Uint8Array(Buffer.from(rawHex, "hex"));
  // Ensure we only pass the 32-byte secret to the identity.
  const secretKey = keyBytes.slice(0, 32);
  return Ed25519KeyIdentity.fromSecretKey(secretKey.buffer);
}


export const getAccountId = (principal: string) =>
  // TODO: get straight from ledger canister?
  Effect.gen(function* (_) {
    const command = Command.make(
      "dfx",
      "ledger",
      "account-id",
      "--of-principal",
      principal,
    )
    const result = yield* Command.string(command)
    return result.trim()
  })


export const getCurrentIdentity = Effect.gen(function* () {
  const command = Command.make("dfx", "identity", "whoami")
  const result = yield* Command.string(command)
  return result.trim()
})

// TODO: this is dfx specific
export const getIdentity = (selection?: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const identityName = selection ?? (yield* getCurrentIdentity)
    // TODO: can we use effect/platform?
    const identityPath = path.join(
      os.homedir(),
      ".config/dfx/identity",
      identityName,
      "identity.pem",
    )

    const exists = yield* fs.exists(identityPath)
    if (!exists) {
      return yield* Effect.fail(
        new ConfigError({ message: "Identity does not exist" }),
      )
    }

    const pem = yield* fs.readFileString(identityPath, "utf8")
    const cleanedPem = pem
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace("\n", "")
      .trim()

    // TODO: support more key types?
    const identity = parseEd25519PrivateKey(pem);
    const principal = identity.getPrincipal().toText()
    const accountId = yield* getAccountId(principal)

    return {
      identity,
      pem: cleanedPem,
      name: identityName,
      principal,
      accountId,
    }
  })

// TODO: not just dfx?
export const dfxDefaults: DfxJson = {
  defaults: {
    build: {
      packtool: "",
      args: "--force-gc",
    },
    replica: {
      subnet_type: "system",
    },
  },
  networks: {
    local: {
      bind: "127.0.0.1:8080",
      type: "ephemeral",
    },
    staging: {
      providers: ["https://ic0.app"],
      type: "persistent",
    },
    ic: {
      providers: ["https://ic0.app"],
      type: "persistent",
    },
  },
  version: 1,
}

// Error types
export class DfxError extends Data.TaggedError("DfxError")<{
  readonly message: string
}> {}

export class DfxService extends Context.Tag("DfxService")<
  DfxService,
  {
    readonly start: () => Effect.Effect<void, PlatformError>
    readonly stop: () => Effect.Effect<void, DfxError>
    // readonly deployCanister: (params: {
    //   canisterName: string
    //   wasm: Uint8Array
    //   candid: any
    //   args?: any[]
    //   controllers?: Principal[]
    // }) => Effect.Effect<string, DfxError>
    // readonly createCanister: (params: {
    //   canisterName: string
    //   args?: any[]
    // }) => Effect.Effect<string, DfxError>
    // readonly installCanister: (params: {
    //   canisterName: string
    //   args?: any[]
    // }) => Effect.Effect<string, DfxError>
    readonly getWebserverPort: () => Effect.Effect<number, DfxError>
    readonly getIdentity: (selection?: string) => Effect.Effect<
      {
        identity: SignIdentity
        pem: string
        name: string
        principal: string
        accountId: string
      },
      DfxError | PlatformError
    >
    readonly network: string
    readonly identity: SignIdentity
    readonly agent: HttpAgent
    readonly mgmt: ManagementActor
    // readonly createManagementActor: () => Effect.Effect<
    //   ManagementActor,
    //   DfxError
    // >
  }
>() {
  static Live = Layer.effect(
    DfxService,
    Effect.gen(function* () {
      const commandExecutor = yield* CommandExecutor.CommandExecutor
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const dfxPort = yield* Config.string("DFX_PORT")
      const host = yield* Config.string("DFX_HOST")

      const processes = yield* Effect.tryPromise(() =>
        psList({
          all: true,
        })
      )
      const dfxProcesses = processes.filter((process) => process.name === "dfx")
      // yield* Effect.logInfo("dfxProcesses", { dfxProcesses })
      if (dfxProcesses.length === 0) {
        // yield* Effect.logInfo("DFX is not running, start DFX")
        yield* Effect.fail(new DfxError({ message: "DFX is not running" }))
      //   const command = Command.make(
      //     "dfx",
      //     "start",
      //     "--background",
      //     "--clean",
      //   )
      //   yield* commandExecutor.start(command).pipe(Effect.scoped)
      }

      const getCurrentIdentity = () =>
        Effect.gen(function* () {
          const command = Command.make("dfx", "identity", "whoami")
          const result = yield* commandExecutor.string(command)
          return result.trim()
        })

      const getAccountId = (principal: string) =>
        // TODO: get straight from ledger canister?
        Effect.gen(function* (_) {
          const command = Command.make(
            "dfx",
            "ledger",
            "account-id",
            "--of-principal",
            principal,
          )
          const result = yield* commandExecutor.string(command)
          return result.trim()
        })

      const { identity } = yield* getIdentity()
      const agent = new HttpAgent({
        host: `${host}:${dfxPort}`,
        identity,
      })
      yield* Effect.tryPromise({
        try: () => agent.fetchRootKey(),
        catch: (err) =>
          // TODO: the CLI should not fail because of this
          new ConfigError({
            message: `Unable to fetch root key: ${err instanceof Error ? err.message : String(err)}`,
          }),
      })

      return DfxService.of({
        network: "local",
        identity,
        agent,
        mgmt: Actor.createActor<ManagementActor>(idlFactory, {
          canisterId: "aaaaa-aa",
          agent,
        }),
        start: () =>
          Effect.gen(function* () {
            const command = Command.make(
              "dfx",
              "start",
              "--background",
              "--clean",
            )
            yield* commandExecutor.start(command).pipe(Effect.scoped)
            // yield* Effect.tryMap({
            //   try: () => commandExecutor.start(command),
            //   catch: (error) =>
            //     new DfxError({
            //       message: `Failed to start DFX: ${error instanceof Error ? error.message : String(error)}`,
            //     }),
            //   onSuccess: () => undefined,
            // })
          }),
        stop: () =>
          Effect.tryPromise({
            try: async () => {
              const processes = await Promise.all([
                find("name", "dfx", true),
                find("name", "replica", true),
                find("name", "icx-proxy", true),
              ])
              for (const proc of processes.flat()) {
                process.kill(proc.pid)
              }
            },
            catch: (error) =>
              new DfxError({
                message: `Failed to kill DFX processes: ${error instanceof Error ? error.message : String(error)}`,
              }),
          }),
        getWebserverPort: () =>
          Effect.gen(function* () {
            const command = Command.make("dfx", "info", "webserver-port")
            const output = yield* commandExecutor.string(command).pipe(
              Effect.mapError(
                (err) =>
                  new DfxError({
                    message: `Failed to get webserver port: ${err.message}`,
                  }),
              ),
            )
            const port = Number.parseInt(output.trim(), 10)

            if (Number.isNaN(port)) {
              return yield* Effect.fail(
                new DfxError({ message: "Failed to parse DFX webserver port" }),
              )
            }
            return port
          }),
        getIdentity: (selection?: string) =>
          Effect.gen(function* () {
            const identityName = selection ?? (yield* getCurrentIdentity())
            const identityPath = path.join(
              // TODO: platform agnostic
              // os.homedir(),
              "~",
              ".config/dfx/identity",
              identityName,
              "identity.pem",
            )

            const exists = yield* fs.exists(identityPath).pipe(
              Effect.mapError(
                (err) =>
                  new DfxError({
                    message: `Failed to check identity path: ${err.message}`,
                  }),
              ),
            )
            if (!exists) {
              return yield* Effect.fail(
                new DfxError({ message: "Identity does not exist" }),
              )
            }

            const pem = yield* fs.readFileString(identityPath, "utf8").pipe(
              Effect.mapError(
                (err) =>
                  new DfxError({
                    message: `Failed to read identity file: ${err.message}`,
                  }),
              ),
            )
            const cleanedPem = pem
              .replace("-----BEGIN PRIVATE KEY-----", "")
              .replace("-----END PRIVATE KEY-----", "")
              .replace("\n", "")
              .trim()

            const raw = Buffer.from(cleanedPem, "base64")
              .toString("hex")
              .replace("3053020101300506032b657004220420", "")
              .replace("a123032100", "")
            const key = new Uint8Array(Buffer.from(raw, "hex"))
            // TODO: this is not working
            const identity = Ed25519KeyIdentity.fromSecretKey(key.buffer)
            const principal = identity.getPrincipal().toText()
            const accountId = yield* getAccountId(principal)

            return {
              identity: identity as SignIdentity,
              pem: cleanedPem,
              name: identityName,
              principal,
              accountId,
            }
          }),
      })
    }),
  )
}
