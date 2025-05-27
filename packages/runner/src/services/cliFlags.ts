import { Context } from "effect"


export class CLIFlags extends Context.Tag("CLIFlags")<CLIFlags, {
	globalArgs: {
		network: string
		logLevel: "debug" | "info" | "error"
	}
	taskArgs: {
		positionalArgs: string[]
		namedArgs: Record<string, unknown>
	}
}>() {}


