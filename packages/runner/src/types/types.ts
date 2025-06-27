import type { Effect, Option, Schema } from "effect"
import type {
	ActorSubclass,
	Agent,
	Identity,
	SignIdentity,
} from "@dfinity/agent"
import type { Principal } from "@dfinity/principal"
import type { ReplicaService } from "../services/replica.js"
import type { StandardSchemaV1 } from "@standard-schema/spec"
import { type } from "arktype"

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

type ICEUser = {
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

export type InitializedICEConfig = {
	users: {
		[key: string]: ICEUser
	}
	roles: {
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

// // Helper type that compares two types for equality.
// type IsEqual<T, U> =
//   (<V>() => V extends T ? 1 : 2) extends
//   (<V>() => V extends U ? 1 : 2)
//     ? true
//     : false;

// type IsSubType<T, U> = T extends U ? true : false;

// // Assertion type used in tests. If T and U aren’t equal, this will result in a compile-time error.
// type AssertEqual<T, U> = IsEqual<T, U> extends true ? true : never;
// type AssertSubType<T, U> = IsSubType<T, U> extends true ? true : never;

// // Usage examples:
// type TestSuccess = AssertEqual<{ a: number }, { a: number }>; // OK, resolves to true
// // type TestFailure = AssertEqual<number, string>; // Uncommenting this line causes a compile-time error

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

export interface Task<
	A = unknown,
	D extends Record<string, Task> = {},
	P extends Record<string, Task> = {},
	E = unknown,
	R = unknown,
	I = any,
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
	// TODO: for caching. do we use standard schema here as well?
	// but it only supports .validate not encode/decode
	// TODO: wrap fields in cache object
	input?: () => Effect.Effect<I, E, R> // optional input
	// TODO: causes type errors. we shouldnt have to pass in the type here
	encode?: (value: any) => Effect.Effect<string | Uint8Array<ArrayBufferLike>>
	encodingFormat?: "string" | "uint8array"
	// TODO: infer type depending on encodingFormat
	decode?: (value: string | Uint8Array<ArrayBufferLike>) => Effect.Effect<A, E, R>
	computeCacheKey?: (input: I) => string
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
