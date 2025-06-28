import { Context } from "effect"

export class TaskArgsService extends Context.Tag("TaskArgsService")<
	TaskArgsService,
	{
		readonly taskArgs: Record<string, unknown>
	}
>() {}

