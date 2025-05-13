import { Context } from "effect"


export class CLIFlags extends Context.Tag("CLIFlags")<CLIFlags, {
	network: string
	logLevel: "debug" | "info" | "error"
}>() {}


