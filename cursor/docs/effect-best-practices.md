# Effect Best Practices

This guide outlines best practices for using the Effect library in TypeScript. It includes examples of recommended approaches and anti-patterns to avoid.

## 1. Prefer Generators for Complex Workflows

### Do:
Use `Effect.gen` for complex workflows that involve multiple steps or dependencies.

```typescript
import { Effect } from "effect"

const complexWorkflow = Effect.gen(function* () {
  const user = yield* getUserEffect
  const posts = yield* getPostsEffect(user.id)
  const comments = yield* getCommentsEffect(posts.map(p => p.id))
  return { user, posts, comments }
})
```

### Don't:
Avoid chaining multiple `flatMap` or `pipe` operations for complex workflows.

```typescript
// Avoid this
const complexWorkflow = getUserEffect.pipe(
  Effect.flatMap(user => getPostsEffect(user.id)),
  Effect.flatMap(posts => getCommentsEffect(posts.map(p => p.id))),
  Effect.map(comments => ({ user, posts, comments }))
)
```

## 2. Use Tagged Errors

### Do:
Define and use tagged errors for better error handling and type safety.

```typescript
import { Data } from "effect"

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  message: string
}> {}

const fetchData = Effect.tryPromise({
  try: () => db.query("SELECT * FROM users"),
  catch: (error) => new DatabaseError({ message: String(error) })
})
```

### Don't:
Avoid using generic Error objects or strings for errors.

```typescript
// Avoid this
const fetchData = Effect.tryPromise({
  try: () => db.query("SELECT * FROM users"),
  catch: (error) => new Error(`Database error: ${error}`)
})
```

## 3. Leverage Effect's Built-in Concurrency

### Do:
Use Effect's built-in concurrency operators like `Effect.all` or `Effect.forEach`.

```typescript
const fetchAllUsers = Effect.all([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3)
])

const processItems = Effect.forEach(
  items,
  (item) => processItem(item),
  { concurrency: 5 }
)
```

### Don't:
Avoid manual promise-based concurrency or external libraries for basic concurrent operations.

```typescript
// Avoid this
const fetchAllUsers = Promise.all([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3)
]).then(Effect.succeed)

const processItems = Effect.succeed(
  items.map(item => processItem(item))
).pipe(Effect.flatMap(Effect.all))
```

## 4. Use Layers for Dependency Injection

### Do:
Utilize Effect's Layer system for dependency injection and composition.

```typescript
import { Effect, Layer } from "effect"

interface Logger {
  log: (message: string) => Effect.Effect<never, never, void>
}

const LoggerLive = Layer.succeed<Logger>({
  log: (message) => Effect.sync(() => console.log(message))
})

const program = Effect.gen(function* () {
  const logger = yield* Effect.service<Logger>()
  yield* logger.log("Hello, World!")
})

const runnable = program.pipe(Effect.provideLayer(LoggerLive))
```

### Don't:
Avoid passing dependencies manually or using global instances.

```typescript
// Avoid this
const logger = {
  log: (message: string) => Effect.sync(() => console.log(message))
}

const program = logger.log("Hello, World!")
```

## 5. Leverage Effect for Resource Management

### Do:
Use `Effect.acquireRelease` for proper resource management.

```typescript
const managedResource = Effect.acquireRelease(
  Effect.sync(() => openResource()),
  (resource) => Effect.sync(() => resource.close())
)

const useResource = managedResource.pipe(
  Effect.flatMap(resource => Effect.sync(() => resource.use()))
)
```

### Don't:
Avoid manual resource management or try-finally blocks.

```typescript
// Avoid this
const useResource = Effect.sync(() => {
  const resource = openResource()
  try {
    return resource.use()
  } finally {
    resource.close()
  }
})
```

## 6. Use Refined Types for Runtime Validation

### Do:
Leverage Effect's refined types for runtime validation.

```typescript
import { Effect, Data } from "effect"

const PositiveNumber = Data.Number.pipe(
  Data.filter((n): n is number => n > 0)
)

const divide = (a: number, b: number): Effect.Effect<never, string, number> =>
  Effect.gen(function* () {
    const validB = yield* Effect.fromEither(PositiveNumber(b))
    return a / validB
  })
```

### Don't:
Avoid runtime checks without leveraging the type system.

```typescript
// Avoid this
const divide = (a: number, b: number): Effect.Effect<never, string, number> =>
  b > 0
    ? Effect.succeed(a / b)
    : Effect.fail("Cannot divide by zero or negative number")
```

## 7. Use Effect for Asynchronous Operations

### Do:
Wrap asynchronous operations with `Effect.promise` or `Effect.async`.

```typescript
const fetchUser = (id: number) => Effect.promise(() => 
  fetch(`https://api.example.com/users/${id}`).then(res => res.json())
)

const readFile = (path: string) => Effect.async<never, Error, string>(resume => {
  fs.readFile(path, 'utf8', (err, data) => {
    if (err) resume(Effect.fail(err))
    else resume(Effect.succeed(data))
  })
})
```

### Don't:
Avoid using raw promises or callbacks directly.

```typescript
// Avoid this
const fetchUser = (id: number) => 
  fetch(`https://api.example.com/users/${id}`).then(res => res.json())

const readFile = (path: string) => new Promise((resolve, reject) => {
  fs.readFile(path, 'utf8', (err, data) => {
    if (err) reject(err)
    else resolve(data)
  })
})
```

Avoid using yield* _(someEffect)

```typescript
// Avoid this. It is no longer necessary.
const result = yield* _(someEffect)
// instead use
const result = yield* someEffect
```

Remember, these best practices are designed to leverage Effect's powerful features and promote code that is more composable, testable, and maintainable. Always consider the specific needs of your project when applying these guidelines.
```

This markdown file covers several key best practices for using Effect, including:

1. Using generators for complex workflows
2. Using tagged errors
3. Leveraging Effect's built-in concurrency
4. Using layers for dependency injection
5. Using Effect for resource management
6. Using refined types for runtime validation
7. Using Effect for asynchronous operations

Each section includes a "Do" example showing the recommended approach and a "Don't" example showing an anti-pattern to avoid. This format should be easy for LLMs to understand and apply in various coding scenarios.