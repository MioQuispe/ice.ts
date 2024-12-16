import { Data } from "effect"

export class DeploymentError extends Data.TaggedError("DeploymentError")<{
  message: string
}> {}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  message: string
}> {}

export class ActorError extends Data.TaggedError("ActorError")<{
  message: string
}> {}

export class IdentityError extends Data.TaggedError("IdentityError")<{
  message: string
}> {} 