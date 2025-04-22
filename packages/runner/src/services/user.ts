import { Effect, Context, Layer, Config, Ref } from "effect"
import type { SignIdentity } from "@dfinity/agent"
import { FileSystem, Path } from "@effect/platform"

type Users = {
	[user: string]: {
		[network: string]: {
			identity: SignIdentity
			pem: string
			name: string
			principal: string
			accountId: string
		}
	}
}

export class UserService extends Context.Tag("UserService")<
	UserService,
	{
		getUsers: () => Effect.Effect<Users>
	}
>() {
	static Live = Layer.effect(
		UserService,
		Effect.gen(function* () {
			// TODO: per network, which is part of context?
			const fs = yield* FileSystem.FileSystem
			const path = yield* Path.Path
			const appDir = yield* Config.string("APP_DIR")
			const usersPath = path.join(appDir, ".ice", "users.json")
			// TODO: project-wide users, save in .ice/users/
			// save it per network, like canister_ids
			const fileContent = yield* fs.readFileString(usersPath)
			const parsedUsers = yield* Effect.try<Users>(
				() => JSON.parse(fileContent) as Users,
			)
			const users = yield* Ref.make(parsedUsers)
			return {
				getUsers: () =>
					Effect.gen(function* () {
						return yield* Ref.get(users)
					}),
			}
		}),
	)
}
