import type { ActorSubclass, SignIdentity } from "@dfinity/agent"
import { NodeContext } from "@effect/platform-node"
import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { ConfigError, Effect } from "effect"
import { CanisterIdsService } from "../services/canisterIds.js"
import { CLIFlags } from "../services/cliFlags.js"
import { DefaultConfig } from "../services/defaultConfig.js"
import { ICEConfigError, ICEConfigService } from "../services/iceConfig.js"
import { Moc, MocError } from "../services/moc.js"
import type {
	AgentError,
	CanisterCreateError,
	CanisterDeleteError,
	CanisterInstallError,
	CanisterStatusError,
	CanisterStopError,
	ReplicaService,
} from "../services/replica.js"
import { DefaultReplica } from "../services/replica.js"
import { TaskArgsService } from "../services/taskArgs.js"
import { TaskRegistry } from "../services/taskRegistry.js"
import { TaskCtxService } from "../services/taskCtx.js"
import type { TaskArgsParseError, TaskCtx, TaskNotFoundError, TaskRuntimeError } from "../tasks/lib.js"
import { TaskError } from "../builders/lib.js"
import { PlatformError } from "@effect/platform/Error"
import { DeploymentError } from "../canister.js"

export type CanisterActor = {
	actor: ActorSubclass<unknown>
	canisterId: string
	getControllers: () => Promise<void>
	addControllers: (controllers: string[]) => Promise<void>
	setControllers: (controllers: string[]) => Promise<void>
}

export type ManagementActor = import("@dfinity/agent").ActorSubclass<
	import("../canisters/management_latest/management.types.js")._SERVICE
>

export type ReplicaConfig = {
	subnet: "system" | "application" | "verified_application"
	// type?: "ephemeral" | "persistent"
	bitcoin?: boolean
	canister_http?: boolean
	type: "pocketic" | "dfx"
}

export type ICEUser = {
	identity: SignIdentity
	principal: string
	accountId: string
	// agent: Agent
}

// TODO: create service? dependencies?
export type ICEConfig = {
	users: {
		[key: string]: ICEUser
	}
	roles: {
		[key: string]: string
	}
	networks: {
		[key: string]: {
			replica: ReplicaService
			host: string
			port: number
		}
	}
}

export type DefaultRoles = "deployer" | "minter" | "controller" | "treasury"

export type InitializedICEConfig = {
	users: {
		[key: string]: ICEUser
	}
	roles: {
		deployer: ICEUser
		minter: ICEUser
		controller: ICEUser
		treasury: ICEUser
		[key: string]: ICEUser
	}
	networks: {
		[key: string]: {
			replica: ReplicaService
			host: string
			port: number
		}
	}
}

export interface TaskParam<T = unknown> {
	type: StandardSchemaV1<T> // TODO: ship built in types like "string" | "number" etc.
	description?: string
	default?: T
	parse: (value: string) => T
	isOptional: boolean
	isVariadic: boolean
	// isFlag: boolean
}

export interface InputNamedParam<T = unknown> extends TaskParam<T> {
	aliases?: Array<string>
	isFlag: true
	// TODO: means it shouldnt appear in the help. not sure if we need this
	// hidden: boolean;
}

export interface InputPositionalParam<T = unknown> extends TaskParam<T> {
	isFlag: false
}

export interface NamedParam<T = unknown> extends TaskParam<T> {
	name: string
	aliases?: Array<string>
	isFlag: true
	// TODO: means it shouldnt appear in the help. not sure if we need this
	// hidden: boolean;
}

export interface PositionalParam<T = unknown> extends TaskParam<T> {
	name: string
	isFlag: false
}

// export const TaskParam = type("<t>", {
// 	schema: "object",
// 	"description?": "string",
// 	"default?": "t",
// 	"isOptional?": "boolean",
// 	"isVariadic?": "boolean",
// })

// export const NamedParam = type({
// 	"...": TaskParam("unknown"),
// })
// export type NamedParam = typeof NamedParam.infer
// export const PositionalParam = type({
// 	"...": TaskParam("unknown"),
// 	"isFlag?": "boolean",
// 	"aliases?": "string[]",
// })
// export type PositionalParam = typeof PositionalParam.infer

// type NamedParamSchema = typeof namedParamSchema.infer

// export const namedParamSchema = type.and(taskParamSchema, {
//   "isFlag?": "boolean",
//   "aliases?": "string[]",
// })
// export const positionalParamSchema = type.and(taskParamSchema)

// export const makeTask = <A, D extends Record<string, Task>, P extends Record<string, Task>, E, R, I>({
// 	effect: Effect.Effect<A, E, R>,
// 	description: string,
// 	tags: Array<string | symbol>,
// 	dependsOn: D,
// 	dependencies: P,
// 	namedParams: Record<string, NamedParam>,
// 	positionalParams: Array<PositionalParam>,
// 	params: Record<string, NamedParam | PositionalParam>,
// 	encode: (value: A, input: I) => Effect.Effect<string | Uint8Array<ArrayBufferLike>>,
// 	decode: (value: string | Uint8Array<ArrayBufferLike>, input: I) => Effect.Effect<A, E, R>,
// 	encodingFormat: "string" | "uint8array",
// }) => {
// 	return {
// 		_tag: "task",
// 		id: Symbol("task"),
// 		effect,
// 		description,
// 		tags,
// 		dependsOn,
// 		dependencies,
// 		namedParams,
// 		positionalParams,
// 		params,
// 		encode,
// 		decode,
// 		encodingFormat,
// 	} satisfies Task<A, D, P, E, R>
// }

type TaskRequirements =
	| TaskCtx
	| TaskCtxService
	| TaskRegistry
	| CanisterIdsService
	| NodeContext.NodeContext
	| ICEConfigService
	| Moc
	| DefaultConfig
	| DefaultReplica
	| CLIFlags
	| TaskArgsService

// TODO: separate per task... 
export type TaskErrors =
	| TaskError
	| PlatformError
	| DeploymentError
	| AgentError
	| TaskNotFoundError
	| ICEConfigError
	| ConfigError.ConfigError
	| CanisterStatusError
	| CanisterStopError
	| CanisterDeleteError
	| CanisterCreateError
	| CanisterInstallError
	| MocError
	| TaskRuntimeError
	| TaskArgsParseError

export interface Task<
	out A = unknown,
	D extends Record<string, Task> = {},
	P extends Record<string, Task> = {},
	// TODO:
	out E = TaskErrors,
	out R = TaskRequirements,
> {
	_tag: "task"
	readonly id: symbol // assigned by the builder
	effect: Effect.Effect<A, E, R>
	description: string
	tags: Array<string | symbol>
	// TODO: we only want the shape of the task here
	dependsOn: D
	dependencies: P
	namedParams: Record<string, NamedParam>
	positionalParams: Array<PositionalParam>
	params: Record<string, NamedParam | PositionalParam>
}

export type CachedTask<
	A = unknown,
	D extends Record<string, Task> = {},
	P extends Record<string, Task> = {},
	Input = unknown,
	// TODO:
	E = TaskErrors,
	R = TaskRequirements,
> = Task<A, D, P, E, R> & {
	input: () => Effect.Effect<Input, E, R> // optional input
	encode: (
		value: A,
		input: Input,
	) => Effect.Effect<string | Uint8Array<ArrayBufferLike>, E, R>
	encodingFormat: "string" | "uint8array"
	decode: (
		value: string | Uint8Array<ArrayBufferLike>,
		input: Input,
	) => Effect.Effect<A, E, R>
	computeCacheKey: (input: Input) => string
}

export type Scope = {
	_tag: "scope"
	readonly id: symbol
	// TODO: hmm do we need this?
	tags: Array<string | symbol>
	description: string
	children: Record<string, TaskTreeNode>
	defaultTask?: string
}

export type BuilderResult = {
	_tag: "builder"
	make: () => Task | Scope
	[key: string]: any
}

export type TaskTreeNode = Task | Scope | BuilderResult

export type TaskTree = Record<string, TaskTreeNode>

// TODO: come up with a better name
export type ICECtx = {
	network: string
}
// TODO: fix
export type ICEConfigFile = {
	default:
		| Partial<ICEConfig>
		| ((ctx: ICECtx) => Promise<Partial<ICEConfig>> | Partial<ICEConfig>)
} & {
	[key: string]: TaskTreeNode
}
