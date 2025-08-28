import { ConfigProvider, Layer } from "effect"
import { realpathSync } from "node:fs"

export const configMap = new Map([
	["APP_DIR", realpathSync(process.cwd())],
	["ICE_DIR_NAME", ".ice"],
])

export const configLayer = Layer.setConfigProvider(
	ConfigProvider.fromMap(configMap),
)
