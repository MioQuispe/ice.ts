import { Context, Effect, Layer } from "effect"
import type { Task } from "../types/types.js"
import { TaskParamsToArgs, TaskSuccess } from "../tasks/lib.js"
import { ProgressUpdate } from "../tasks/lib.js"
export { Opt } from "../types/types.js"
// import { runTask } from "../tasks/run.js"

export class ParentTaskCtx extends Context.Tag("ParentTaskCtx")<
	ParentTaskCtx,
	{
        runTask: <T extends Task>(
            task: T,
            args?: TaskParamsToArgs<T>,
            progressCb?: (update: ProgressUpdate<unknown>) => void,
        ) => Promise<{
            result: TaskSuccess<T>
            taskId: symbol
            taskPath: string
        }>
	}
>() {}

// export const makeParentTaskCtx = () => Layer.succeed(ParentTaskCtx, ParentTaskCtx.of({ runTask }))
