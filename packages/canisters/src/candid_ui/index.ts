import * as url from "node:url"
import path from "node:path"
import { Principal } from "@dfinity/principal"
import { customCanister, type TaskCtxShape } from "@ice.ts/runner"
import { CapRouter } from "../cap"
import type { _SERVICE } from "./candid_ui.types"
import { Effect } from "effect"

export type {
	_SERVICE as CandidUIService,
	CanisterInitArgs as CandidUIInitArgs,
}

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

// TODO: bigint?
type CanisterInitArgs = []

const canisterName = "candid_ui"

export const CandidUI = () => {
	const result = customCanister<_SERVICE, CanisterInitArgs>(
		async ({ ctx }) => {
			return {
				wasm: path.resolve(
					__dirname,
					`./${canisterName}/${canisterName}.wasm.gz`,
				),
				candid: path.resolve(
					__dirname,
					`./${canisterName}/${canisterName}.did`,
				),
			}
		},
	)

	return result
}
