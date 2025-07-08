// interface Task {
//     // The public task API
//     start: () => Effect.Effect<void, never, never>;
//   }
  
//   type MakeTaskFn = (taskId: string) => Effect.Effect<Task, never, never>;
  
//   class Tasks extends Effect.Service<Tasks>()('tasks', {
//     dependencies: [Agents.Default, DB.Default],
//     effect: Effect.gen(function* () {
//       const db = yield* DB;
//       const agents = yield* Agents;
  
//       // have to explicitly type it, otherwise end up w any due to the recursive call
//       const make: MakeTaskFn = Effect.fn("Tasks.make")(function* (taskId: string) {
//         const task = yield* db.getTask(taskId);
//         const agent = yield* agents.make(task.agentId);
  
//         const start = Effect.fn("Tasks.make.start")(function* () {
//           // just an example to demonstrate the recursive call...
//           for (const step of task.steps) {
//             if (step.delegate) {
//               // is this OK?
//               const subtask = yield* make(step.id);
//             }
//           }
//         });
    
//         return { start };
//       });
  
//       return { make };
//     }),
//   }) {}


				// const taskLayer = Layer.mergeAll(
				// 	Layer.succeed(TaskCtx, {
				// 		...defaultConfig,
				// 		// TODO: wrap with proxy?
				// 		// runTask: asyncRunTask,
				// 		runTask: async <T extends Task>(
				// 			task: T,
				// 			args: TaskParamsToArgs<T> = {} as TaskParamsToArgs<T>,
				// 		): Promise<Effect.Effect.Success<T["effect"]>> => {
				// 			// TODO: convert to positional and named args
				// 			// const taskArgs = mapToTaskArgs(task, args)
				// 			// const { positional, named } = resolveArgsMap(task, args)
				// 			// const positionalArgs = positional.map((p) => p.name)
				// 			// const namedArgs = Object.fromEntries(
				// 			// 	Object.entries(named).map(([name, param]) => [
				// 			// 		name,
				// 			// 		param.name,
				// 			// 	]),
				// 			// )
				// 			// const taskArgs = args.map((arg) => {
				// 			const runtime = makeRuntime({
				// 				globalArgs,
				// 				// TODO: pass in as strings now
				// 				// strings should be parsed outside of makeRuntime
				// 				taskArgs: args,
				// 				iceConfigServiceLayer,
				// 			})
				// 			const result = runtime.runPromise(
				// 				runTask(task, args, progressCb),
				// 			).then((result) => result.result)
				// 			return result
				// 		},
				// 		replica: currentReplica,
				// 		currentNetwork,
				// 		networks,
				// 		users: {
				// 			...defaultConfig.users,
				// 			...currentUsers,
				// 		},
				// 		roles: resolvedRoles,
				// 		// TODO: taskArgs
				// 		// what format? we need to check the task itself
				// 		args: argsMap,
				// 	}),
				// 	Layer.setConfigProvider(
				// 		ConfigProvider.fromMap(
				// 			new Map([...Array.from(configMap.entries())]),
				// 		),
				// 	),
				// )