└── packages
    └── cli
        ├── CHANGELOG.md
        ├── LICENSE
        ├── README.md
        ├── docgen.json
        ├── examples
            ├── minigit.ts
            ├── naval-fate.ts
            ├── naval-fate
            │   ├── domain.ts
            │   └── store.ts
            └── prompt.ts
        ├── package.json
        ├── src
            ├── Args.ts
            ├── AutoCorrect.ts
            ├── BuiltInOptions.ts
            ├── CliApp.ts
            ├── CliConfig.ts
            ├── Command.ts
            ├── CommandDescriptor.ts
            ├── CommandDirective.ts
            ├── ConfigFile.ts
            ├── HelpDoc.ts
            ├── HelpDoc
            │   └── Span.ts
            ├── Options.ts
            ├── Primitive.ts
            ├── Prompt.ts
            ├── Usage.ts
            ├── ValidationError.ts
            ├── index.ts
            └── internal
            │   ├── args.ts
            │   ├── autoCorrect.ts
            │   ├── builtInOptions.ts
            │   ├── cliApp.ts
            │   ├── cliConfig.ts
            │   ├── command.ts
            │   ├── commandDescriptor.ts
            │   ├── commandDirective.ts
            │   ├── configFile.ts
            │   ├── files.ts
            │   ├── helpDoc.ts
            │   ├── helpDoc
            │       └── span.ts
            │   ├── options.ts
            │   ├── primitive.ts
            │   ├── prompt.ts
            │   ├── prompt
            │       ├── action.ts
            │       ├── ansi-utils.ts
            │       ├── confirm.ts
            │       ├── date.ts
            │       ├── file.ts
            │       ├── list.ts
            │       ├── multi-select.ts
            │       ├── number.ts
            │       ├── select.ts
            │       ├── text.ts
            │       ├── toggle.ts
            │       └── utils.ts
            │   ├── usage.ts
            │   └── validationError.ts
        ├── test
            ├── Args.test.ts
            ├── AutoCorrect.test.ts
            ├── CliApp.test.ts
            ├── Command.test.ts
            ├── CommandDescriptor.test.ts
            ├── ConfigFile.test.ts
            ├── Options.test.ts
            ├── Primitive.test.ts
            ├── Prompt.test.ts
            ├── Wizard.test.ts
            ├── fixtures
            │   ├── config-file.toml
            │   ├── config.ini
            │   ├── config.json
            │   ├── config.toml
            │   └── config.yaml
            ├── services
            │   ├── MockConsole.ts
            │   └── MockTerminal.ts
            ├── snapshots
            │   ├── bash-completions
            │   ├── fish-completions
            │   └── zsh-completions
            └── utils
            │   ├── grep.ts
            │   ├── tail.ts
            │   └── wc.ts
        ├── tsconfig.build.json
        ├── tsconfig.examples.json
        ├── tsconfig.json
        ├── tsconfig.src.json
        ├── tsconfig.test.json
        └── vitest.config.ts


/packages/cli/LICENSE:
--------------------------------------------------------------------------------
 1 | MIT License
 2 | 
 3 | Copyright (c) 2023 Effectful Technologies Inc
 4 | 
 5 | Permission is hereby granted, free of charge, to any person obtaining a copy
 6 | of this software and associated documentation files (the "Software"), to deal
 7 | in the Software without restriction, including without limitation the rights
 8 | to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 9 | copies of the Software, and to permit persons to whom the Software is
10 | furnished to do so, subject to the following conditions:
11 | 
12 | The above copyright notice and this permission notice shall be included in all
13 | copies or substantial portions of the Software.
14 | 
15 | THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
16 | IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
17 | FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
18 | AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
19 | LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
20 | OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
21 | SOFTWARE.
22 | 


--------------------------------------------------------------------------------
/packages/cli/docgen.json:
--------------------------------------------------------------------------------
 1 | {
 2 |   "$schema": "../../node_modules/@effect/docgen/schema.json",
 3 |   "exclude": ["src/internal/**/*.ts"],
 4 |   "examplesCompilerOptions": {
 5 |     "noEmit": true,
 6 |     "strict": true,
 7 |     "skipLibCheck": true,
 8 |     "moduleResolution": "Bundler",
 9 |     "module": "ES2022",
10 |     "target": "ES2022",
11 |     "lib": ["ES2022", "DOM"],
12 |     "paths": {
13 |       "effect": ["../../../effect/src/index.js"],
14 |       "effect/*": ["../../../effect/src/*.js"],
15 |       "@effect/platform": ["../../../platform/src/index.js"],
16 |       "@effect/platform/*": ["../../../platform/src/*.js"],
17 |       "@effect/platform-node": ["../../../platform-node/src/index.js"],
18 |       "@effect/platform-node/*": ["../../../platform-node/src/*.js"],
19 |       "@effect/platform-node-shared": [
20 |         "../../../platform-node-shared/src/index.js"
21 |       ],
22 |       "@effect/platform-node-shared/*": [
23 |         "../../../platform-node-shared/src/*.js"
24 |       ],
25 |       "@effect/printer": ["../../../printer/src/index.js"],
26 |       "@effect/printer/*": ["../../../printer/src/*.js"],
27 |       "@effect/printer-ansi": ["../../../printer-ansi/src/index.js"],
28 |       "@effect/printer-ansi/*": ["../../../printer-ansi/src/*.js"],
29 |       "@effect/typeclass": ["../../../typeclass/src/index.js"],
30 |       "@effect/typeclass/*": ["../../../typeclass/src/*.js"]
31 |     }
32 |   }
33 | }
34 | 


--------------------------------------------------------------------------------
/packages/cli/examples/minigit.ts:
--------------------------------------------------------------------------------
 1 | import { Args, Command, Options } from "@effect/cli"
 2 | import { NodeContext, NodeRuntime } from "@effect/platform-node"
 3 | import { Array, Config, ConfigProvider, Console, Effect, Option } from "effect"
 4 | 
 5 | // minigit [--version] [-h | --help] [-c <name>=<value>]
 6 | const configs = Options.keyValueMap("c").pipe(Options.optional)
 7 | const minigit = Command.make("minigit", { configs }, ({ configs }) =>
 8 |   Option.match(configs, {
 9 |     onNone: () => Console.log("Running 'minigit'"),
10 |     onSome: (configs) => {
11 |       const keyValuePairs = Array.fromIterable(configs)
12 |         .map(([key, value]) => `${key}=${value}`)
13 |         .join(", ")
14 |       return Console.log(`Running 'minigit' with the following configs: ${keyValuePairs}`)
15 |     }
16 |   }))
17 | 
18 | // minigit add   [-v | --verbose] [--] [<pathspec>...]
19 | const pathspec = Args.text({ name: "pathspec" }).pipe(Args.repeated)
20 | const verbose = Options.boolean("verbose").pipe(
21 |   Options.withAlias("v"),
22 |   Options.withFallbackConfig(Config.boolean("VERBOSE"))
23 | )
24 | const minigitAdd = Command.make("add", { pathspec, verbose }, ({ pathspec, verbose }) => {
25 |   const paths = Array.match(pathspec, {
26 |     onEmpty: () => "",
27 |     onNonEmpty: (paths) => ` ${Array.join(paths, " ")}`
28 |   })
29 |   return Console.log(`Running 'minigit add${paths}' with '--verbose ${verbose}'`)
30 | })
31 | 
32 | // minigit clone [--depth <depth>] [--] <repository> [<directory>]
33 | const repository = Args.text({ name: "repository" })
34 | const directory = Args.directory().pipe(Args.optional)
35 | const depth = Options.integer("depth").pipe(
36 |   Options.withFallbackConfig(Config.integer("DEPTH")),
37 |   Options.optional
38 | )
39 | const minigitClone = Command.make(
40 |   "clone",
41 |   { repository, directory, depth },
42 |   (subcommandConfig) =>
43 |     Effect.flatMap(minigit, (parentConfig) => {
44 |       const depth = Option.map(subcommandConfig.depth, (depth) => `--depth ${depth}`)
45 |       const repository = Option.some(subcommandConfig.repository)
46 |       const optionsAndArgs = Array.getSomes([depth, repository, subcommandConfig.directory])
47 |       const configs = Option.match(parentConfig.configs, {
48 |         onNone: () => "",
49 |         onSome: (map) => Array.fromIterable(map).map(([key, value]) => `${key}=${value}`).join(", ")
50 |       })
51 |       return Console.log(
52 |         "Running 'minigit clone' with the following options and arguments: " +
53 |           `'${Array.join(optionsAndArgs, ", ")}'\n` +
54 |           `and the following configuration parameters: ${configs}`
55 |       )
56 |     })
57 | )
58 | 
59 | const command = minigit.pipe(Command.withSubcommands([minigitAdd, minigitClone]))
60 | 
61 | const cli = Command.run(command, {
62 |   name: "Minigit Distributed Version Control",
63 |   version: "v1.0.0"
64 | })
65 | 
66 | Effect.suspend(() => cli(process.argv)).pipe(
67 |   Effect.withConfigProvider(ConfigProvider.nested(ConfigProvider.fromEnv(), "GIT")),
68 |   Effect.provide(NodeContext.layer),
69 |   NodeRuntime.runMain
70 | )
71 | 


--------------------------------------------------------------------------------
/packages/cli/examples/naval-fate.ts:
--------------------------------------------------------------------------------
  1 | import { Args, CliConfig, Command, Options } from "@effect/cli"
  2 | import { NodeContext, NodeKeyValueStore, NodeRuntime } from "@effect/platform-node"
  3 | import * as Console from "effect/Console"
  4 | import * as Effect from "effect/Effect"
  5 | import * as Layer from "effect/Layer"
  6 | import * as NavalFateStore from "./naval-fate/store.js"
  7 | 
  8 | const { createShip, moveShip, removeMine, setMine, shoot } = Effect.serviceFunctions(
  9 |   NavalFateStore.NavalFateStore
 10 | )
 11 | 
 12 | // naval_fate [-h | --help] [--version]
 13 | // naval_fate ship new <name>...
 14 | // naval_fate ship move [--speed=<kn>] <name> <x> <y>
 15 | // naval_fate ship shoot <x> <y>
 16 | // naval_fate mine set <x> <y> [--moored]
 17 | // naval_fate mine remove <x> <y> [--moored]
 18 | 
 19 | const nameArg = Args.text({ name: "name" }).pipe(Args.withDescription("The name of the ship"))
 20 | const xArg = Args.integer({ name: "x" }).pipe(Args.withDescription("The x coordinate"))
 21 | const yArg = Args.integer({ name: "y" }).pipe(Args.withDescription("The y coordinate"))
 22 | const coordinatesArg = { x: xArg, y: yArg }
 23 | const nameAndCoordinatesArg = { name: nameArg, ...coordinatesArg }
 24 | 
 25 | const mooredOption = Options.boolean("moored").pipe(
 26 |   Options.withDescription("Whether the mine is moored (anchored) or drifting")
 27 | )
 28 | const speedOption = Options.integer("speed").pipe(
 29 |   Options.withDescription("Speed in knots"),
 30 |   Options.withDefault(10)
 31 | )
 32 | 
 33 | const shipCommand = Command.make("ship", {
 34 |   verbose: Options.boolean("verbose")
 35 | }).pipe(Command.withDescription("Controls a ship in Naval Fate"))
 36 | 
 37 | const newShipCommand = Command.make("new", {
 38 |   name: nameArg
 39 | }, ({ name }) =>
 40 |   Effect.gen(function*() {
 41 |     const { verbose } = yield* shipCommand
 42 |     yield* createShip(name)
 43 |     yield* Console.log(`Created ship: '${name}'`)
 44 |     if (verbose) {
 45 |       yield* Console.log(`Verbose mode enabled`)
 46 |     }
 47 |   })).pipe(Command.withDescription("Create a new ship"))
 48 | 
 49 | const moveShipCommand = Command.make("move", {
 50 |   ...nameAndCoordinatesArg,
 51 |   speed: speedOption
 52 | }, ({ name, speed, x, y }) =>
 53 |   Effect.gen(function*() {
 54 |     yield* moveShip(name, x, y)
 55 |     yield* Console.log(`Moving ship '${name}' to coordinates (${x}, ${y}) at ${speed} knots`)
 56 |   })).pipe(Command.withDescription("Move a ship"))
 57 | 
 58 | const shootShipCommand = Command.make(
 59 |   "shoot",
 60 |   { ...coordinatesArg },
 61 |   ({ x, y }) =>
 62 |     Effect.gen(function*() {
 63 |       yield* shoot(x, y)
 64 |       yield* Console.log(`Shot cannons at coordinates (${x}, ${y})`)
 65 |     })
 66 | ).pipe(Command.withDescription("Shoot from a ship"))
 67 | 
 68 | const mineCommand = Command.make("mine").pipe(
 69 |   Command.withDescription("Controls mines in Naval Fate")
 70 | )
 71 | 
 72 | const setMineCommand = Command.make("set", {
 73 |   ...coordinatesArg,
 74 |   moored: mooredOption
 75 | }, ({ moored, x, y }) =>
 76 |   Effect.gen(function*() {
 77 |     yield* setMine(x, y)
 78 |     yield* Console.log(`Set ${moored ? "moored" : "drifting"} mine at coordinates (${x}, ${y})`)
 79 |   })).pipe(Command.withDescription("Set a mine at specific coordinates"))
 80 | 
 81 | const removeMineCommand = Command.make("remove", {
 82 |   ...coordinatesArg
 83 | }, ({ x, y }) =>
 84 |   Effect.gen(function*() {
 85 |     yield* removeMine(x, y)
 86 |     yield* Console.log(`Removing mine at coordinates (${x}, ${y}), if present`)
 87 |   })).pipe(Command.withDescription("Remove a mine at specific coordinates"))
 88 | 
 89 | const command = Command.make("naval_fate").pipe(
 90 |   Command.withDescription("An implementation of the Naval Fate CLI application."),
 91 |   Command.withSubcommands([
 92 |     shipCommand.pipe(Command.withSubcommands([
 93 |       newShipCommand,
 94 |       moveShipCommand,
 95 |       shootShipCommand
 96 |     ])),
 97 |     mineCommand.pipe(Command.withSubcommands([
 98 |       setMineCommand,
 99 |       removeMineCommand
100 |     ]))
101 |   ])
102 | )
103 | 
104 | const ConfigLive = CliConfig.layer({
105 |   showBuiltIns: false
106 | })
107 | 
108 | const NavalFateLive = NavalFateStore.layer.pipe(
109 |   Layer.provide(NodeKeyValueStore.layerFileSystem("naval-fate-store"))
110 | )
111 | 
112 | const MainLayer = Layer.mergeAll(
113 |   ConfigLive,
114 |   NavalFateLive,
115 |   NodeContext.layer
116 | )
117 | 
118 | const cli = Command.run(command, {
119 |   name: "Naval Fate",
120 |   version: "1.0.0"
121 | })
122 | 
123 | Effect.suspend(() => cli(process.argv)).pipe(
124 |   Effect.provide(MainLayer),
125 |   Effect.tapErrorCause(Effect.logError),
126 |   NodeRuntime.runMain
127 | )
128 | 


--------------------------------------------------------------------------------
/packages/cli/examples/naval-fate/domain.ts:
--------------------------------------------------------------------------------
 1 | import * as Data from "effect/Data"
 2 | import * as Schema from "effect/Schema"
 3 | 
 4 | /**
 5 |  * An error that occurs when attempting to create a Naval Fate ship that already
 6 |  * exists.
 7 |  */
 8 | export class ShipExistsError extends Data.TaggedError("ShipExistsError")<{
 9 |   readonly name: string
10 | }> {
11 |   toString(): string {
12 |     return `ShipExistsError: ship with name '${this.name}' already exists`
13 |   }
14 | }
15 | 
16 | /**
17 |  * An error that occurs when attempting to move a Naval Fate ship that does not
18 |  * exist.
19 |  */
20 | export class ShipNotFoundError extends Data.TaggedError("ShipNotFoundError")<{
21 |   readonly name: string
22 |   readonly x: number
23 |   readonly y: number
24 | }> {
25 |   toString(): string {
26 |     return `ShipNotFoundError: ship with name '${this.name}' does not exist`
27 |   }
28 | }
29 | 
30 | /**
31 |  * An error that occurs when attempting to move a Naval Fate ship to coordinates
32 |  * already occupied by another ship.
33 |  */
34 | export class CoordinatesOccupiedError extends Data.TaggedError("CoordinatesOccupiedError")<{
35 |   readonly name: string
36 |   readonly x: number
37 |   readonly y: number
38 | }> {
39 |   toString(): string {
40 |     return `CoordinatesOccupiedError: ship with name '${this.name}' already occupies coordinates (${this.x}, ${this.y})`
41 |   }
42 | }
43 | 
44 | /**
45 |  * Represents a Naval Fate ship.
46 |  */
47 | export class Ship extends Schema.Class<Ship>("Ship")({
48 |   name: Schema.String,
49 |   x: Schema.Number,
50 |   y: Schema.Number,
51 |   status: Schema.Literal("sailing", "destroyed")
52 | }) {
53 |   static readonly create = (name: string) => new Ship({ name, x: 0, y: 0, status: "sailing" })
54 | 
55 |   hasCoordinates(x: number, y: number): boolean {
56 |     return this.x === x && this.y === y
57 |   }
58 | 
59 |   move(x: number, y: number): Ship {
60 |     return new Ship({ name: this.name, x, y, status: this.status })
61 |   }
62 | 
63 |   destroy(): Ship {
64 |     return new Ship({ name: this.name, x: this.x, y: this.y, status: "destroyed" })
65 |   }
66 | }
67 | 
68 | /**
69 |  * Represents a Naval Fate mine.
70 |  */
71 | export class Mine extends Schema.Class<Mine>("Mine")({
72 |   x: Schema.Number,
73 |   y: Schema.Number
74 | }) {
75 |   static readonly create = (x: number, y: number) => new Mine({ x, y })
76 | 
77 |   hasCoordinates(x: number, y: number): boolean {
78 |     return this.x === x && this.y === y
79 |   }
80 | }
81 | 


--------------------------------------------------------------------------------
/packages/cli/examples/naval-fate/store.ts:
--------------------------------------------------------------------------------
  1 | import * as KeyValueStore from "@effect/platform/KeyValueStore"
  2 | import * as Arr from "effect/Array"
  3 | import * as Context from "effect/Context"
  4 | import * as Effect from "effect/Effect"
  5 | import { pipe } from "effect/Function"
  6 | import * as Layer from "effect/Layer"
  7 | import * as Option from "effect/Option"
  8 | import * as Schema from "effect/Schema"
  9 | import { CoordinatesOccupiedError, Mine, Ship, ShipExistsError, ShipNotFoundError } from "./domain.js"
 10 | 
 11 | /**
 12 |  * Represents the storage layer for the Naval Fate command-line application.
 13 |  */
 14 | export interface NavalFateStore {
 15 |   createShip(name: string): Effect.Effect<Ship, ShipExistsError>
 16 |   moveShip(
 17 |     name: string,
 18 |     x: number,
 19 |     y: number
 20 |   ): Effect.Effect<Ship, CoordinatesOccupiedError | ShipNotFoundError>
 21 |   shoot(x: number, y: number): Effect.Effect<void>
 22 |   setMine(x: number, y: number): Effect.Effect<void>
 23 |   removeMine(x: number, y: number): Effect.Effect<void>
 24 | }
 25 | 
 26 | export const NavalFateStore = Context.GenericTag<NavalFateStore>("NavalFateStore")
 27 | 
 28 | export const make = Effect.gen(function*() {
 29 |   const shipsStore = yield* Effect.map(
 30 |     KeyValueStore.KeyValueStore,
 31 |     (store) => store.forSchema(Schema.ReadonlyMap({ key: Schema.String, value: Ship }))
 32 |   )
 33 |   const minesStore = yield* Effect.map(
 34 |     KeyValueStore.KeyValueStore,
 35 |     (store) => store.forSchema(Schema.Array(Mine))
 36 |   )
 37 | 
 38 |   const getShips = shipsStore.get("ships").pipe(
 39 |     Effect.map(Option.getOrElse<ReadonlyMap<string, Ship>>(() => new Map())),
 40 |     Effect.orDie
 41 |   )
 42 |   const getMines = minesStore.get("mines").pipe(
 43 |     Effect.map(Option.getOrElse<ReadonlyArray<Mine>>(() => [])),
 44 |     Effect.orDie
 45 |   )
 46 |   const setShips = (ships: ReadonlyMap<string, Ship>) => shipsStore.set("ships", ships).pipe(Effect.orDie)
 47 |   const setMines = (mines: ReadonlyArray<Mine>) => minesStore.set("mines", mines).pipe(Effect.orDie)
 48 | 
 49 |   const createShip: NavalFateStore["createShip"] = (name) =>
 50 |     Effect.gen(function*() {
 51 |       const oldShips = yield* getShips
 52 |       const foundShip = Option.fromNullable(oldShips.get(name))
 53 |       if (Option.isSome(foundShip)) {
 54 |         return yield* Effect.fail(new ShipExistsError({ name }))
 55 |       }
 56 |       const ship = Ship.create(name)
 57 |       const newShips = new Map(oldShips).set(name, ship)
 58 |       yield* setShips(newShips)
 59 |       return ship
 60 |     })
 61 | 
 62 |   const moveShip: NavalFateStore["moveShip"] = (name, x, y) =>
 63 |     Effect.gen(function*() {
 64 |       const oldShips = yield* getShips
 65 |       const foundShip = Option.fromNullable(oldShips.get(name))
 66 |       if (Option.isNone(foundShip)) {
 67 |         return yield* Effect.fail(new ShipNotFoundError({ name, x, y }))
 68 |       }
 69 |       const shipAtCoords = pipe(
 70 |         Arr.fromIterable(oldShips.values()),
 71 |         Arr.findFirst((ship) => ship.hasCoordinates(x, y))
 72 |       )
 73 |       if (Option.isSome(shipAtCoords)) {
 74 |         return yield* Effect.fail(
 75 |           new CoordinatesOccupiedError({ name: shipAtCoords.value.name, x, y })
 76 |         )
 77 |       }
 78 |       const mines = yield* getMines
 79 |       const mineAtCoords = Arr.findFirst(mines, (mine) => mine.hasCoordinates(x, y))
 80 |       const ship = Option.isSome(mineAtCoords)
 81 |         ? foundShip.value.move(x, y).destroy()
 82 |         : foundShip.value.move(x, y)
 83 |       const newShips = new Map(oldShips).set(name, ship)
 84 |       yield* setShips(newShips)
 85 |       return ship
 86 |     })
 87 | 
 88 |   const shoot: NavalFateStore["shoot"] = (x, y) =>
 89 |     Effect.gen(function*() {
 90 |       const oldShips = yield* getShips
 91 |       const shipAtCoords = pipe(
 92 |         Arr.fromIterable(oldShips.values()),
 93 |         Arr.findFirst((ship) => ship.hasCoordinates(x, y))
 94 |       )
 95 |       if (Option.isSome(shipAtCoords)) {
 96 |         const ship = shipAtCoords.value.destroy()
 97 |         const newShips = new Map(oldShips).set(ship.name, ship)
 98 |         yield* setShips(newShips)
 99 |       }
100 |     })
101 | 
102 |   const setMine: NavalFateStore["setMine"] = (x, y) =>
103 |     Effect.gen(function*() {
104 |       const mines = yield* getMines
105 |       const mineAtCoords = Arr.findFirst(mines, (mine) => mine.hasCoordinates(x, y))
106 |       if (Option.isNone(mineAtCoords)) {
107 |         const mine = Mine.create(x, y)
108 |         const newMines = Arr.append(mines, mine)
109 |         yield* setMines(newMines)
110 |       }
111 |     })
112 | 
113 |   const removeMine: NavalFateStore["removeMine"] = (x, y) =>
114 |     Effect.gen(function*() {
115 |       const mines = yield* getMines
116 |       const mineAtCoords = Arr.findFirstIndex(mines, (mine) => mine.hasCoordinates(x, y))
117 |       if (Option.isSome(mineAtCoords)) {
118 |         const newMines = Arr.remove(mines, mineAtCoords.value)
119 |         yield* setMines(newMines)
120 |       }
121 |     })
122 | 
123 |   return NavalFateStore.of({
124 |     createShip,
125 |     moveShip,
126 |     shoot,
127 |     setMine,
128 |     removeMine
129 |   })
130 | })
131 | 
132 | export const layer = Layer.effect(NavalFateStore, make)
133 | 


--------------------------------------------------------------------------------
/packages/cli/examples/prompt.ts:
--------------------------------------------------------------------------------
 1 | import * as Command from "@effect/cli/Command"
 2 | import * as Prompt from "@effect/cli/Prompt"
 3 | import * as NodeContext from "@effect/platform-node/NodeContext"
 4 | import * as Runtime from "@effect/platform-node/NodeRuntime"
 5 | import * as Effect from "effect/Effect"
 6 | 
 7 | const colorPrompt = Prompt.select({
 8 |   message: "Pick your favorite color",
 9 |   choices: [
10 |     { title: "Red", value: "#ff0000", description: "This option has a description" },
11 |     { title: "Green", value: "#00ff00", description: "So does this one" },
12 |     { title: "Blue", value: "#0000ff", disabled: true }
13 |   ]
14 | })
15 | 
16 | const confirmPrompt = Prompt.confirm({
17 |   message: "Can you please confirm?"
18 | })
19 | 
20 | const datePrompt = Prompt.date({
21 |   message: "What's your birth day?",
22 |   dateMask: "\"Year:\" YYYY, \"Month:\" MM, \"Day:\" DD \\\\\\\\||// \\Hour: HH, \\Minute: mm, \"Seconds:\" ss",
23 |   validate: (date) =>
24 |     date.getTime() > Date.now()
25 |       ? Effect.fail("Your birth day can't be in the future")
26 |       : Effect.succeed(date)
27 | })
28 | 
29 | const numberPrompt = Prompt.float({
30 |   message: `What is your favorite number?`,
31 |   validate: (n) => n > 0 ? Effect.succeed(n) : Effect.fail("must be greater than 0")
32 | })
33 | 
34 | const passwordPrompt = Prompt.password({
35 |   message: "Enter your password: ",
36 |   validate: (value) =>
37 |     value.length === 0
38 |       ? Effect.fail("Password cannot be empty")
39 |       : Effect.succeed(value)
40 | })
41 | 
42 | const togglePrompt = Prompt.toggle({
43 |   message: "Yes or no?",
44 |   active: "yes",
45 |   inactive: "no"
46 | })
47 | 
48 | const prompt = Prompt.all([
49 |   colorPrompt,
50 |   confirmPrompt,
51 |   datePrompt,
52 |   numberPrompt,
53 |   passwordPrompt,
54 |   togglePrompt
55 | ])
56 | 
57 | const command = Command.prompt("favorites", prompt, Effect.log)
58 | 
59 | const cli = Command.run(command, {
60 |   name: "Prompt Examples",
61 |   version: "0.0.1"
62 | })
63 | 
64 | Effect.suspend(() => cli(process.argv)).pipe(
65 |   Effect.provide(NodeContext.layer),
66 |   Runtime.runMain
67 | )
68 | 


--------------------------------------------------------------------------------
/packages/cli/package.json:
--------------------------------------------------------------------------------
 1 | {
 2 |   "name": "@effect/cli",
 3 |   "version": "0.54.1",
 4 |   "type": "module",
 5 |   "license": "MIT",
 6 |   "description": "A library for building command-line interfaces with Effect",
 7 |   "homepage": "https://effect.website",
 8 |   "repository": {
 9 |     "type": "git",
10 |     "url": "https://github.com/Effect-TS/effect.git",
11 |     "directory": "packages/cli"
12 |   },
13 |   "bugs": {
14 |     "url": "https://github.com/Effect-TS/effect/issues"
15 |   },
16 |   "tags": [
17 |     "cli",
18 |     "typescript",
19 |     "algebraic-data-types",
20 |     "functional-programming"
21 |   ],
22 |   "keywords": [
23 |     "cli",
24 |     "typescript",
25 |     "algebraic-data-types",
26 |     "functional-programming"
27 |   ],
28 |   "publishConfig": {
29 |     "access": "public",
30 |     "directory": "dist",
31 |     "provenance": true
32 |   },
33 |   "scripts": {
34 |     "codegen": "build-utils prepare-v2",
35 |     "build": "pnpm build-esm && pnpm build-annotate && pnpm build-cjs && build-utils pack-v2",
36 |     "build-esm": "tsc -b tsconfig.build.json",
37 |     "build-cjs": "babel build/esm --plugins @babel/transform-export-namespace-from --plugins @babel/transform-modules-commonjs --out-dir build/cjs --source-maps",
38 |     "build-annotate": "babel build/esm --plugins annotate-pure-calls --out-dir build/esm --source-maps",
39 |     "check": "tsc -b tsconfig.json",
40 |     "test": "vitest",
41 |     "coverage": "vitest --coverage"
42 |   },
43 |   "peerDependencies": {
44 |     "@effect/platform": "workspace:^",
45 |     "@effect/printer": "workspace:^",
46 |     "@effect/printer-ansi": "workspace:^",
47 |     "effect": "workspace:^"
48 |   },
49 |   "devDependencies": {
50 |     "@effect/platform": "workspace:^",
51 |     "@effect/platform-node": "workspace:^",
52 |     "@effect/printer": "workspace:^",
53 |     "@effect/printer-ansi": "workspace:^",
54 |     "@types/ini": "^4.1.1",
55 |     "effect": "workspace:^"
56 |   },
57 |   "effect": {
58 |     "generateExports": {
59 |       "include": [
60 |         "**/*.ts"
61 |       ]
62 |     },
63 |     "generateIndex": {
64 |       "include": [
65 |         "**/*.ts"
66 |       ]
67 |     }
68 |   },
69 |   "dependencies": {
70 |     "ini": "^4.1.3",
71 |     "toml": "^3.0.0",
72 |     "yaml": "^2.5.0"
73 |   }
74 | }
75 | 


--------------------------------------------------------------------------------
/packages/cli/src/AutoCorrect.ts:
--------------------------------------------------------------------------------
 1 | /**
 2 |  * @since 1.0.0
 3 |  */
 4 | 
 5 | import type { CliConfig } from "./CliConfig.js"
 6 | import * as InternalAutoCorrect from "./internal/autoCorrect.js"
 7 | 
 8 | /**
 9 |  * @since 1.0.0
10 |  * @category utilities
11 |  */
12 | export const levensteinDistance: (first: string, second: string, config: CliConfig) => number =
13 |   InternalAutoCorrect.levensteinDistance
14 | 


--------------------------------------------------------------------------------
/packages/cli/src/BuiltInOptions.ts:
--------------------------------------------------------------------------------
  1 | /**
  2 |  * @since 1.0.0
  3 |  */
  4 | 
  5 | import type { LogLevel } from "effect/LogLevel"
  6 | import type { Option } from "effect/Option"
  7 | import type { Command } from "./CommandDescriptor.js"
  8 | import type { HelpDoc } from "./HelpDoc.js"
  9 | import * as InternalBuiltInOptions from "./internal/builtInOptions.js"
 10 | import type { Options } from "./Options.js"
 11 | import type { Usage } from "./Usage.js"
 12 | 
 13 | /**
 14 |  * @since 1.0.0
 15 |  * @category models
 16 |  */
 17 | export type BuiltInOptions =
 18 |   | SetLogLevel
 19 |   | ShowHelp
 20 |   | ShowCompletions
 21 |   | ShowWizard
 22 |   | ShowVersion
 23 | 
 24 | /**
 25 |  * @since 1.0.0
 26 |  * @category models
 27 |  */
 28 | export interface SetLogLevel {
 29 |   readonly _tag: "SetLogLevel"
 30 |   readonly level: LogLevel
 31 | }
 32 | 
 33 | /**
 34 |  * @since 1.0.0
 35 |  * @category models
 36 |  */
 37 | export interface ShowHelp {
 38 |   readonly _tag: "ShowHelp"
 39 |   readonly usage: Usage
 40 |   readonly helpDoc: HelpDoc
 41 | }
 42 | 
 43 | /**
 44 |  * @since 1.0.0
 45 |  * @category models
 46 |  */
 47 | export interface ShowCompletions {
 48 |   readonly _tag: "ShowCompletions"
 49 |   readonly shellType: BuiltInOptions.ShellType
 50 | }
 51 | 
 52 | /**
 53 |  * @since 1.0.0
 54 |  * @category models
 55 |  */
 56 | export interface ShowWizard {
 57 |   readonly _tag: "ShowWizard"
 58 |   readonly command: Command<unknown>
 59 | }
 60 | 
 61 | /**
 62 |  * @since 1.0.0
 63 |  * @category models
 64 |  */
 65 | export interface ShowVersion {
 66 |   readonly _tag: "ShowVersion"
 67 | }
 68 | 
 69 | /**
 70 |  * @since 1.0.0
 71 |  */
 72 | export declare namespace BuiltInOptions {
 73 |   /**
 74 |    * @since 1.0.0
 75 |    * @category models
 76 |    */
 77 |   export type ShellType = "bash" | "fish" | "zsh"
 78 | }
 79 | 
 80 | /**
 81 |  * @since 1.0.0
 82 |  * @category options
 83 |  */
 84 | export const builtInOptions: <A>(
 85 |   command: Command<A>,
 86 |   usage: Usage,
 87 |   helpDoc: HelpDoc
 88 | ) => Options<Option<BuiltInOptions>> = InternalBuiltInOptions.builtInOptions
 89 | 
 90 | /**
 91 |  * @since 1.0.0
 92 |  * @category refinements
 93 |  */
 94 | export const isShowCompletions: (self: BuiltInOptions) => self is ShowCompletions =
 95 |   InternalBuiltInOptions.isShowCompletions
 96 | 
 97 | /**
 98 |  * @since 1.0.0
 99 |  * @category refinements
100 |  */
101 | export const isShowHelp: (self: BuiltInOptions) => self is ShowHelp = InternalBuiltInOptions.isShowHelp
102 | 
103 | /**
104 |  * @since 1.0.0
105 |  * @category refinements
106 |  */
107 | export const isShowWizard: (self: BuiltInOptions) => self is ShowWizard = InternalBuiltInOptions.isShowWizard
108 | 
109 | /**
110 |  * @since 1.0.0
111 |  * @category refinements
112 |  */
113 | export const isShowVersion: (self: BuiltInOptions) => self is ShowVersion = InternalBuiltInOptions.isShowVersion
114 | 
115 | /**
116 |  * @since 1.0.0
117 |  * @category constructors
118 |  */
119 | export const showCompletions: (shellType: BuiltInOptions.ShellType) => BuiltInOptions =
120 |   InternalBuiltInOptions.showCompletions
121 | 
122 | /**
123 |  * @since 1.0.0
124 |  * @category constructors
125 |  */
126 | export const showHelp: (usage: Usage, helpDoc: HelpDoc) => BuiltInOptions = InternalBuiltInOptions.showHelp
127 | 
128 | /**
129 |  * @since 1.0.0
130 |  * @category constructors
131 |  */
132 | export const showWizard: (command: Command<unknown>) => BuiltInOptions = InternalBuiltInOptions.showWizard
133 | 
134 | /**
135 |  * @since 1.0.0
136 |  * @category constructors
137 |  */
138 | export const showVersion: BuiltInOptions = InternalBuiltInOptions.showVersion
139 | 


--------------------------------------------------------------------------------
/packages/cli/src/CliApp.ts:
--------------------------------------------------------------------------------
 1 | /**
 2 |  * @since 1.0.0
 3 |  */
 4 | import type { FileSystem } from "@effect/platform/FileSystem"
 5 | import type { Path } from "@effect/platform/Path"
 6 | import type { Terminal } from "@effect/platform/Terminal"
 7 | import type { Effect } from "effect/Effect"
 8 | import type { Pipeable } from "effect/Pipeable"
 9 | import type { Command } from "./CommandDescriptor.js"
10 | import type { HelpDoc } from "./HelpDoc.js"
11 | import type { Span } from "./HelpDoc/Span.js"
12 | import * as InternalCliApp from "./internal/cliApp.js"
13 | import type { ValidationError } from "./ValidationError.js"
14 | 
15 | /**
16 |  * A `CliApp<A>` is a complete description of a command-line application.
17 |  *
18 |  * @since 1.0.0
19 |  * @category models
20 |  */
21 | export interface CliApp<A> extends Pipeable {
22 |   readonly name: string
23 |   readonly version: string
24 |   readonly executable: string
25 |   readonly command: Command<A>
26 |   readonly summary: Span
27 |   readonly footer: HelpDoc
28 | }
29 | 
30 | /**
31 |  * @since 1.0.0
32 |  */
33 | export declare namespace CliApp {
34 |   /**
35 |    * @since 1.0.0
36 |    * @category models
37 |    */
38 |   export type Environment = FileSystem | Path | Terminal
39 | 
40 |   /**
41 |    * @since 1.0.0
42 |    * @category models
43 |    */
44 |   export interface ConstructorArgs<A> {
45 |     readonly name: string
46 |     readonly version: string
47 |     readonly command: Command<A>
48 |     readonly executable?: string | undefined
49 |     readonly summary?: Span | undefined
50 |     readonly footer?: HelpDoc | undefined
51 |   }
52 | }
53 | 
54 | /**
55 |  * @since 1.0.0
56 |  * @category constructors
57 |  */
58 | export const make: <A>(config: CliApp.ConstructorArgs<A>) => CliApp<A> = InternalCliApp.make
59 | 
60 | /**
61 |  * @since 1.0.0
62 |  * @category execution
63 |  */
64 | export const run: {
65 |   <R, E, A>(
66 |     args: ReadonlyArray<string>,
67 |     execute: (a: A) => Effect<void, E, R>
68 |   ): (self: CliApp<A>) => Effect<void | E, CliApp.Environment | R, ValidationError>
69 |   <R, E, A>(
70 |     self: CliApp<A>,
71 |     args: ReadonlyArray<string>,
72 |     execute: (a: A) => Effect<void, E, R>
73 |   ): Effect<void | E, CliApp.Environment | R, ValidationError>
74 | } = InternalCliApp.run
75 | 


--------------------------------------------------------------------------------
/packages/cli/src/CliConfig.ts:
--------------------------------------------------------------------------------
 1 | /**
 2 |  * @since 1.0.0
 3 |  */
 4 | import type * as Context from "effect/Context"
 5 | import type * as Layer from "effect/Layer"
 6 | import * as InternalCliConfig from "./internal/cliConfig.js"
 7 | 
 8 | /**
 9 |  * Represents how arguments from the command-line are to be parsed.
10 |  *
11 |  * @since 1.0.0
12 |  * @category models
13 |  */
14 | export interface CliConfig {
15 |   /**
16 |    * Whether or not the argument parser should be case sensitive.
17 |    *
18 |    * Defaults to `false`.
19 |    */
20 |   readonly isCaseSensitive: boolean
21 |   /**
22 |    * Levenstein distance threshold for when to show auto correct suggestions.
23 |    *
24 |    * Defaults to `2`.
25 |    */
26 |   readonly autoCorrectLimit: number
27 |   /**
28 |    * Whether or not to perform a final check of the command-line arguments for
29 |    * a built-in option, even if the provided command is not valid.
30 |    *
31 |    * Defaults to `false`.
32 |    */
33 |   readonly finalCheckBuiltIn: boolean
34 |   /**
35 |    * Whether or not to display all the names of an option in the usage of a
36 |    * particular command.
37 |    *
38 |    * Defaults to `true`.
39 |    */
40 |   readonly showAllNames: boolean
41 |   /**
42 |    * Whether or not to display built-in options in the help documentation
43 |    * generated for a `Command`.
44 |    *
45 |    * Defaults to `true`.
46 |    */
47 |   readonly showBuiltIns: boolean
48 |   /**
49 |    * Whether or not to display the type of an option in the usage of a
50 |    * particular command.
51 |    *
52 |    * Defaults to `true`.
53 |    */
54 |   readonly showTypes: boolean
55 | }
56 | 
57 | /**
58 |  * @since 1.0.0
59 |  * @category context
60 |  */
61 | export const CliConfig: Context.Tag<CliConfig, CliConfig> = InternalCliConfig.Tag
62 | 
63 | /**
64 |  * @since 1.0.0
65 |  * @category constructors
66 |  */
67 | export const defaultConfig: CliConfig = InternalCliConfig.defaultConfig
68 | 
69 | /**
70 |  * @since 1.0.0
71 |  * @category context
72 |  */
73 | export const defaultLayer: Layer.Layer<CliConfig> = InternalCliConfig.defaultLayer
74 | 
75 | /**
76 |  * @since 1.0.0
77 |  * @category context
78 |  */
79 | export const layer: (config?: Partial<CliConfig>) => Layer.Layer<CliConfig> = InternalCliConfig.layer
80 | 
81 | /**
82 |  * @since 1.0.0
83 |  * @category constructors
84 |  */
85 | export const make: (params: Partial<CliConfig>) => CliConfig = InternalCliConfig.make
86 | 
87 | /**
88 |  * @since 1.0.0
89 |  * @category utilities
90 |  */
91 | export const normalizeCase: {
92 |   (text: string): (self: CliConfig) => string
93 |   (self: CliConfig, text: string): string
94 | } = InternalCliConfig.normalizeCase
95 | 


--------------------------------------------------------------------------------
/packages/cli/src/CommandDescriptor.ts:
--------------------------------------------------------------------------------
  1 | /**
  2 |  * @since 1.0.0
  3 |  */
  4 | import type { FileSystem } from "@effect/platform/FileSystem"
  5 | import type { Path } from "@effect/platform/Path"
  6 | import type { QuitException, Terminal } from "@effect/platform/Terminal"
  7 | import type { NonEmptyReadonlyArray } from "effect/Array"
  8 | import type { Effect } from "effect/Effect"
  9 | import type { HashMap } from "effect/HashMap"
 10 | import type { HashSet } from "effect/HashSet"
 11 | import type { Option } from "effect/Option"
 12 | import type { Pipeable } from "effect/Pipeable"
 13 | import type { Args } from "./Args.js"
 14 | import type { CliConfig } from "./CliConfig.js"
 15 | import type { CommandDirective } from "./CommandDirective.js"
 16 | import type { HelpDoc } from "./HelpDoc.js"
 17 | import * as Internal from "./internal/commandDescriptor.js"
 18 | import type { Options } from "./Options.js"
 19 | import type { Prompt } from "./Prompt.js"
 20 | import type { Usage } from "./Usage.js"
 21 | import type { ValidationError } from "./ValidationError.js"
 22 | 
 23 | /**
 24 |  * @since 1.0.0
 25 |  * @category symbols
 26 |  */
 27 | export const TypeId: unique symbol = Internal.TypeId
 28 | 
 29 | /**
 30 |  * @since 1.0.0
 31 |  * @category symbols
 32 |  */
 33 | export type TypeId = typeof TypeId
 34 | 
 35 | /**
 36 |  * A `Command` represents a command in a command-line application.
 37 |  *
 38 |  * Every command-line application will have at least one command: the
 39 |  * application itself. Other command-line applications may support multiple
 40 |  * commands.
 41 |  *
 42 |  * @since 1.0.0
 43 |  * @category models
 44 |  */
 45 | export interface Command<A> extends Command.Variance<A>, Pipeable {}
 46 | 
 47 | /**
 48 |  * @since 1.0.0
 49 |  */
 50 | export declare namespace Command {
 51 |   /**
 52 |    * @since 1.0.0
 53 |    * @category models
 54 |    */
 55 |   export interface Variance<A> {
 56 |     readonly [TypeId]: {
 57 |       readonly _A: (_: never) => A
 58 |     }
 59 |   }
 60 | 
 61 |   /**
 62 |    * @since 1.0.0
 63 |    * @category models
 64 |    */
 65 |   export type ParsedStandardCommand<Name extends string, OptionsType, ArgsType> = Command.ComputeParsedType<{
 66 |     readonly name: Name
 67 |     readonly options: OptionsType
 68 |     readonly args: ArgsType
 69 |   }>
 70 | 
 71 |   /**
 72 |    * @since 1.0.0
 73 |    * @category models
 74 |    */
 75 |   export type ParsedUserInputCommand<Name extends string, ValueType> = Command.ComputeParsedType<{
 76 |     readonly name: Name
 77 |     readonly value: ValueType
 78 |   }>
 79 | 
 80 |   /**
 81 |    * @since 1.0.0
 82 |    * @category models
 83 |    */
 84 |   export type GetParsedType<C> = C extends Command<infer P> ? P : never
 85 | 
 86 |   /**
 87 |    * @since 1.0.0
 88 |    * @category models
 89 |    */
 90 |   export type ComputeParsedType<A> = { [K in keyof A]: A[K] } extends infer X ? X : never
 91 | 
 92 |   /**
 93 |    * @since 1.0.0
 94 |    * @category models
 95 |    */
 96 |   export type Subcommands<
 97 |     A extends NonEmptyReadonlyArray<readonly [id: unknown, command: Command<any>]>
 98 |   > = {
 99 |     [I in keyof A]: A[I] extends readonly [infer Id, Command<infer Value>] ? readonly [id: Id, value: Value]
100 |       : never
101 |   }[number]
102 | }
103 | 
104 | /**
105 |  * @since 1.0.0
106 |  * @category combinators
107 |  */
108 | export const getHelp: <A>(self: Command<A>, config: CliConfig) => HelpDoc = Internal.getHelp
109 | 
110 | /**
111 |  * @since 1.0.0
112 |  * @category combinators
113 |  */
114 | export const getBashCompletions: <A>(
115 |   self: Command<A>,
116 |   programName: string
117 | ) => Effect<Array<string>> = Internal.getBashCompletions
118 | 
119 | /**
120 |  * @since 1.0.0
121 |  * @category combinators
122 |  */
123 | export const getFishCompletions: <A>(
124 |   self: Command<A>,
125 |   programName: string
126 | ) => Effect<Array<string>> = Internal.getFishCompletions
127 | 
128 | /**
129 |  * @since 1.0.0
130 |  * @category combinators
131 |  */
132 | export const getZshCompletions: <A>(
133 |   self: Command<A>,
134 |   programName: string
135 | ) => Effect<Array<string>> = Internal.getZshCompletions
136 | 
137 | /**
138 |  * @since 1.0.0
139 |  * @category combinators
140 |  */
141 | export const getNames: <A>(self: Command<A>) => HashSet<string> = Internal.getNames
142 | 
143 | /**
144 |  * @since 1.0.0
145 |  * @category combinators
146 |  */
147 | export const getSubcommands: <A>(self: Command<A>) => HashMap<string, Command<unknown>> = Internal.getSubcommands
148 | 
149 | /**
150 |  * @since 1.0.0
151 |  * @category combinators
152 |  */
153 | export const getUsage: <A>(self: Command<A>) => Usage = Internal.getUsage
154 | 
155 | /**
156 |  * @since 1.0.0
157 |  * @category combinators
158 |  */
159 | export const map: {
160 |   <A, B>(f: (a: A) => B): (self: Command<A>) => Command<B>
161 |   <A, B>(self: Command<A>, f: (a: A) => B): Command<B>
162 | } = Internal.map
163 | 
164 | /**
165 |  * @since 1.0.0
166 |  * @category combinators
167 |  */
168 | export const mapEffect: {
169 |   <A, B>(f: (a: A) => Effect<B, ValidationError, FileSystem | Path | Terminal>): (self: Command<A>) => Command<B>
170 |   <A, B>(self: Command<A>, f: (a: A) => Effect<B, ValidationError, FileSystem | Path | Terminal>): Command<B>
171 | } = Internal.mapEffect
172 | 
173 | /**
174 |  * @since 1.0.0
175 |  * @category combinators
176 |  */
177 | export const parse: {
178 |   (
179 |     args: ReadonlyArray<string>,
180 |     config: CliConfig
181 |   ): <A>(
182 |     self: Command<A>
183 |   ) => Effect<CommandDirective<A>, ValidationError, FileSystem | Path | Terminal>
184 |   <A>(
185 |     self: Command<A>,
186 |     args: ReadonlyArray<string>,
187 |     config: CliConfig
188 |   ): Effect<CommandDirective<A>, ValidationError, FileSystem | Path | Terminal>
189 | } = Internal.parse
190 | 
191 | /**
192 |  * @since 1.0.0
193 |  * @category constructors
194 |  */
195 | export const prompt: <Name extends string, A>(
196 |   name: Name,
197 |   prompt: Prompt<A>
198 | ) => Command<{ readonly name: Name; readonly value: A }> = Internal.prompt
199 | 
200 | /**
201 |  * @since 1.0.0
202 |  * @category constructors
203 |  */
204 | export const make: <Name extends string, OptionsType = void, ArgsType = void>(
205 |   name: Name,
206 |   options?: Options<OptionsType>,
207 |   args?: Args<ArgsType>
208 | ) => Command<{ readonly name: Name; readonly options: OptionsType; readonly args: ArgsType }> = Internal.make
209 | 
210 | /**
211 |  * @since 1.0.0
212 |  * @category combinators
213 |  */
214 | export const withDescription: {
215 |   (description: string | HelpDoc): <A>(self: Command<A>) => Command<A>
216 |   <A>(self: Command<A>, description: string | HelpDoc): Command<A>
217 | } = Internal.withDescription
218 | 
219 | /**
220 |  * @since 1.0.0
221 |  * @category combinators
222 |  */
223 | export const withSubcommands: {
224 |   <
225 |     const Subcommands extends readonly [
226 |       readonly [id: unknown, command: Command<any>],
227 |       ...Array<readonly [id: unknown, command: Command<any>]>
228 |     ]
229 |   >(
230 |     subcommands: [...Subcommands]
231 |   ): <A>(
232 |     self: Command<A>
233 |   ) => Command<
234 |     Command.ComputeParsedType<
235 |       A & Readonly<{ subcommand: Option<Command.Subcommands<Subcommands>> }>
236 |     >
237 |   >
238 |   <
239 |     A,
240 |     const Subcommands extends readonly [
241 |       readonly [id: unknown, command: Command<any>],
242 |       ...Array<readonly [id: unknown, command: Command<any>]>
243 |     ]
244 |   >(
245 |     self: Command<A>,
246 |     subcommands: [...Subcommands]
247 |   ): Command<
248 |     Command.ComputeParsedType<
249 |       A & Readonly<{ subcommand: Option<Command.Subcommands<Subcommands>> }>
250 |     >
251 |   >
252 | } = Internal.withSubcommands
253 | 
254 | /**
255 |  * @since 1.0.0
256 |  * @category combinators
257 |  */
258 | export const wizard: {
259 |   (
260 |     prefix: ReadonlyArray<string>,
261 |     config: CliConfig
262 |   ): <A>(
263 |     self: Command<A>
264 |   ) => Effect<
265 |     Array<string>,
266 |     ValidationError | QuitException,
267 |     FileSystem | Path | Terminal
268 |   >
269 |   <A>(
270 |     self: Command<A>,
271 |     prefix: ReadonlyArray<string>,
272 |     config: CliConfig
273 |   ): Effect<
274 |     Array<string>,
275 |     ValidationError | QuitException,
276 |     FileSystem | Path | Terminal
277 |   >
278 | } = Internal.wizard
279 | 


--------------------------------------------------------------------------------
/packages/cli/src/CommandDirective.ts:
--------------------------------------------------------------------------------
 1 | /**
 2 |  * @since 1.0.0
 3 |  */
 4 | import type { BuiltInOptions } from "./BuiltInOptions.js"
 5 | import * as InternalCommandDirective from "./internal/commandDirective.js"
 6 | 
 7 | /**
 8 |  * @since 1.0.0
 9 |  * @category models
10 |  */
11 | export type CommandDirective<A> = BuiltIn | UserDefined<A>
12 | 
13 | /**
14 |  * @since 1.0.0
15 |  * @category models
16 |  */
17 | export interface BuiltIn {
18 |   readonly _tag: "BuiltIn"
19 |   readonly option: BuiltInOptions
20 | }
21 | 
22 | /**
23 |  * @since 1.0.0
24 |  * @category models
25 |  */
26 | export interface UserDefined<A> {
27 |   readonly _tag: "UserDefined"
28 |   readonly leftover: ReadonlyArray<string>
29 |   readonly value: A
30 | }
31 | 
32 | /**
33 |  * @since 1.0.0
34 |  * @category constructors
35 |  */
36 | export const builtIn: (option: BuiltInOptions) => CommandDirective<never> = InternalCommandDirective.builtIn
37 | 
38 | /**
39 |  * @since 1.0.0
40 |  * @category refinements
41 |  */
42 | export const isBuiltIn: <A>(self: CommandDirective<A>) => self is BuiltIn = InternalCommandDirective.isBuiltIn
43 | 
44 | /**
45 |  * @since 1.0.0
46 |  * @category refinements
47 |  */
48 | export const isUserDefined: <A>(self: CommandDirective<A>) => self is UserDefined<A> =
49 |   InternalCommandDirective.isUserDefined
50 | 
51 | /**
52 |  * @since 1.0.0
53 |  * @category mapping
54 |  */
55 | export const map: {
56 |   <A, B>(f: (a: A) => B): (self: CommandDirective<A>) => CommandDirective<B>
57 |   <A, B>(self: CommandDirective<A>, f: (a: A) => B): CommandDirective<B>
58 | } = InternalCommandDirective.map
59 | 
60 | /**
61 |  * @since 1.0.0
62 |  * @category constructors
63 |  */
64 | export const userDefined: <A>(leftover: ReadonlyArray<string>, value: A) => CommandDirective<A> =
65 |   InternalCommandDirective.userDefined
66 | 


--------------------------------------------------------------------------------
/packages/cli/src/ConfigFile.ts:
--------------------------------------------------------------------------------
 1 | /**
 2 |  * @since 2.0.0
 3 |  */
 4 | import type { FileSystem } from "@effect/platform/FileSystem"
 5 | import type { Path } from "@effect/platform/Path"
 6 | import type { YieldableError } from "effect/Cause"
 7 | import type { ConfigProvider } from "effect/ConfigProvider"
 8 | import type { Effect } from "effect/Effect"
 9 | import type { Layer } from "effect/Layer"
10 | import * as Internal from "./internal/configFile.js"
11 | 
12 | /**
13 |  * @since 2.0.0
14 |  * @category models
15 |  */
16 | export type Kind = "json" | "yaml" | "ini" | "toml"
17 | 
18 | /**
19 |  * @since 2.0.0
20 |  * @category errors
21 |  */
22 | export const ConfigErrorTypeId: unique symbol = Internal.ConfigErrorTypeId
23 | 
24 | /**
25 |  * @since 2.0.0
26 |  * @category errors
27 |  */
28 | export type ConfigErrorTypeId = typeof ConfigErrorTypeId
29 | 
30 | /**
31 |  * @since 2.0.0
32 |  * @category errors
33 |  */
34 | export interface ConfigFileError extends YieldableError {
35 |   readonly [ConfigErrorTypeId]: ConfigErrorTypeId
36 |   readonly _tag: "ConfigFileError"
37 |   readonly message: string
38 | }
39 | 
40 | /**
41 |  * @since 2.0.0
42 |  * @category errors
43 |  */
44 | export const ConfigFileError: (message: string) => ConfigFileError = Internal.ConfigFileError
45 | 
46 | /**
47 |  * @since 2.0.0
48 |  * @category constructors
49 |  */
50 | export const makeProvider: (
51 |   fileName: string,
52 |   options?:
53 |     | {
54 |       readonly formats?: ReadonlyArray<Kind>
55 |       readonly searchPaths?: ReadonlyArray<string>
56 |     }
57 |     | undefined
58 | ) => Effect<ConfigProvider, ConfigFileError, Path | FileSystem> = Internal.makeProvider
59 | 
60 | /**
61 |  * @since 2.0.0
62 |  * @category layers
63 |  */
64 | export const layer: (
65 |   fileName: string,
66 |   options?:
67 |     | {
68 |       readonly formats?: ReadonlyArray<Kind>
69 |       readonly searchPaths?: ReadonlyArray<string>
70 |     }
71 |     | undefined
72 | ) => Layer<never, ConfigFileError, Path | FileSystem> = Internal.layer
73 | 


--------------------------------------------------------------------------------
/packages/cli/src/HelpDoc.ts:
--------------------------------------------------------------------------------
  1 | /**
  2 |  * @since 1.0.0
  3 |  */
  4 | import type { AnsiDoc } from "@effect/printer-ansi/AnsiDoc"
  5 | import type { NonEmptyReadonlyArray } from "effect/Array"
  6 | import type { Span } from "./HelpDoc/Span.js"
  7 | import * as InternalHelpDoc from "./internal/helpDoc.js"
  8 | 
  9 | /**
 10 |  * A `HelpDoc` models the full documentation for a command-line application.
 11 |  *
 12 |  * `HelpDoc` is composed of optional header and footers, and in-between, a
 13 |  * list of HelpDoc-level content items.
 14 |  *
 15 |  * HelpDoc-level content items, in turn, can be headers, paragraphs, description
 16 |  * lists, and enumerations.
 17 |  *
 18 |  * A `HelpDoc` can be converted into plaintext, JSON, and HTML.
 19 |  *
 20 |  * @since 1.0.0
 21 |  * @category models
 22 |  */
 23 | export type HelpDoc = Empty | Header | Paragraph | DescriptionList | Enumeration | Sequence
 24 | 
 25 | /**
 26 |  * @since 1.0.0
 27 |  * @category models
 28 |  */
 29 | export interface Empty {
 30 |   readonly _tag: "Empty"
 31 | }
 32 | 
 33 | /**
 34 |  * @since 1.0.0
 35 |  * @category models
 36 |  */
 37 | export interface Header {
 38 |   readonly _tag: "Header"
 39 |   readonly value: Span
 40 |   readonly level: number
 41 | }
 42 | 
 43 | /**
 44 |  * @since 1.0.0
 45 |  * @category models
 46 |  */
 47 | export interface Paragraph {
 48 |   readonly _tag: "Paragraph"
 49 |   readonly value: Span
 50 | }
 51 | 
 52 | /**
 53 |  * @since 1.0.0
 54 |  * @category models
 55 |  */
 56 | export interface DescriptionList {
 57 |   readonly _tag: "DescriptionList"
 58 |   readonly definitions: NonEmptyReadonlyArray<readonly [Span, HelpDoc]>
 59 | }
 60 | 
 61 | /**
 62 |  * @since 1.0.0
 63 |  * @category models
 64 |  */
 65 | export interface Enumeration {
 66 |   readonly _tag: "Enumeration"
 67 |   readonly elements: NonEmptyReadonlyArray<HelpDoc>
 68 | }
 69 | 
 70 | /**
 71 |  * @since 1.0.0
 72 |  * @category models
 73 |  */
 74 | export interface Sequence {
 75 |   readonly _tag: "Sequence"
 76 |   readonly left: HelpDoc
 77 |   readonly right: HelpDoc
 78 | }
 79 | 
 80 | /**
 81 |  * @since 1.0.0
 82 |  * @category refinements
 83 |  */
 84 | export const isEmpty: (helpDoc: HelpDoc) => helpDoc is Empty = InternalHelpDoc.isEmpty
 85 | 
 86 | /**
 87 |  * @since 1.0.0
 88 |  * @category refinements
 89 |  */
 90 | export const isHeader: (helpDoc: HelpDoc) => helpDoc is Header = InternalHelpDoc.isHeader
 91 | 
 92 | /**
 93 |  * @since 1.0.0
 94 |  * @category refinements
 95 |  */
 96 | export const isParagraph: (helpDoc: HelpDoc) => helpDoc is Paragraph = InternalHelpDoc.isParagraph
 97 | 
 98 | /**
 99 |  * @since 1.0.0
100 |  * @category refinements
101 |  */
102 | export const isDescriptionList: (helpDoc: HelpDoc) => helpDoc is DescriptionList = InternalHelpDoc.isDescriptionList
103 | 
104 | /**
105 |  * @since 1.0.0
106 |  * @category refinements
107 |  */
108 | export const isEnumeration: (helpDoc: HelpDoc) => helpDoc is Enumeration = InternalHelpDoc.isEnumeration
109 | 
110 | /**
111 |  * @since 1.0.0
112 |  * @category refinements
113 |  */
114 | export const isSequence: (helpDoc: HelpDoc) => helpDoc is Sequence = InternalHelpDoc.isSequence
115 | 
116 | /**
117 |  * @since 1.0.0
118 |  * @category constructors
119 |  */
120 | export const empty: HelpDoc = InternalHelpDoc.empty
121 | 
122 | /**
123 |  * @since 1.0.0
124 |  * @category constructors
125 |  */
126 | export const blocks: (helpDocs: Iterable<HelpDoc>) => HelpDoc = InternalHelpDoc.blocks
127 | 
128 | /**
129 |  * @since 1.0.0
130 |  * @category constructors
131 |  */
132 | export const h1: (value: string | Span) => HelpDoc = InternalHelpDoc.h1
133 | 
134 | /**
135 |  * @since 1.0.0
136 |  * @category constructors
137 |  */
138 | export const h2: (value: string | Span) => HelpDoc = InternalHelpDoc.h2
139 | 
140 | /**
141 |  * @since 1.0.0
142 |  * @category constructors
143 |  */
144 | export const h3: (value: string | Span) => HelpDoc = InternalHelpDoc.h3
145 | 
146 | /**
147 |  * @since 1.0.0
148 |  * @category constructors
149 |  */
150 | export const p: (value: string | Span) => HelpDoc = InternalHelpDoc.p
151 | 
152 | /**
153 |  * @since 1.0.0
154 |  * @category constructors
155 |  */
156 | export const descriptionList: (
157 |   definitions: NonEmptyReadonlyArray<[Span, HelpDoc]>
158 | ) => HelpDoc = InternalHelpDoc.descriptionList
159 | 
160 | /**
161 |  * @since 1.0.0
162 |  * @category constructors
163 |  */
164 | export const enumeration: (elements: NonEmptyReadonlyArray<HelpDoc>) => HelpDoc = InternalHelpDoc.enumeration
165 | 
166 | /**
167 |  * @since 1.0.0
168 |  * @category getters
169 |  */
170 | export const getSpan: (self: HelpDoc) => Span = InternalHelpDoc.getSpan
171 | 
172 | /**
173 |  * @since 1.0.0
174 |  * @category combinators
175 |  */
176 | export const sequence: {
177 |   (that: HelpDoc): (self: HelpDoc) => HelpDoc
178 |   (self: HelpDoc, that: HelpDoc): HelpDoc
179 | } = InternalHelpDoc.sequence
180 | 
181 | /**
182 |  * @since 1.0.0
183 |  * @category combinators
184 |  */
185 | export const orElse: {
186 |   (that: HelpDoc): (self: HelpDoc) => HelpDoc
187 |   (self: HelpDoc, that: HelpDoc): HelpDoc
188 | } = InternalHelpDoc.orElse
189 | 
190 | /**
191 |  * @since 1.0.0
192 |  * @category mapping
193 |  */
194 | export const mapDescriptionList: {
195 |   (f: (span: Span, helpDoc: HelpDoc) => [Span, HelpDoc]): (self: HelpDoc) => HelpDoc
196 |   (self: HelpDoc, f: (span: Span, helpDoc: HelpDoc) => [Span, HelpDoc]): HelpDoc
197 | } = InternalHelpDoc.mapDescriptionList
198 | 
199 | /**
200 |  * @since 1.0.0
201 |  * @category rendering
202 |  */
203 | export const toAnsiDoc: (self: HelpDoc) => AnsiDoc = InternalHelpDoc.toAnsiDoc
204 | 
205 | /**
206 |  * @since 1.0.0
207 |  * @category rendering
208 |  */
209 | export const toAnsiText: (self: HelpDoc) => string = InternalHelpDoc.toAnsiText
210 | 


--------------------------------------------------------------------------------
/packages/cli/src/HelpDoc/Span.ts:
--------------------------------------------------------------------------------
  1 | /**
  2 |  * @since 1.0.0
  3 |  */
  4 | import type { Color } from "@effect/printer-ansi/Color"
  5 | import * as InternalSpan from "../internal/helpDoc/span.js"
  6 | 
  7 | /**
  8 |  * @since 1.0.0
  9 |  * @category models
 10 |  */
 11 | export type Span = Highlight | Sequence | Strong | Text | URI | Weak
 12 | 
 13 | /**
 14 |  * @since 1.0.0
 15 |  * @category models
 16 |  */
 17 | export interface Highlight {
 18 |   readonly _tag: "Highlight"
 19 |   readonly value: Span
 20 |   readonly color: Color
 21 | }
 22 | 
 23 | /**
 24 |  * @since 1.0.0
 25 |  * @category models
 26 |  */
 27 | export interface Sequence {
 28 |   readonly _tag: "Sequence"
 29 |   readonly left: Span
 30 |   readonly right: Span
 31 | }
 32 | 
 33 | /**
 34 |  * @since 1.0.0
 35 |  * @category models
 36 |  */
 37 | export interface Strong {
 38 |   readonly _tag: "Strong"
 39 |   readonly value: Span
 40 | }
 41 | 
 42 | /**
 43 |  * @since 1.0.0
 44 |  * @category models
 45 |  */
 46 | export interface Text {
 47 |   readonly _tag: "Text"
 48 |   readonly value: string
 49 | }
 50 | 
 51 | /**
 52 |  * @since 1.0.0
 53 |  * @category models
 54 |  */
 55 | export interface URI {
 56 |   readonly _tag: "URI"
 57 |   readonly value: string
 58 | }
 59 | 
 60 | /**
 61 |  * @since 1.0.0
 62 |  * @category models
 63 |  */
 64 | export interface Weak {
 65 |   readonly _tag: "Weak"
 66 |   readonly value: Span
 67 | }
 68 | 
 69 | /**
 70 |  * @since 1.0.0
 71 |  * @category refinements
 72 |  */
 73 | export const isSequence: (self: Span) => self is Sequence = InternalSpan.isSequence
 74 | 
 75 | /**
 76 |  * @since 1.0.0
 77 |  * @category refinements
 78 |  */
 79 | export const isStrong: (self: Span) => self is Strong = InternalSpan.isStrong
 80 | 
 81 | /**
 82 |  * @since 1.0.0
 83 |  * @category refinements
 84 |  */
 85 | export const isText: (self: Span) => self is Text = InternalSpan.isText
 86 | 
 87 | /**
 88 |  * @since 1.0.0
 89 |  * @category refinements
 90 |  */
 91 | export const isUri: (self: Span) => self is URI = InternalSpan.isUri
 92 | 
 93 | /**
 94 |  * @since 1.0.0
 95 |  * @category refinements
 96 |  */
 97 | export const isWeak: (self: Span) => self is Weak = InternalSpan.isWeak
 98 | 
 99 | /**
100 |  * @since 1.0.0
101 |  * @category constructors
102 |  */
103 | export const empty: Span = InternalSpan.empty
104 | 
105 | /**
106 |  * @since 1.0.0
107 |  * @category constructors
108 |  */
109 | export const space: Span = InternalSpan.space
110 | 
111 | /**
112 |  * @since 1.0.0
113 |  * @category constructors
114 |  */
115 | export const text: (value: string) => Span = InternalSpan.text
116 | 
117 | /**
118 |  * @since 1.0.0
119 |  * @category constructors
120 |  */
121 | export const code: (value: string | Span) => Span = InternalSpan.code
122 | 
123 | /**
124 |  * @since 1.0.0
125 |  * @category constructors
126 |  */
127 | export const error: (value: string | Span) => Span = InternalSpan.error
128 | 
129 | /**
130 |  * @since 1.0.0
131 |  * @category constructors
132 |  */
133 | export const weak: (value: string | Span) => Span = InternalSpan.weak
134 | 
135 | /**
136 |  * @since 1.0.0
137 |  * @category constructors
138 |  */
139 | export const strong: (value: string | Span) => Span = InternalSpan.strong
140 | 
141 | /**
142 |  * @since 1.0.0
143 |  * @category constructors
144 |  */
145 | export const uri: (value: string) => Span = InternalSpan.uri
146 | 
147 | /**
148 |  * @since 1.0.0
149 |  * @category combinators
150 |  */
151 | export const concat: {
152 |   (that: Span): (self: Span) => Span
153 |   (self: Span, that: Span): Span
154 | } = InternalSpan.concat
155 | 
156 | /**
157 |  * @since 1.0.0
158 |  * @category combinators
159 |  */
160 | export const spans: (spans: Iterable<Span>) => Span = InternalSpan.spans
161 | 


--------------------------------------------------------------------------------
/packages/cli/src/Primitive.ts:
--------------------------------------------------------------------------------
  1 | /**
  2 |  * @since 1.0.0
  3 |  */
  4 | import type { FileSystem } from "@effect/platform/FileSystem"
  5 | import type { Effect } from "effect/Effect"
  6 | import type { Option } from "effect/Option"
  7 | import type { Pipeable } from "effect/Pipeable"
  8 | import type { CliConfig } from "./CliConfig.js"
  9 | import type { HelpDoc } from "./HelpDoc.js"
 10 | import type { Span } from "./HelpDoc/Span.js"
 11 | import * as InternalPrimitive from "./internal/primitive.js"
 12 | import type { Prompt } from "./Prompt.js"
 13 | 
 14 | /**
 15 |  * @since 1.0.0
 16 |  * @category symbol
 17 |  */
 18 | export const PrimitiveTypeId: unique symbol = InternalPrimitive.PrimitiveTypeId as PrimitiveTypeId
 19 | 
 20 | /**
 21 |  * @since 1.0.0
 22 |  * @category symbol
 23 |  */
 24 | export type PrimitiveTypeId = typeof PrimitiveTypeId
 25 | 
 26 | /**
 27 |  * A `Primitive` represents the primitive types supported by Effect CLI.
 28 |  *
 29 |  * Each primitive type has a way to parse and validate from a string.
 30 |  *
 31 |  * @since 1.0.0
 32 |  * @category models
 33 |  */
 34 | export interface Primitive<A> extends Primitive.Variance<A> {}
 35 | 
 36 | /**
 37 |  * @since 1.0.0
 38 |  */
 39 | export declare namespace Primitive {
 40 |   /**
 41 |    * @since 1.0.0
 42 |    * @category models
 43 |    */
 44 |   export interface Variance<A> extends Pipeable {
 45 |     readonly [PrimitiveTypeId]: {
 46 |       readonly _A: (_: never) => A
 47 |     }
 48 |   }
 49 | 
 50 |   /**
 51 |    * @since 1.0.0
 52 |    * @category models
 53 |    */
 54 |   export type PathExists = "yes" | "no" | "either"
 55 | 
 56 |   /**
 57 |    * @since 1.0.0
 58 |    * @category models
 59 |    */
 60 |   export type PathType = "file" | "directory" | "either"
 61 | 
 62 |   /**
 63 |    * @since 1.0.0
 64 |    * @category models
 65 |    */
 66 |   export type ValueType<P> = [P] extends [{
 67 |     readonly [PrimitiveTypeId]: {
 68 |       readonly _A: (_: never) => infer A
 69 |     }
 70 |   }] ? A
 71 |     : never
 72 | }
 73 | 
 74 | /**
 75 |  * @since 1.0.0
 76 |  * @category Predicates
 77 |  */
 78 | export const isBool: <A>(self: Primitive<A>) => boolean = InternalPrimitive.isBool
 79 | 
 80 | /**
 81 |  * Represents a boolean value.
 82 |  *
 83 |  * True values can be passed as one of: `["true", "1", "y", "yes" or "on"]`.
 84 |  * False value can be passed as one of: `["false", "o", "n", "no" or "off"]`.
 85 |  *
 86 |  * @since 1.0.0
 87 |  * @category constructors
 88 |  */
 89 | export const boolean: (defaultValue: Option<boolean>) => Primitive<boolean> = InternalPrimitive.boolean
 90 | 
 91 | /**
 92 |  * @since 1.0.0
 93 |  * @category constructors
 94 |  */
 95 | export const choice: <A>(alternatives: ReadonlyArray<[string, A]>) => Primitive<A> = InternalPrimitive.choice
 96 | 
 97 | /**
 98 |  * Represents a date in ISO-8601 format, such as `2007-12-03T10:15:30`.
 99 |  *
100 |  * @since 1.0.0
101 |  * @category constructors
102 |  */
103 | export const date: Primitive<globalThis.Date> = InternalPrimitive.date
104 | 
105 | /**
106 |  * Represents a floating point number.
107 |  *
108 |  * @since 1.0.0
109 |  * @category constructors
110 |  */
111 | export const float: Primitive<number> = InternalPrimitive.float
112 | 
113 | /**
114 |  * Returns a text representation of the valid choices for a primitive type, if
115 |  * any.
116 |  *
117 |  * @since 1.0.0
118 |  * @category combinators
119 |  */
120 | export const getChoices: <A>(self: Primitive<A>) => Option<string> = InternalPrimitive.getChoices
121 | 
122 | /**
123 |  * Returns help documentation for a primitive type.
124 |  *
125 |  * @since 1.0.0
126 |  * @category combinators
127 |  */
128 | export const getHelp: <A>(self: Primitive<A>) => Span = InternalPrimitive.getHelp
129 | 
130 | /**
131 |  * Returns a string representation of the primitive type.
132 |  *
133 |  * @since 1.0.0
134 |  * @category combinators
135 |  */
136 | export const getTypeName: <A>(self: Primitive<A>) => string = InternalPrimitive.getTypeName
137 | 
138 | /**
139 |  * Represents an integer.
140 |  *
141 |  * @since 1.0.0
142 |  * @category constructors
143 |  */
144 | export const integer: Primitive<number> = InternalPrimitive.integer
145 | 
146 | /**
147 |  * Represents a user-defined piece of text.
148 |  *
149 |  * @since 1.0.0
150 |  * @category constructors
151 |  */
152 | export const text: Primitive<string> = InternalPrimitive.text
153 | 
154 | /**
155 |  * Validates that the specified value, if any, matches the specified primitive
156 |  * type.
157 |  *
158 |  * @since 1.0.0
159 |  * @category combinators
160 |  */
161 | export const validate: {
162 |   (
163 |     value: Option<string>,
164 |     config: CliConfig
165 |   ): <A>(self: Primitive<A>) => Effect<A, string, FileSystem>
166 |   <A>(
167 |     self: Primitive<A>,
168 |     value: Option<string>,
169 |     config: CliConfig
170 |   ): Effect<A, string, FileSystem>
171 | } = InternalPrimitive.validate
172 | 
173 | /**
174 |  * Runs a wizard that will prompt the user for input matching the specified
175 |  * primitive type.
176 |  *
177 |  * @since 1.0.0
178 |  * @category combinators
179 |  */
180 | export const wizard: {
181 |   (help: HelpDoc): <A>(self: Primitive<A>) => Prompt<A>
182 |   <A>(self: Primitive<A>, help: HelpDoc): Prompt<A>
183 | } = InternalPrimitive.wizard
184 | 


--------------------------------------------------------------------------------
/packages/cli/src/Usage.ts:
--------------------------------------------------------------------------------
  1 | /**
  2 |  * @since 1.0.0
  3 |  */
  4 | import type { Option } from "effect/Option"
  5 | import type { CliConfig } from "./CliConfig.js"
  6 | import type { HelpDoc } from "./HelpDoc.js"
  7 | import type { Span } from "./HelpDoc/Span.js"
  8 | import * as InternalUsage from "./internal/usage.js"
  9 | 
 10 | /**
 11 |  * @since 1.0.0
 12 |  * @category models
 13 |  */
 14 | export type Usage = Empty | Mixed | Named | Optional | Repeated | Alternation | Concat
 15 | 
 16 | /**
 17 |  * @since 1.0.0
 18 |  * @category models
 19 |  */
 20 | export interface Empty {
 21 |   readonly _tag: "Empty"
 22 | }
 23 | 
 24 | /**
 25 |  * @since 1.0.0
 26 |  * @category models
 27 |  */
 28 | export interface Mixed {
 29 |   readonly _tag: "Mixed"
 30 | }
 31 | 
 32 | /**
 33 |  * @since 1.0.0
 34 |  * @category models
 35 |  */
 36 | export interface Named {
 37 |   readonly _tag: "Named"
 38 |   readonly names: ReadonlyArray<string>
 39 |   readonly acceptedValues: Option<string>
 40 | }
 41 | 
 42 | /**
 43 |  * @since 1.0.0
 44 |  * @category models
 45 |  */
 46 | export interface Optional {
 47 |   readonly _tag: "Optional"
 48 |   readonly usage: Usage
 49 | }
 50 | 
 51 | /**
 52 |  * @since 1.0.0
 53 |  * @category models
 54 |  */
 55 | export interface Repeated {
 56 |   readonly _tag: "Repeated"
 57 |   readonly usage: Usage
 58 | }
 59 | 
 60 | /**
 61 |  * @since 1.0.0
 62 |  * @category models
 63 |  */
 64 | export interface Alternation {
 65 |   readonly _tag: "Alternation"
 66 |   readonly left: Usage
 67 |   readonly right: Usage
 68 | }
 69 | 
 70 | /**
 71 |  * @since 1.0.0
 72 |  * @category models
 73 |  */
 74 | export interface Concat {
 75 |   readonly _tag: "Concat"
 76 |   readonly left: Usage
 77 |   readonly right: Usage
 78 | }
 79 | 
 80 | /**
 81 |  * @since 1.0.0
 82 |  * @category combinators
 83 |  */
 84 | export const alternation: {
 85 |   (that: Usage): (self: Usage) => Usage
 86 |   (self: Usage, that: Usage): Usage
 87 | } = InternalUsage.alternation
 88 | 
 89 | /**
 90 |  * @since 1.0.0
 91 |  * @category combinators
 92 |  */
 93 | export const concat: {
 94 |   (that: Usage): (self: Usage) => Usage
 95 |   (self: Usage, that: Usage): Usage
 96 | } = InternalUsage.concat
 97 | 
 98 | /**
 99 |  * @since 1.0.0
100 |  * @category constructors
101 |  */
102 | export const empty: Usage = InternalUsage.empty
103 | 
104 | /**
105 |  * @since 1.0.0
106 |  * @category constructors
107 |  */
108 | export const enumerate: {
109 |   (config: CliConfig): (self: Usage) => Array<Span>
110 |   (self: Usage, config: CliConfig): Array<Span>
111 | } = InternalUsage.enumerate
112 | 
113 | /**
114 |  * @since 1.0.0
115 |  * @category combinators
116 |  */
117 | export const getHelp: (self: Usage) => HelpDoc = InternalUsage.getHelp
118 | 
119 | /**
120 |  * @since 1.0.0
121 |  * @category constructors
122 |  */
123 | export const mixed: Usage = InternalUsage.mixed
124 | 
125 | /**
126 |  * @since 1.0.0
127 |  * @category constructors
128 |  */
129 | export const named: (names: ReadonlyArray<string>, acceptedValues: Option<string>) => Usage = InternalUsage.named
130 | 
131 | /**
132 |  * @since 1.0.0
133 |  * @category combinators
134 |  */
135 | export const optional: (self: Usage) => Usage = InternalUsage.optional
136 | 
137 | /**
138 |  * @since 1.0.0
139 |  * @category combinators
140 |  */
141 | export const repeated: (self: Usage) => Usage = InternalUsage.repeated
142 | 


--------------------------------------------------------------------------------
/packages/cli/src/ValidationError.ts:
--------------------------------------------------------------------------------
  1 | /**
  2 |  * @since 1.0.0
  3 |  */
  4 | import type { Command } from "./CommandDescriptor.js"
  5 | import type { HelpDoc } from "./HelpDoc.js"
  6 | import type { CommandDescriptor } from "./index.js"
  7 | import * as InternalCommand from "./internal/commandDescriptor.js"
  8 | import * as InternalValidationError from "./internal/validationError.js"
  9 | 
 10 | /**
 11 |  * @since 1.0.0
 12 |  * @category symbols
 13 |  */
 14 | export const ValidationErrorTypeId: unique symbol = InternalValidationError.ValidationErrorTypeId
 15 | 
 16 | /**
 17 |  * @since 1.0.0
 18 |  * @category symbols
 19 |  */
 20 | export type ValidationErrorTypeId = typeof ValidationErrorTypeId
 21 | 
 22 | /**
 23 |  * @since 1.0.0
 24 |  * @category models
 25 |  */
 26 | export type ValidationError =
 27 |   | CommandMismatch
 28 |   | CorrectedFlag
 29 |   | HelpRequested
 30 |   | InvalidArgument
 31 |   | InvalidValue
 32 |   | MissingValue
 33 |   | MissingFlag
 34 |   | MultipleValuesDetected
 35 |   | MissingSubcommand
 36 |   | NoBuiltInMatch
 37 |   | UnclusteredFlag
 38 | 
 39 | /**
 40 |  * @since 1.0.0
 41 |  * @category models
 42 |  */
 43 | export interface CommandMismatch extends ValidationError.Proto {
 44 |   readonly _tag: "CommandMismatch"
 45 |   readonly error: HelpDoc
 46 | }
 47 | 
 48 | /**
 49 |  * @since 1.0.0
 50 |  * @category models
 51 |  */
 52 | export interface CorrectedFlag extends ValidationError.Proto {
 53 |   readonly _tag: "CorrectedFlag"
 54 |   readonly error: HelpDoc
 55 | }
 56 | 
 57 | /**
 58 |  * @since 1.0.0
 59 |  * @category models
 60 |  */
 61 | export interface HelpRequested extends ValidationError.Proto {
 62 |   readonly _tag: "HelpRequested"
 63 |   readonly error: HelpDoc
 64 |   readonly command: CommandDescriptor.Command<unknown>
 65 | }
 66 | 
 67 | /**
 68 |  * @since 1.0.0
 69 |  * @category models
 70 |  */
 71 | export interface InvalidArgument extends ValidationError.Proto {
 72 |   readonly _tag: "InvalidArgument"
 73 |   readonly error: HelpDoc
 74 | }
 75 | 
 76 | /**
 77 |  * @since 1.0.0
 78 |  * @category models
 79 |  */
 80 | export interface InvalidValue extends ValidationError.Proto {
 81 |   readonly _tag: "InvalidValue"
 82 |   readonly error: HelpDoc
 83 | }
 84 | 
 85 | /**
 86 |  * @since 1.0.0
 87 |  * @category models
 88 |  */
 89 | export interface MissingFlag extends ValidationError.Proto {
 90 |   readonly _tag: "MissingFlag"
 91 |   readonly error: HelpDoc
 92 | }
 93 | 
 94 | /**
 95 |  * @since 1.0.0
 96 |  * @category models
 97 |  */
 98 | export interface MissingValue extends ValidationError.Proto {
 99 |   readonly _tag: "MissingValue"
100 |   readonly error: HelpDoc
101 | }
102 | 
103 | /**
104 |  * @since 1.0.0
105 |  * @category models
106 |  */
107 | export interface MissingSubcommand extends ValidationError.Proto {
108 |   readonly _tag: "MissingSubcommand"
109 |   readonly error: HelpDoc
110 | }
111 | 
112 | /**
113 |  * @since 1.0.0
114 |  * @category models
115 |  */
116 | export interface MultipleValuesDetected extends ValidationError.Proto {
117 |   readonly _tag: "MultipleValuesDetected"
118 |   readonly error: HelpDoc
119 |   readonly values: ReadonlyArray<string>
120 | }
121 | 
122 | /**
123 |  * @since 1.0.0
124 |  * @category models
125 |  */
126 | export interface NoBuiltInMatch extends ValidationError.Proto {
127 |   readonly _tag: "NoBuiltInMatch"
128 |   readonly error: HelpDoc
129 | }
130 | 
131 | /**
132 |  * @since 1.0.0
133 |  * @category models
134 |  */
135 | export interface UnclusteredFlag extends ValidationError.Proto {
136 |   readonly _tag: "UnclusteredFlag"
137 |   readonly error: HelpDoc
138 |   readonly unclustered: ReadonlyArray<string>
139 |   readonly rest: ReadonlyArray<string>
140 | }
141 | 
142 | /**
143 |  * @since 1.0.0
144 |  */
145 | export declare namespace ValidationError {
146 |   /**
147 |    * @since 1.0.0
148 |    * @category models
149 |    */
150 |   export interface Proto {
151 |     readonly [ValidationErrorTypeId]: ValidationErrorTypeId
152 |   }
153 | }
154 | 
155 | /**
156 |  * @since 1.0.0
157 |  * @category refinements
158 |  */
159 | export const isValidationError: (u: unknown) => u is ValidationError = InternalValidationError.isValidationError
160 | 
161 | /**
162 |  * @since 1.0.0
163 |  * @category refinements
164 |  */
165 | export const isCommandMismatch: (self: ValidationError) => self is CommandMismatch =
166 |   InternalValidationError.isCommandMismatch
167 | 
168 | /**
169 |  * @since 1.0.0
170 |  * @category refinements
171 |  */
172 | export const isCorrectedFlag: (self: ValidationError) => self is CorrectedFlag = InternalValidationError.isCorrectedFlag
173 | 
174 | /**
175 |  * @since 1.0.0
176 |  * @category refinements
177 |  */
178 | export const isHelpRequested: (self: ValidationError) => self is HelpRequested = InternalValidationError.isHelpRequested
179 | 
180 | /**
181 |  * @since 1.0.0
182 |  * @category refinements
183 |  */
184 | export const isInvalidArgument: (self: ValidationError) => self is InvalidArgument =
185 |   InternalValidationError.isInvalidArgument
186 | 
187 | /**
188 |  * @since 1.0.0
189 |  * @category refinements
190 |  */
191 | export const isInvalidValue: (self: ValidationError) => self is InvalidValue = InternalValidationError.isInvalidValue
192 | 
193 | /**
194 |  * @since 1.0.0
195 |  * @category refinements
196 |  */
197 | export const isMultipleValuesDetected: (self: ValidationError) => self is MultipleValuesDetected =
198 |   InternalValidationError.isMultipleValuesDetected
199 | 
200 | /**
201 |  * @since 1.0.0
202 |  * @category refinements
203 |  */
204 | export const isMissingFlag: (self: ValidationError) => self is MissingFlag = InternalValidationError.isMissingFlag
205 | 
206 | /**
207 |  * @since 1.0.0
208 |  * @category refinements
209 |  */
210 | export const isMissingValue: (self: ValidationError) => self is MissingValue = InternalValidationError.isMissingValue
211 | 
212 | /**
213 |  * @since 1.0.0
214 |  * @category refinements
215 |  */
216 | export const isMissingSubcommand: (self: ValidationError) => self is MissingSubcommand =
217 |   InternalValidationError.isMissingSubcommand
218 | 
219 | /**
220 |  * @since 1.0.0
221 |  * @category refinements
222 |  */
223 | export const isNoBuiltInMatch: (self: ValidationError) => self is NoBuiltInMatch =
224 |   InternalValidationError.isNoBuiltInMatch
225 | 
226 | /**
227 |  * @since 1.0.0
228 |  * @category refinements
229 |  */
230 | export const isUnclusteredFlag: (self: ValidationError) => self is UnclusteredFlag =
231 |   InternalValidationError.isUnclusteredFlag
232 | 
233 | /**
234 |  * @since 1.0.0
235 |  * @category constructors
236 |  */
237 | export const commandMismatch: (error: HelpDoc) => ValidationError = InternalValidationError.commandMismatch
238 | 
239 | /**
240 |  * @since 1.0.0
241 |  * @category constructors
242 |  */
243 | export const correctedFlag: (error: HelpDoc) => ValidationError = InternalValidationError.correctedFlag
244 | 
245 | /**
246 |  * @since 1.0.0
247 |  * @category constructors
248 |  */
249 | export const helpRequested: <A>(command: Command<A>) => ValidationError = InternalCommand.helpRequestedError
250 | 
251 | /**
252 |  * @since 1.0.0
253 |  * @category constructors
254 |  */
255 | export const invalidArgument: (error: HelpDoc) => ValidationError = InternalValidationError.invalidArgument
256 | 
257 | /**
258 |  * @since 1.0.0
259 |  * @category constructors
260 |  */
261 | export const invalidValue: (error: HelpDoc) => ValidationError = InternalValidationError.invalidValue
262 | 
263 | /**
264 |  * @since 1.0.0
265 |  * @category constructors
266 |  */
267 | export const keyValuesDetected: (
268 |   error: HelpDoc,
269 |   keyValues: ReadonlyArray<string>
270 | ) => ValidationError = InternalValidationError.multipleValuesDetected
271 | 
272 | /**
273 |  * @since 1.0.0
274 |  * @category constructors
275 |  */
276 | export const missingFlag: (error: HelpDoc) => ValidationError = InternalValidationError.missingFlag
277 | 
278 | /**
279 |  * @since 1.0.0
280 |  * @category constructors
281 |  */
282 | export const missingValue: (error: HelpDoc) => ValidationError = InternalValidationError.missingValue
283 | 
284 | /**
285 |  * @since 1.0.0
286 |  * @category constructors
287 |  */
288 | export const missingSubcommand: (error: HelpDoc) => ValidationError = InternalValidationError.missingSubcommand
289 | 
290 | /**
291 |  * @since 1.0.0
292 |  * @category constructors
293 |  */
294 | export const noBuiltInMatch: (error: HelpDoc) => ValidationError = InternalValidationError.noBuiltInMatch
295 | 
296 | /**
297 |  * @since 1.0.0
298 |  * @category constructors
299 |  */
300 | export const unclusteredFlag: (
301 |   error: HelpDoc,
302 |   unclustered: ReadonlyArray<string>,
303 |   rest: ReadonlyArray<string>
304 | ) => ValidationError = InternalValidationError.unclusteredFlag
305 | 


--------------------------------------------------------------------------------
/packages/cli/src/index.ts:
--------------------------------------------------------------------------------
 1 | /**
 2 |  * @since 1.0.0
 3 |  */
 4 | export * as Args from "./Args.js"
 5 | 
 6 | /**
 7 |  * @since 1.0.0
 8 |  */
 9 | export * as AutoCorrect from "./AutoCorrect.js"
10 | 
11 | /**
12 |  * @since 1.0.0
13 |  */
14 | export * as BuiltInOptions from "./BuiltInOptions.js"
15 | 
16 | /**
17 |  * @since 1.0.0
18 |  */
19 | export * as CliApp from "./CliApp.js"
20 | 
21 | /**
22 |  * @since 1.0.0
23 |  */
24 | export * as CliConfig from "./CliConfig.js"
25 | 
26 | /**
27 |  * @since 1.0.0
28 |  */
29 | export * as Command from "./Command.js"
30 | 
31 | /**
32 |  * @since 1.0.0
33 |  */
34 | export * as CommandDescriptor from "./CommandDescriptor.js"
35 | 
36 | /**
37 |  * @since 1.0.0
38 |  */
39 | export * as CommandDirective from "./CommandDirective.js"
40 | 
41 | /**
42 |  * @since 2.0.0
43 |  */
44 | export * as ConfigFile from "./ConfigFile.js"
45 | 
46 | /**
47 |  * @since 1.0.0
48 |  */
49 | export * as HelpDoc from "./HelpDoc.js"
50 | 
51 | /**
52 |  * @since 1.0.0
53 |  */
54 | export * as Span from "./HelpDoc/Span.js"
55 | 
56 | /**
57 |  * @since 1.0.0
58 |  */
59 | export * as Options from "./Options.js"
60 | 
61 | /**
62 |  * @since 1.0.0
63 |  */
64 | export * as Primitive from "./Primitive.js"
65 | 
66 | /**
67 |  * @since 1.0.0
68 |  */
69 | export * as Prompt from "./Prompt.js"
70 | 
71 | /**
72 |  * @since 1.0.0
73 |  */
74 | export * as Usage from "./Usage.js"
75 | 
76 | /**
77 |  * @since 1.0.0
78 |  */
79 | export * as ValidationError from "./ValidationError.js"
80 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/autoCorrect.ts:
--------------------------------------------------------------------------------
 1 | import type * as CliConfig from "../CliConfig.js"
 2 | import * as cliConfig from "./cliConfig.js"
 3 | 
 4 | /** @internal */
 5 | export const levensteinDistance = (
 6 |   first: string,
 7 |   second: string,
 8 |   config: CliConfig.CliConfig
 9 | ): number => {
10 |   if (first.length === 0 && second.length === 0) {
11 |     return 0
12 |   }
13 |   if (first.length === 0) {
14 |     return second.length
15 |   }
16 |   if (second.length === 0) {
17 |     return first.length
18 |   }
19 |   const rowCount = first.length
20 |   const columnCount = second.length
21 |   const matrix = new Array<Array<number>>(rowCount)
22 |   const normalFirst = cliConfig.normalizeCase(config, first)
23 |   const normalSecond = cliConfig.normalizeCase(config, second)
24 |   // Increment each row in the first column
25 |   for (let x = 0; x <= rowCount; x++) {
26 |     matrix[x] = new Array<number>(columnCount)
27 |     matrix[x][0] = x
28 |   }
29 |   // Increment each column in the first row
30 |   for (let y = 0; y <= columnCount; y++) {
31 |     matrix[0][y] = y
32 |   }
33 |   // Fill in the rest of the matrix
34 |   for (let row = 1; row <= rowCount; row++) {
35 |     for (let col = 1; col <= columnCount; col++) {
36 |       const cost = normalFirst.charAt(row - 1) === normalSecond.charAt(col - 1) ? 0 : 1
37 |       matrix[row][col] = Math.min(
38 |         matrix[row][col - 1] + 1,
39 |         Math.min(matrix[row - 1][col] + 1, matrix[row - 1][col - 1] + cost)
40 |       )
41 |     }
42 |   }
43 |   return matrix[rowCount][columnCount]
44 | }
45 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/builtInOptions.ts:
--------------------------------------------------------------------------------
  1 | import * as LogLevel from "effect/LogLevel"
  2 | import * as Option from "effect/Option"
  3 | import type * as BuiltInOptions from "../BuiltInOptions.js"
  4 | import type * as Command from "../CommandDescriptor.js"
  5 | import type * as HelpDoc from "../HelpDoc.js"
  6 | import type * as Options from "../Options.js"
  7 | import type * as Usage from "../Usage.js"
  8 | import * as InternalOptions from "./options.js"
  9 | 
 10 | /** @internal */
 11 | export const setLogLevel = (
 12 |   level: LogLevel.LogLevel
 13 | ): BuiltInOptions.BuiltInOptions => ({
 14 |   _tag: "SetLogLevel",
 15 |   level
 16 | })
 17 | 
 18 | /** @internal */
 19 | export const showCompletions = (
 20 |   shellType: BuiltInOptions.BuiltInOptions.ShellType
 21 | ): BuiltInOptions.BuiltInOptions => ({
 22 |   _tag: "ShowCompletions",
 23 |   shellType
 24 | })
 25 | 
 26 | /** @internal */
 27 | export const showHelp = (
 28 |   usage: Usage.Usage,
 29 |   helpDoc: HelpDoc.HelpDoc
 30 | ): BuiltInOptions.BuiltInOptions => ({
 31 |   _tag: "ShowHelp",
 32 |   usage,
 33 |   helpDoc
 34 | })
 35 | 
 36 | /** @internal */
 37 | export const showWizard = (command: Command.Command<unknown>): BuiltInOptions.BuiltInOptions => ({
 38 |   _tag: "ShowWizard",
 39 |   command
 40 | })
 41 | 
 42 | /** @internal */
 43 | export const showVersion: BuiltInOptions.BuiltInOptions = {
 44 |   _tag: "ShowVersion"
 45 | }
 46 | 
 47 | /** @internal */
 48 | export const isShowCompletions = (
 49 |   self: BuiltInOptions.BuiltInOptions
 50 | ): self is BuiltInOptions.ShowCompletions => self._tag === "ShowCompletions"
 51 | 
 52 | /** @internal */
 53 | export const isShowHelp = (self: BuiltInOptions.BuiltInOptions): self is BuiltInOptions.ShowHelp =>
 54 |   self._tag === "ShowHelp"
 55 | 
 56 | /** @internal */
 57 | export const isShowWizard = (
 58 |   self: BuiltInOptions.BuiltInOptions
 59 | ): self is BuiltInOptions.ShowWizard => self._tag === "ShowWizard"
 60 | 
 61 | /** @internal */
 62 | export const isShowVersion = (
 63 |   self: BuiltInOptions.BuiltInOptions
 64 | ): self is BuiltInOptions.ShowVersion => self._tag === "ShowVersion"
 65 | 
 66 | /** @internal */
 67 | export const completionsOptions: Options.Options<
 68 |   Option.Option<BuiltInOptions.BuiltInOptions.ShellType>
 69 | > = InternalOptions.choiceWithValue("completions", [
 70 |   ["sh", "bash" as const],
 71 |   ["bash", "bash" as const],
 72 |   ["fish", "fish" as const],
 73 |   ["zsh", "zsh" as const]
 74 | ]).pipe(
 75 |   InternalOptions.optional,
 76 |   InternalOptions.withDescription("Generate a completion script for a specific shell.")
 77 | )
 78 | 
 79 | /** @internal */
 80 | export const logLevelOptions: Options.Options<
 81 |   Option.Option<LogLevel.LogLevel>
 82 | > = InternalOptions.choiceWithValue(
 83 |   "log-level",
 84 |   LogLevel.allLevels.map((level) => [level._tag.toLowerCase(), level] as const)
 85 | ).pipe(
 86 |   InternalOptions.optional,
 87 |   InternalOptions.withDescription("Sets the minimum log level for a command.")
 88 | )
 89 | 
 90 | /** @internal */
 91 | export const helpOptions: Options.Options<boolean> = InternalOptions.boolean("help").pipe(
 92 |   InternalOptions.withAlias("h"),
 93 |   InternalOptions.withDescription("Show the help documentation for a command.")
 94 | )
 95 | 
 96 | /** @internal */
 97 | export const versionOptions: Options.Options<boolean> = InternalOptions.boolean("version").pipe(
 98 |   InternalOptions.withDescription("Show the version of the application.")
 99 | )
100 | 
101 | /** @internal */
102 | export const wizardOptions: Options.Options<boolean> = InternalOptions.boolean("wizard").pipe(
103 |   InternalOptions.withDescription("Start wizard mode for a command.")
104 | )
105 | 
106 | /** @internal */
107 | export const builtIns = InternalOptions.all({
108 |   completions: completionsOptions,
109 |   logLevel: logLevelOptions,
110 |   help: helpOptions,
111 |   wizard: wizardOptions,
112 |   version: versionOptions
113 | })
114 | 
115 | /** @internal */
116 | export const builtInOptions = <A>(
117 |   command: Command.Command<A>,
118 |   usage: Usage.Usage,
119 |   helpDoc: HelpDoc.HelpDoc
120 | ): Options.Options<Option.Option<BuiltInOptions.BuiltInOptions>> =>
121 |   InternalOptions.map(builtIns, (builtIn) => {
122 |     if (Option.isSome(builtIn.completions)) {
123 |       return Option.some(showCompletions(builtIn.completions.value))
124 |     }
125 |     if (Option.isSome(builtIn.logLevel)) {
126 |       return Option.some(setLogLevel(builtIn.logLevel.value))
127 |     }
128 |     if (builtIn.help) {
129 |       return Option.some(showHelp(usage, helpDoc))
130 |     }
131 |     if (builtIn.wizard) {
132 |       return Option.some(showWizard(command))
133 |     }
134 |     if (builtIn.version) {
135 |       return Option.some(showVersion)
136 |     }
137 |     return Option.none()
138 |   })
139 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/cliConfig.ts:
--------------------------------------------------------------------------------
 1 | import * as Context from "effect/Context"
 2 | import { dual } from "effect/Function"
 3 | import * as Layer from "effect/Layer"
 4 | import type * as CliConfig from "../CliConfig.js"
 5 | 
 6 | /** @internal */
 7 | export const make = (params?: Partial<CliConfig.CliConfig>): CliConfig.CliConfig => ({
 8 |   ...defaultConfig,
 9 |   ...params
10 | })
11 | 
12 | /** @internal */
13 | export const Tag = Context.GenericTag<CliConfig.CliConfig>("@effect/cli/CliConfig")
14 | 
15 | /** @internal */
16 | export const defaultConfig: CliConfig.CliConfig = {
17 |   isCaseSensitive: false,
18 |   autoCorrectLimit: 2,
19 |   finalCheckBuiltIn: false,
20 |   showAllNames: true,
21 |   showBuiltIns: true,
22 |   showTypes: true
23 | }
24 | 
25 | /** @internal */
26 | export const defaultLayer: Layer.Layer<CliConfig.CliConfig> = Layer.succeed(
27 |   Tag,
28 |   defaultConfig
29 | )
30 | 
31 | /** @internal */
32 | export const layer = (
33 |   config?: Partial<CliConfig.CliConfig>
34 | ): Layer.Layer<CliConfig.CliConfig> => Layer.succeed(Tag, make(config))
35 | 
36 | /** @internal */
37 | export const normalizeCase = dual<
38 |   (text: string) => (self: CliConfig.CliConfig) => string,
39 |   (self: CliConfig.CliConfig, text: string) => string
40 | >(2, (self, text) => self.isCaseSensitive ? text : text.toLowerCase())
41 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/commandDirective.ts:
--------------------------------------------------------------------------------
 1 | import { dual } from "effect/Function"
 2 | import type * as BuiltInOption from "../BuiltInOptions.js"
 3 | import type * as CommandDirective from "../CommandDirective.js"
 4 | 
 5 | /** @internal */
 6 | export const builtIn = (
 7 |   option: BuiltInOption.BuiltInOptions
 8 | ): CommandDirective.CommandDirective<never> => ({
 9 |   _tag: "BuiltIn",
10 |   option
11 | })
12 | 
13 | /** @internal */
14 | export const userDefined = <A>(
15 |   leftover: ReadonlyArray<string>,
16 |   value: A
17 | ): CommandDirective.CommandDirective<A> => ({
18 |   _tag: "UserDefined",
19 |   leftover,
20 |   value
21 | })
22 | 
23 | /** @internal */
24 | export const isBuiltIn = <A>(
25 |   self: CommandDirective.CommandDirective<A>
26 | ): self is CommandDirective.BuiltIn => self._tag === "BuiltIn"
27 | 
28 | /** @internal */
29 | export const isUserDefined = <A>(
30 |   self: CommandDirective.CommandDirective<A>
31 | ): self is CommandDirective.UserDefined<A> => self._tag === "UserDefined"
32 | 
33 | /** @internal */
34 | export const map = dual<
35 |   <A, B>(
36 |     f: (a: A) => B
37 |   ) => (self: CommandDirective.CommandDirective<A>) => CommandDirective.CommandDirective<B>,
38 |   <A, B>(
39 |     self: CommandDirective.CommandDirective<A>,
40 |     f: (a: A) => B
41 |   ) => CommandDirective.CommandDirective<B>
42 | >(2, (self, f) => isUserDefined(self) ? userDefined(self.leftover, f(self.value)) : self)
43 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/configFile.ts:
--------------------------------------------------------------------------------
 1 | import * as FileSystem from "@effect/platform/FileSystem"
 2 | import * as Path from "@effect/platform/Path"
 3 | import * as Cause from "effect/Cause"
 4 | import * as ConfigProvider from "effect/ConfigProvider"
 5 | import * as Context from "effect/Context"
 6 | import * as DefaultServices from "effect/DefaultServices"
 7 | import * as Effect from "effect/Effect"
 8 | import { pipe } from "effect/Function"
 9 | import * as Layer from "effect/Layer"
10 | import type * as ConfigFile from "../ConfigFile.js"
11 | import * as InternalFiles from "./files.js"
12 | 
13 | const fileExtensions: Record<ConfigFile.Kind, ReadonlyArray<string>> = {
14 |   json: ["json"],
15 |   yaml: ["yaml", "yml"],
16 |   ini: ["ini"],
17 |   toml: ["toml", "tml"]
18 | }
19 | 
20 | const allFileExtensions = Object.values(fileExtensions).flat()
21 | 
22 | /** @internal */
23 | export const makeProvider = (fileName: string, options?: {
24 |   readonly formats?: ReadonlyArray<ConfigFile.Kind>
25 |   readonly searchPaths?: ReadonlyArray<string>
26 | }): Effect.Effect<ConfigProvider.ConfigProvider, ConfigFile.ConfigFileError, Path.Path | FileSystem.FileSystem> =>
27 |   Effect.gen(function*() {
28 |     const path = yield* Path.Path
29 |     const fs = yield* FileSystem.FileSystem
30 |     const searchPaths = options?.searchPaths && options.searchPaths.length ? options.searchPaths : ["."]
31 |     const extensions = options?.formats && options.formats.length
32 |       ? options.formats.flatMap((_) => fileExtensions[_])
33 |       : allFileExtensions
34 |     const filePaths = yield* Effect.filter(
35 |       searchPaths.flatMap(
36 |         (searchPath) => extensions.map((ext) => path.join(searchPath, `${fileName}.${ext}`))
37 |       ),
38 |       (path) => Effect.orElseSucceed(fs.exists(path), () => false)
39 |     )
40 |     const providers = yield* Effect.forEach(filePaths, (path) =>
41 |       pipe(
42 |         fs.readFileString(path),
43 |         Effect.mapError((_) => ConfigFileError(`Could not read file (${path})`)),
44 |         Effect.flatMap((content) =>
45 |           Effect.mapError(
46 |             InternalFiles.parse(path, content),
47 |             (message) => ConfigFileError(message)
48 |           )
49 |         ),
50 |         Effect.map((data) => ConfigProvider.fromJson(data))
51 |       ))
52 | 
53 |     if (providers.length === 0) {
54 |       return ConfigProvider.fromMap(new Map())
55 |     }
56 | 
57 |     return providers.reduce((acc, provider) => ConfigProvider.orElse(acc, () => provider))
58 |   })
59 | 
60 | /** @internal */
61 | export const layer = (fileName: string, options?: {
62 |   readonly formats?: ReadonlyArray<ConfigFile.Kind>
63 |   readonly searchPaths?: ReadonlyArray<string>
64 | }): Layer.Layer<never, ConfigFile.ConfigFileError, Path.Path | FileSystem.FileSystem> =>
65 |   pipe(
66 |     makeProvider(fileName, options),
67 |     Effect.map((provider) =>
68 |       Layer.fiberRefLocallyScopedWith(DefaultServices.currentServices, (services) => {
69 |         const current = Context.get(services, ConfigProvider.ConfigProvider)
70 |         return Context.add(services, ConfigProvider.ConfigProvider, ConfigProvider.orElse(current, () => provider))
71 |       })
72 |     ),
73 |     Layer.unwrapEffect
74 |   )
75 | 
76 | /** @internal */
77 | export const ConfigErrorTypeId: ConfigFile.ConfigErrorTypeId = Symbol.for(
78 |   "@effect/cli/ConfigFile/ConfigFileError"
79 | ) as ConfigFile.ConfigErrorTypeId
80 | 
81 | const ConfigFileErrorProto = Object.assign(Object.create(Cause.YieldableError.prototype), {
82 |   [ConfigErrorTypeId]: ConfigErrorTypeId
83 | })
84 | 
85 | /** @internal */
86 | export const ConfigFileError = (message: string): ConfigFile.ConfigFileError => {
87 |   const self = Object.create(ConfigFileErrorProto)
88 |   self._tag = "ConfigFileError"
89 |   self.message = message
90 |   return self
91 | }
92 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/files.ts:
--------------------------------------------------------------------------------
 1 | import * as FileSystem from "@effect/platform/FileSystem"
 2 | import * as Effect from "effect/Effect"
 3 | import * as Ini from "ini"
 4 | import * as Toml from "toml"
 5 | import * as Yaml from "yaml"
 6 | 
 7 | /** @internal */
 8 | export const fileParsers: Record<string, (content: string) => unknown> = {
 9 |   json: (content: string) => JSON.parse(content),
10 |   yaml: (content: string) => Yaml.parse(content),
11 |   yml: (content: string) => Yaml.parse(content),
12 |   ini: (content: string) => Ini.parse(content),
13 |   toml: (content: string) => Toml.parse(content),
14 |   tml: (content: string) => Toml.parse(content)
15 | }
16 | 
17 | /** @internal */
18 | export const read = (
19 |   path: string
20 | ): Effect.Effect<readonly [path: string, content: Uint8Array], string, FileSystem.FileSystem> =>
21 |   Effect.flatMap(
22 |     FileSystem.FileSystem,
23 |     (fs) =>
24 |       Effect.matchEffect(fs.readFile(path), {
25 |         onFailure: (error) => Effect.fail(`Could not read file (${path}): ${error}`),
26 |         onSuccess: (content) => Effect.succeed([path, content] as const)
27 |       })
28 |   )
29 | 
30 | /** @internal */
31 | export const readString = (
32 |   path: string
33 | ): Effect.Effect<readonly [path: string, content: string], string, FileSystem.FileSystem> =>
34 |   Effect.flatMap(
35 |     FileSystem.FileSystem,
36 |     (fs) =>
37 |       Effect.matchEffect(fs.readFileString(path), {
38 |         onFailure: (error) => Effect.fail(`Could not read file (${path}): ${error}`),
39 |         onSuccess: (content) => Effect.succeed([path, content] as const)
40 |       })
41 |   )
42 | 
43 | /** @internal */
44 | export const parse = (
45 |   path: string,
46 |   content: string,
47 |   format?: "json" | "yaml" | "ini" | "toml"
48 | ): Effect.Effect<unknown, string> => {
49 |   const parser = fileParsers[format ?? path.split(".").pop() as string]
50 |   if (parser === undefined) {
51 |     return Effect.fail(`Unsupported file format: ${format}`)
52 |   }
53 | 
54 |   return Effect.try({
55 |     try: () => parser(content),
56 |     catch: (e) => `Could not parse ${format} file (${path}): ${e}`
57 |   })
58 | }
59 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/helpDoc.ts:
--------------------------------------------------------------------------------
  1 | import * as Ansi from "@effect/printer-ansi/Ansi"
  2 | import * as Doc from "@effect/printer-ansi/AnsiDoc"
  3 | import * as Optimize from "@effect/printer/Optimize"
  4 | import * as Arr from "effect/Array"
  5 | import { dual, pipe } from "effect/Function"
  6 | import type * as HelpDoc from "../HelpDoc.js"
  7 | import type * as Span from "../HelpDoc/Span.js"
  8 | import * as InternalSpan from "./helpDoc/span.js"
  9 | 
 10 | /** @internal */
 11 | export const isEmpty = (helpDoc: HelpDoc.HelpDoc): helpDoc is HelpDoc.Empty => helpDoc._tag === "Empty"
 12 | 
 13 | /** @internal */
 14 | export const isHeader = (helpDoc: HelpDoc.HelpDoc): helpDoc is HelpDoc.Header => helpDoc._tag === "Header"
 15 | 
 16 | /** @internal */
 17 | export const isParagraph = (helpDoc: HelpDoc.HelpDoc): helpDoc is HelpDoc.Paragraph => helpDoc._tag === "Paragraph"
 18 | 
 19 | /** @internal */
 20 | export const isDescriptionList = (helpDoc: HelpDoc.HelpDoc): helpDoc is HelpDoc.DescriptionList =>
 21 |   helpDoc._tag === "DescriptionList"
 22 | 
 23 | /** @internal */
 24 | export const isEnumeration = (helpDoc: HelpDoc.HelpDoc): helpDoc is HelpDoc.Enumeration =>
 25 |   helpDoc._tag === "Enumeration"
 26 | 
 27 | /** @internal */
 28 | export const isSequence = (helpDoc: HelpDoc.HelpDoc): helpDoc is HelpDoc.Sequence => helpDoc._tag === "Sequence"
 29 | 
 30 | /** @internal */
 31 | export const empty: HelpDoc.HelpDoc = {
 32 |   _tag: "Empty"
 33 | }
 34 | 
 35 | /** @internal */
 36 | export const sequence = dual<
 37 |   (that: HelpDoc.HelpDoc) => (self: HelpDoc.HelpDoc) => HelpDoc.HelpDoc,
 38 |   (self: HelpDoc.HelpDoc, that: HelpDoc.HelpDoc) => HelpDoc.HelpDoc
 39 | >(2, (self, that) => {
 40 |   if (isEmpty(self)) {
 41 |     return that
 42 |   }
 43 |   if (isEmpty(that)) {
 44 |     return self
 45 |   }
 46 |   return {
 47 |     _tag: "Sequence",
 48 |     left: self,
 49 |     right: that
 50 |   }
 51 | })
 52 | 
 53 | /** @internal */
 54 | export const orElse = dual<
 55 |   (that: HelpDoc.HelpDoc) => (self: HelpDoc.HelpDoc) => HelpDoc.HelpDoc,
 56 |   (self: HelpDoc.HelpDoc, that: HelpDoc.HelpDoc) => HelpDoc.HelpDoc
 57 | >(2, (self, that) => isEmpty(self) ? that : self)
 58 | 
 59 | /** @internal */
 60 | export const blocks = (helpDocs: Iterable<HelpDoc.HelpDoc>): HelpDoc.HelpDoc => {
 61 |   const elements = Arr.fromIterable(helpDocs)
 62 |   if (Arr.isNonEmptyReadonlyArray(elements)) {
 63 |     return elements.slice(1).reduce(sequence, elements[0])
 64 |   }
 65 |   return empty
 66 | }
 67 | 
 68 | /** @internal */
 69 | export const getSpan = (self: HelpDoc.HelpDoc): Span.Span =>
 70 |   isHeader(self) || isParagraph(self) ? self.value : InternalSpan.empty
 71 | 
 72 | /** @internal */
 73 | export const descriptionList = (
 74 |   definitions: Arr.NonEmptyReadonlyArray<[Span.Span, HelpDoc.HelpDoc]>
 75 | ): HelpDoc.HelpDoc => ({
 76 |   _tag: "DescriptionList",
 77 |   definitions
 78 | })
 79 | 
 80 | /** @internal */
 81 | export const enumeration = (
 82 |   elements: Arr.NonEmptyReadonlyArray<HelpDoc.HelpDoc>
 83 | ): HelpDoc.HelpDoc => ({
 84 |   _tag: "Enumeration",
 85 |   elements
 86 | })
 87 | 
 88 | /** @internal */
 89 | export const h1 = (value: string | Span.Span): HelpDoc.HelpDoc => ({
 90 |   _tag: "Header",
 91 |   value: typeof value === "string" ? InternalSpan.text(value) : value,
 92 |   level: 1
 93 | })
 94 | 
 95 | /** @internal */
 96 | export const h2 = (value: string | Span.Span): HelpDoc.HelpDoc => ({
 97 |   _tag: "Header",
 98 |   value: typeof value === "string" ? InternalSpan.text(value) : value,
 99 |   level: 2
100 | })
101 | 
102 | /** @internal */
103 | export const h3 = (value: string | Span.Span): HelpDoc.HelpDoc => ({
104 |   _tag: "Header",
105 |   value: typeof value === "string" ? InternalSpan.text(value) : value,
106 |   level: 3
107 | })
108 | 
109 | /** @internal */
110 | export const p = (value: string | Span.Span): HelpDoc.HelpDoc => ({
111 |   _tag: "Paragraph",
112 |   value: typeof value === "string" ? InternalSpan.text(value) : value
113 | })
114 | 
115 | /** @internal */
116 | export const mapDescriptionList = dual<
117 |   (
118 |     f: (span: Span.Span, helpDoc: HelpDoc.HelpDoc) => [Span.Span, HelpDoc.HelpDoc]
119 |   ) => (self: HelpDoc.HelpDoc) => HelpDoc.HelpDoc,
120 |   (
121 |     self: HelpDoc.HelpDoc,
122 |     f: (span: Span.Span, helpDoc: HelpDoc.HelpDoc) => [Span.Span, HelpDoc.HelpDoc]
123 |   ) => HelpDoc.HelpDoc
124 | >(2, (self, f) =>
125 |   isDescriptionList(self)
126 |     ? descriptionList(Arr.map(self.definitions, ([span, helpDoc]) => f(span, helpDoc)))
127 |     : self)
128 | 
129 | /** @internal */
130 | export const toAnsiDoc = (self: HelpDoc.HelpDoc): Doc.AnsiDoc =>
131 |   Optimize.optimize(toAnsiDocInternal(self), Optimize.Deep)
132 | 
133 | /** @internal */
134 | export const toAnsiText = (self: HelpDoc.HelpDoc): string => Doc.render(toAnsiDoc(self), { style: "pretty" })
135 | 
136 | // =============================================================================
137 | // Internals
138 | // =============================================================================
139 | 
140 | const toAnsiDocInternal = (self: HelpDoc.HelpDoc): Doc.AnsiDoc => {
141 |   switch (self._tag) {
142 |     case "Empty": {
143 |       return Doc.empty
144 |     }
145 |     case "Header": {
146 |       return pipe(
147 |         Doc.annotate(InternalSpan.toAnsiDoc(self.value), Ansi.bold),
148 |         Doc.cat(Doc.hardLine)
149 |       )
150 |     }
151 |     case "Paragraph": {
152 |       return pipe(
153 |         InternalSpan.toAnsiDoc(self.value),
154 |         Doc.cat(Doc.hardLine)
155 |       )
156 |     }
157 |     case "DescriptionList": {
158 |       const definitions = self.definitions.map(([span, doc]) =>
159 |         Doc.cats([
160 |           Doc.annotate(InternalSpan.toAnsiDoc(span), Ansi.bold),
161 |           Doc.empty,
162 |           Doc.indent(toAnsiDocInternal(doc), 2)
163 |         ])
164 |       )
165 |       return Doc.vsep(definitions)
166 |     }
167 |     case "Enumeration": {
168 |       const elements = self.elements.map((doc) => Doc.cat(Doc.text("- "), toAnsiDocInternal(doc)))
169 |       return Doc.indent(Doc.vsep(elements), 2)
170 |     }
171 |     case "Sequence": {
172 |       return Doc.vsep([
173 |         toAnsiDocInternal(self.left),
174 |         toAnsiDocInternal(self.right)
175 |       ])
176 |     }
177 |   }
178 | }
179 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/helpDoc/span.ts:
--------------------------------------------------------------------------------
  1 | import * as Ansi from "@effect/printer-ansi/Ansi"
  2 | import * as Doc from "@effect/printer-ansi/AnsiDoc"
  3 | import * as Color from "@effect/printer-ansi/Color"
  4 | import * as Arr from "effect/Array"
  5 | import { dual } from "effect/Function"
  6 | import type * as Span from "../../HelpDoc/Span.js"
  7 | 
  8 | /** @internal */
  9 | export const text = (value: string): Span.Span => ({
 10 |   _tag: "Text",
 11 |   value
 12 | })
 13 | 
 14 | /** @internal */
 15 | export const empty: Span.Span = text("")
 16 | 
 17 | /** @internal */
 18 | export const space: Span.Span = text(" ")
 19 | 
 20 | /** @internal */
 21 | export const code = (value: Span.Span | string): Span.Span => highlight(value, Color.white)
 22 | 
 23 | /** @internal */
 24 | export const error = (value: Span.Span | string): Span.Span => highlight(value, Color.red)
 25 | 
 26 | /** @internal */
 27 | export const highlight = (value: Span.Span | string, color: Color.Color): Span.Span => ({
 28 |   _tag: "Highlight",
 29 |   value: typeof value === "string" ? text(value) : value,
 30 |   color
 31 | })
 32 | 
 33 | /** @internal */
 34 | export const strong = (value: Span.Span | string): Span.Span => ({
 35 |   _tag: "Strong",
 36 |   value: typeof value === "string" ? text(value) : value
 37 | })
 38 | 
 39 | /** @internal */
 40 | export const uri = (value: string): Span.Span => ({
 41 |   _tag: "URI",
 42 |   value
 43 | })
 44 | 
 45 | /** @internal */
 46 | export const weak = (value: Span.Span | string): Span.Span => ({
 47 |   _tag: "Weak",
 48 |   value: typeof value === "string" ? text(value) : value
 49 | })
 50 | 
 51 | /** @internal */
 52 | export const isSequence = (self: Span.Span): self is Span.Sequence => self._tag === "Sequence"
 53 | 
 54 | /** @internal */
 55 | export const isStrong = (self: Span.Span): self is Span.Strong => self._tag === "Strong"
 56 | 
 57 | /** @internal */
 58 | export const isText = (self: Span.Span): self is Span.Text => self._tag === "Text"
 59 | 
 60 | /** @internal */
 61 | export const isUri = (self: Span.Span): self is Span.URI => self._tag === "URI"
 62 | 
 63 | /** @internal */
 64 | export const isWeak = (self: Span.Span): self is Span.Weak => self._tag === "Weak"
 65 | 
 66 | /** @internal */
 67 | export const concat = dual<
 68 |   (that: Span.Span) => (self: Span.Span) => Span.Span,
 69 |   (self: Span.Span, that: Span.Span) => Span.Span
 70 | >(2, (self, that): Span.Span => ({
 71 |   _tag: "Sequence",
 72 |   left: self,
 73 |   right: that
 74 | }))
 75 | 
 76 | export const getText = (self: Span.Span): string => {
 77 |   switch (self._tag) {
 78 |     case "Text":
 79 |     case "URI": {
 80 |       return self.value
 81 |     }
 82 |     case "Highlight":
 83 |     case "Weak":
 84 |     case "Strong": {
 85 |       return getText(self.value)
 86 |     }
 87 |     case "Sequence": {
 88 |       return getText(self.left) + getText(self.right)
 89 |     }
 90 |   }
 91 | }
 92 | 
 93 | /** @internal */
 94 | export const spans = (spans: Iterable<Span.Span>): Span.Span => {
 95 |   const elements = Arr.fromIterable(spans)
 96 |   if (Arr.isNonEmptyReadonlyArray(elements)) {
 97 |     return elements.slice(1).reduce(concat, elements[0])
 98 |   }
 99 |   return empty
100 | }
101 | 
102 | /** @internal */
103 | export const isEmpty = (self: Span.Span): boolean => size(self) === 0
104 | 
105 | /** @internal */
106 | export const size = (self: Span.Span): number => {
107 |   switch (self._tag) {
108 |     case "Text":
109 |     case "URI": {
110 |       return self.value.length
111 |     }
112 |     case "Highlight":
113 |     case "Strong":
114 |     case "Weak": {
115 |       return size(self.value)
116 |     }
117 |     case "Sequence": {
118 |       return size(self.left) + size(self.right)
119 |     }
120 |   }
121 | }
122 | 
123 | /** @internal */
124 | export const toAnsiDoc = (self: Span.Span): Doc.AnsiDoc => {
125 |   switch (self._tag) {
126 |     case "Highlight": {
127 |       return Doc.annotate(toAnsiDoc(self.value), Ansi.color(self.color))
128 |     }
129 |     case "Sequence": {
130 |       return Doc.cat(toAnsiDoc(self.left), toAnsiDoc(self.right))
131 |     }
132 |     case "Strong": {
133 |       return Doc.annotate(toAnsiDoc(self.value), Ansi.bold)
134 |     }
135 |     case "Text": {
136 |       return Doc.text(self.value)
137 |     }
138 |     case "URI": {
139 |       return Doc.annotate(Doc.text(self.value), Ansi.underlined)
140 |     }
141 |     case "Weak": {
142 |       return Doc.annotate(toAnsiDoc(self.value), Ansi.black)
143 |     }
144 |   }
145 | }
146 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/prompt.ts:
--------------------------------------------------------------------------------
  1 | import * as Terminal from "@effect/platform/Terminal"
  2 | import * as Doc from "@effect/printer-ansi/AnsiDoc"
  3 | import * as Effect from "effect/Effect"
  4 | import * as Effectable from "effect/Effectable"
  5 | import { dual } from "effect/Function"
  6 | import * as Pipeable from "effect/Pipeable"
  7 | import * as Ref from "effect/Ref"
  8 | import type * as Prompt from "../Prompt.js"
  9 | import { Action } from "./prompt/action.js"
 10 | 
 11 | /** @internal */
 12 | const PromptSymbolKey = "@effect/cli/Prompt"
 13 | 
 14 | /** @internal */
 15 | export const PromptTypeId: Prompt.PromptTypeId = Symbol.for(
 16 |   PromptSymbolKey
 17 | ) as Prompt.PromptTypeId
 18 | 
 19 | /** @internal */
 20 | const proto = {
 21 |   ...Effectable.CommitPrototype,
 22 |   [PromptTypeId]: {
 23 |     _Output: (_: never) => _
 24 |   },
 25 |   commit(): Effect.Effect<Terminal.Terminal, Terminal.QuitException, unknown> {
 26 |     return run(this as any)
 27 |   },
 28 |   pipe() {
 29 |     return Pipeable.pipeArguments(this, arguments)
 30 |   }
 31 | }
 32 | 
 33 | /** @internal */
 34 | type Op<Tag extends string, Body = {}> = Prompt.Prompt<never> & Body & {
 35 |   readonly _tag: Tag
 36 | }
 37 | 
 38 | /** @internal */
 39 | export type Primitive = Loop | OnSuccess | Succeed
 40 | 
 41 | /** @internal */
 42 | export interface Loop extends
 43 |   Op<"Loop", {
 44 |     readonly initialState: unknown | Effect.Effect<unknown, never, Prompt.Prompt.Environment>
 45 |     readonly render: Prompt.Prompt.Handlers<unknown, unknown>["render"]
 46 |     readonly process: Prompt.Prompt.Handlers<unknown, unknown>["process"]
 47 |     readonly clear: Prompt.Prompt.Handlers<unknown, unknown>["clear"]
 48 |   }>
 49 | {}
 50 | 
 51 | /** @internal */
 52 | export interface OnSuccess extends
 53 |   Op<"OnSuccess", {
 54 |     readonly prompt: Primitive
 55 |     readonly onSuccess: (value: unknown) => Prompt.Prompt<unknown>
 56 |   }>
 57 | {}
 58 | 
 59 | /** @internal */
 60 | export interface Succeed extends
 61 |   Op<"Succeed", {
 62 |     readonly value: unknown
 63 |   }>
 64 | {}
 65 | 
 66 | /** @internal */
 67 | export const isPrompt = (u: unknown): u is Prompt.Prompt<unknown> =>
 68 |   typeof u === "object" && u != null && PromptTypeId in u
 69 | 
 70 | const allTupled = <const T extends ArrayLike<Prompt.Prompt<any>>>(arg: T): Prompt.Prompt<
 71 |   {
 72 |     [K in keyof T]: [T[K]] extends [Prompt.Prompt<infer A>] ? A : never
 73 |   }
 74 | > => {
 75 |   if (arg.length === 0) {
 76 |     return succeed([]) as any
 77 |   }
 78 |   if (arg.length === 1) {
 79 |     return map(arg[0], (x) => [x]) as any
 80 |   }
 81 |   let result = map(arg[0], (x) => [x])
 82 |   for (let i = 1; i < arg.length; i++) {
 83 |     const curr = arg[i]
 84 |     result = flatMap(result, (tuple) => map(curr, (a) => [...tuple, a]))
 85 |   }
 86 |   return result as any
 87 | }
 88 | 
 89 | /** @internal */
 90 | export const all: <
 91 |   const Arg extends Iterable<Prompt.Prompt<any>> | Record<string, Prompt.Prompt<any>>
 92 | >(arg: Arg) => Prompt.All.Return<Arg> = function() {
 93 |   if (arguments.length === 1) {
 94 |     if (isPrompt(arguments[0])) {
 95 |       return map(arguments[0], (x) => [x]) as any
 96 |     } else if (Array.isArray(arguments[0])) {
 97 |       return allTupled(arguments[0]) as any
 98 |     } else {
 99 |       const entries = Object.entries(arguments[0] as Readonly<{ [K: string]: Prompt.Prompt<any> }>)
100 |       let result = map(entries[0][1], (value) => ({ [entries[0][0]]: value }))
101 |       if (entries.length === 1) {
102 |         return result as any
103 |       }
104 |       const rest = entries.slice(1)
105 |       for (const [key, prompt] of rest) {
106 |         result = result.pipe(
107 |           flatMap((record) =>
108 |             prompt.pipe(map((value) => ({
109 |               ...record,
110 |               [key]: value
111 |             })))
112 |           )
113 |         )
114 |       }
115 |       return result as any
116 |     }
117 |   }
118 |   return allTupled(arguments[0]) as any
119 | }
120 | 
121 | /** @internal */
122 | export const custom = <State, Output>(
123 |   initialState: State | Effect.Effect<State, never, Prompt.Prompt.Environment>,
124 |   handlers: Prompt.Prompt.Handlers<State, Output>
125 | ): Prompt.Prompt<Output> => {
126 |   const op = Object.create(proto)
127 |   op._tag = "Loop"
128 |   op.initialState = initialState
129 |   op.render = handlers.render
130 |   op.process = handlers.process
131 |   op.clear = handlers.clear
132 |   return op
133 | }
134 | 
135 | /** @internal */
136 | export const map = dual<
137 |   <Output, Output2>(
138 |     f: (output: Output) => Output2
139 |   ) => (
140 |     self: Prompt.Prompt<Output>
141 |   ) => Prompt.Prompt<Output2>,
142 |   <Output, Output2>(
143 |     self: Prompt.Prompt<Output>,
144 |     f: (output: Output) => Output2
145 |   ) => Prompt.Prompt<Output2>
146 | >(2, (self, f) => flatMap(self, (a) => succeed(f(a))))
147 | 
148 | /** @internal */
149 | export const flatMap = dual<
150 |   <Output, Output2>(
151 |     f: (output: Output) => Prompt.Prompt<Output2>
152 |   ) => (
153 |     self: Prompt.Prompt<Output>
154 |   ) => Prompt.Prompt<Output2>,
155 |   <Output, Output2>(
156 |     self: Prompt.Prompt<Output>,
157 |     f: (output: Output) => Prompt.Prompt<Output2>
158 |   ) => Prompt.Prompt<Output2>
159 | >(2, (self, f) => {
160 |   const op = Object.create(proto)
161 |   op._tag = "OnSuccess"
162 |   op.prompt = self
163 |   op.onSuccess = f
164 |   return op
165 | })
166 | 
167 | /** @internal */
168 | export const run = <Output>(
169 |   self: Prompt.Prompt<Output>
170 | ): Effect.Effect<Output, Terminal.QuitException, Prompt.Prompt.Environment> =>
171 |   Effect.flatMap(Terminal.Terminal, (terminal) => {
172 |     const op = self as Primitive
173 |     switch (op._tag) {
174 |       case "Loop": {
175 |         const makeStateRef = Effect.isEffect(op.initialState)
176 |           ? op.initialState.pipe(Effect.flatMap(Ref.make))
177 |           : Ref.make(op.initialState)
178 |         return makeStateRef.pipe(
179 |           Effect.flatMap((ref) => {
180 |             const loop = (
181 |               action: Exclude<Prompt.Prompt.Action<unknown, unknown>, { _tag: "Submit" }>
182 |             ): Effect.Effect<any, Terminal.QuitException, Prompt.Prompt.Environment> =>
183 |               Ref.get(ref).pipe(
184 |                 Effect.flatMap((state) =>
185 |                   op.render(state, action).pipe(
186 |                     Effect.flatMap((msg) => Effect.orDie(terminal.display(msg))),
187 |                     Effect.zipRight(terminal.readInput),
188 |                     Effect.flatMap((input) => op.process(input, state)),
189 |                     Effect.flatMap((action) => {
190 |                       switch (action._tag) {
191 |                         case "Beep": {
192 |                           return loop(action)
193 |                         }
194 |                         case "NextFrame": {
195 |                           return op.clear(state, action).pipe(
196 |                             Effect.flatMap((clear) => Effect.orDie(terminal.display(clear))),
197 |                             Effect.zipRight(Ref.set(ref, action.state)),
198 |                             Effect.zipRight(loop(action))
199 |                           )
200 |                         }
201 |                         case "Submit": {
202 |                           return op.clear(state, action).pipe(
203 |                             Effect.flatMap((clear) => Effect.orDie(terminal.display(clear))),
204 |                             Effect.zipRight(op.render(state, action)),
205 |                             Effect.flatMap((msg) => Effect.orDie(terminal.display(msg))),
206 |                             Effect.zipRight(Effect.succeed(action.value))
207 |                           )
208 |                         }
209 |                       }
210 |                     })
211 |                   )
212 |                 )
213 |               )
214 |             return Ref.get(ref).pipe(
215 |               Effect.flatMap((state) => loop(Action.NextFrame({ state })))
216 |             )
217 |           }),
218 |           // Always make sure to restore the display of the cursor
219 |           Effect.ensuring(Effect.orDie(
220 |             terminal.display(Doc.render(Doc.cursorShow, { style: "pretty" }))
221 |           ))
222 |         )
223 |       }
224 |       case "OnSuccess": {
225 |         return Effect.flatMap(run(op.prompt), (a) => run(op.onSuccess(a))) as any
226 |       }
227 |       case "Succeed": {
228 |         return Effect.succeed(op.value)
229 |       }
230 |     }
231 |   })
232 | 
233 | /** @internal */
234 | export const succeed = <A>(value: A): Prompt.Prompt<A> => {
235 |   const op = Object.create(proto)
236 |   op._tag = "Succeed"
237 |   op.value = value
238 |   return op
239 | }
240 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/prompt/action.ts:
--------------------------------------------------------------------------------
1 | import * as Data from "effect/Data"
2 | import type { Prompt } from "../../Prompt.js"
3 | 
4 | /** @internal */
5 | export const Action = Data.taggedEnum<Prompt.ActionDefinition>()
6 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/prompt/ansi-utils.ts:
--------------------------------------------------------------------------------
/packages/cli/src/internal/prompt/confirm.ts:
--------------------------------------------------------------------------------
  1 | import * as Terminal from "@effect/platform/Terminal"
  2 | import * as Ansi from "@effect/printer-ansi/Ansi"
  3 | import * as Doc from "@effect/printer-ansi/AnsiDoc"
  4 | import * as Optimize from "@effect/printer/Optimize"
  5 | import * as Arr from "effect/Array"
  6 | import * as Effect from "effect/Effect"
  7 | import * as Option from "effect/Option"
  8 | import type * as Prompt from "../../Prompt.js"
  9 | import * as InternalPrompt from "../prompt.js"
 10 | import { Action } from "./action.js"
 11 | import * as InternalAnsiUtils from "./ansi-utils.js"
 12 | 
 13 | interface Options extends Required<Prompt.Prompt.ConfirmOptions> {}
 14 | 
 15 | interface State {
 16 |   readonly value: boolean
 17 | }
 18 | 
 19 | const renderBeep = Doc.render(Doc.beep, { style: "pretty" })
 20 | 
 21 | function handleClear(options: Options) {
 22 |   return Effect.gen(function*() {
 23 |     const terminal = yield* Terminal.Terminal
 24 |     const columns = yield* terminal.columns
 25 |     const clearOutput = InternalAnsiUtils.eraseText(options.message, columns)
 26 |     const resetCurrentLine = Doc.cat(Doc.eraseLine, Doc.cursorLeft)
 27 |     return clearOutput.pipe(
 28 |       Doc.cat(resetCurrentLine),
 29 |       Optimize.optimize(Optimize.Deep),
 30 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
 31 |     )
 32 |   })
 33 | }
 34 | 
 35 | const NEWLINE_REGEX = /\r?\n/
 36 | 
 37 | function renderOutput(
 38 |   confirm: Doc.AnsiDoc,
 39 |   leadingSymbol: Doc.AnsiDoc,
 40 |   trailingSymbol: Doc.AnsiDoc,
 41 |   options: Options
 42 | ) {
 43 |   const annotateLine = (line: string): Doc.AnsiDoc => Doc.annotate(Doc.text(line), Ansi.bold)
 44 |   const prefix = Doc.cat(leadingSymbol, Doc.space)
 45 |   return Arr.match(options.message.split(NEWLINE_REGEX), {
 46 |     onEmpty: () => Doc.hsep([prefix, trailingSymbol, confirm]),
 47 |     onNonEmpty: (promptLines) => {
 48 |       const lines = Arr.map(promptLines, (line) => annotateLine(line))
 49 |       return prefix.pipe(
 50 |         Doc.cat(Doc.nest(Doc.vsep(lines), 2)),
 51 |         Doc.cat(Doc.space),
 52 |         Doc.cat(trailingSymbol),
 53 |         Doc.cat(Doc.space),
 54 |         Doc.cat(confirm)
 55 |       )
 56 |     }
 57 |   })
 58 | }
 59 | 
 60 | function renderNextFrame(state: State, options: Options) {
 61 |   return Effect.gen(function*() {
 62 |     const terminal = yield* Terminal.Terminal
 63 |     const columns = yield* terminal.columns
 64 |     const figures = yield* InternalAnsiUtils.figures
 65 |     const leadingSymbol = Doc.annotate(Doc.text("?"), Ansi.cyanBright)
 66 |     const trailingSymbol = Doc.annotate(figures.pointerSmall, Ansi.blackBright)
 67 |     // Marking these explicitly as present with `!` because they always will be
 68 |     // and there is really no value in adding a `DeepRequired` type helper just
 69 |     // for these internal cases
 70 |     const confirmMessage = state.value
 71 |       ? options.placeholder.defaultConfirm!
 72 |       : options.placeholder.defaultDeny!
 73 |     const confirm = Doc.annotate(Doc.text(confirmMessage), Ansi.blackBright)
 74 |     const promptMsg = renderOutput(confirm, leadingSymbol, trailingSymbol, options)
 75 |     return Doc.cursorHide.pipe(
 76 |       Doc.cat(promptMsg),
 77 |       Optimize.optimize(Optimize.Deep),
 78 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
 79 |     )
 80 |   })
 81 | }
 82 | 
 83 | function renderSubmission(value: boolean, options: Options) {
 84 |   return Effect.gen(function*() {
 85 |     const terminal = yield* Terminal.Terminal
 86 |     const columns = yield* terminal.columns
 87 |     const figures = yield* InternalAnsiUtils.figures
 88 |     const leadingSymbol = Doc.annotate(figures.tick, Ansi.green)
 89 |     const trailingSymbol = Doc.annotate(figures.ellipsis, Ansi.blackBright)
 90 |     const confirmMessage = value ? options.label.confirm : options.label.deny
 91 |     const confirm = Doc.text(confirmMessage)
 92 |     const promptMsg = renderOutput(confirm, leadingSymbol, trailingSymbol, options)
 93 |     return promptMsg.pipe(
 94 |       Doc.cat(Doc.hardLine),
 95 |       Optimize.optimize(Optimize.Deep),
 96 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
 97 |     )
 98 |   })
 99 | }
100 | 
101 | function handleRender(options: Options) {
102 |   return (_: State, action: Prompt.Prompt.Action<State, boolean>) => {
103 |     return Action.$match(action, {
104 |       Beep: () => Effect.succeed(renderBeep),
105 |       NextFrame: ({ state }) => renderNextFrame(state, options),
106 |       Submit: ({ value }) => renderSubmission(value, options)
107 |     })
108 |   }
109 | }
110 | 
111 | const TRUE_VALUE_REGEX = /^y|t$/
112 | const FALSE_VALUE_REGEX = /^n|f$/
113 | 
114 | function handleProcess(input: Terminal.UserInput) {
115 |   const value = Option.getOrElse(input.input, () => "")
116 |   if (TRUE_VALUE_REGEX.test(value.toLowerCase())) {
117 |     return Effect.succeed(Action.Submit({ value: true }))
118 |   }
119 |   if (FALSE_VALUE_REGEX.test(value.toLowerCase())) {
120 |     return Effect.succeed(Action.Submit({ value: false }))
121 |   }
122 |   return Effect.succeed(Action.Beep())
123 | }
124 | 
125 | /** @internal */
126 | export const confirm = (options: Prompt.Prompt.ConfirmOptions): Prompt.Prompt<boolean> => {
127 |   const opts: Required<Prompt.Prompt.ConfirmOptions> = {
128 |     initial: false,
129 |     ...options,
130 |     label: {
131 |       confirm: "yes",
132 |       deny: "no",
133 |       ...options.label
134 |     },
135 |     placeholder: {
136 |       defaultConfirm: "(Y/n)",
137 |       defaultDeny: "(y/N)",
138 |       ...options.placeholder
139 |     }
140 |   }
141 |   const initialState: State = { value: opts.initial }
142 |   return InternalPrompt.custom(initialState, {
143 |     render: handleRender(opts),
144 |     process: (input) => handleProcess(input),
145 |     clear: () => handleClear(opts)
146 |   })
147 | }
148 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/prompt/list.ts:
--------------------------------------------------------------------------------
 1 | import type * as Prompt from "../../Prompt.js"
 2 | import * as InternalPrompt from "../prompt.js"
 3 | import * as InternalTextPrompt from "./text.js"
 4 | 
 5 | /** @internal */
 6 | export const list = (options: Prompt.Prompt.ListOptions): Prompt.Prompt<Array<string>> =>
 7 |   InternalTextPrompt.text(options).pipe(
 8 |     InternalPrompt.map((output) => output.split(options.delimiter || ","))
 9 |   )
10 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/prompt/multi-select.ts:
--------------------------------------------------------------------------------
  1 | import * as Terminal from "@effect/platform/Terminal"
  2 | import { Optimize } from "@effect/printer"
  3 | import * as Ansi from "@effect/printer-ansi/Ansi"
  4 | import * as Doc from "@effect/printer-ansi/AnsiDoc"
  5 | import * as Arr from "effect/Array"
  6 | import * as Effect from "effect/Effect"
  7 | import * as Number from "effect/Number"
  8 | import * as Option from "effect/Option"
  9 | import type * as Prompt from "../../Prompt.js"
 10 | import * as InternalPrompt from "../prompt.js"
 11 | import { Action } from "./action.js"
 12 | import * as InternalAnsiUtils from "./ansi-utils.js"
 13 | import { entriesToDisplay } from "./utils.js"
 14 | 
 15 | interface SelectOptions<A> extends Required<Prompt.Prompt.SelectOptions<A>> {}
 16 | interface MultiSelectOptions extends Prompt.Prompt.MultiSelectOptions {}
 17 | 
 18 | type State = {
 19 |   index: number
 20 |   selectedIndices: Set<number>
 21 |   error: Option.Option<string>
 22 | }
 23 | 
 24 | const renderBeep = Doc.render(Doc.beep, { style: "pretty" })
 25 | 
 26 | const NEWLINE_REGEX = /\r?\n/
 27 | 
 28 | function renderOutput<A>(
 29 |   leadingSymbol: Doc.AnsiDoc,
 30 |   trailingSymbol: Doc.AnsiDoc,
 31 |   options: SelectOptions<A>
 32 | ) {
 33 |   const annotateLine = (line: string): Doc.AnsiDoc => Doc.annotate(Doc.text(line), Ansi.bold)
 34 |   const prefix = Doc.cat(leadingSymbol, Doc.space)
 35 |   return Arr.match(options.message.split(NEWLINE_REGEX), {
 36 |     onEmpty: () => Doc.hsep([prefix, trailingSymbol]),
 37 |     onNonEmpty: (promptLines) => {
 38 |       const lines = Arr.map(promptLines, (line) => annotateLine(line))
 39 |       return prefix.pipe(
 40 |         Doc.cat(Doc.nest(Doc.vsep(lines), 2)),
 41 |         Doc.cat(Doc.space),
 42 |         Doc.cat(trailingSymbol),
 43 |         Doc.cat(Doc.space)
 44 |       )
 45 |     }
 46 |   })
 47 | }
 48 | 
 49 | function renderError(state: State, pointer: Doc.AnsiDoc) {
 50 |   return Option.match(state.error, {
 51 |     onNone: () => Doc.empty,
 52 |     onSome: (error) =>
 53 |       Arr.match(error.split(NEWLINE_REGEX), {
 54 |         onEmpty: () => Doc.empty,
 55 |         onNonEmpty: (errorLines) => {
 56 |           const annotateLine = (line: string): Doc.AnsiDoc =>
 57 |             Doc.annotate(Doc.text(line), Ansi.combine(Ansi.italicized, Ansi.red))
 58 |           const prefix = Doc.cat(Doc.annotate(pointer, Ansi.red), Doc.space)
 59 |           const lines = Arr.map(errorLines, (str) => annotateLine(str))
 60 |           return Doc.cursorSavePosition.pipe(
 61 |             Doc.cat(Doc.hardLine),
 62 |             Doc.cat(prefix),
 63 |             Doc.cat(Doc.align(Doc.vsep(lines))),
 64 |             Doc.cat(Doc.cursorRestorePosition)
 65 |           )
 66 |         }
 67 |       })
 68 |   })
 69 | }
 70 | 
 71 | function renderChoiceDescription<A>(
 72 |   choice: Prompt.Prompt.SelectChoice<A>,
 73 |   isHighlighted: boolean
 74 | ) {
 75 |   if (!choice.disabled && choice.description && isHighlighted) {
 76 |     return Doc.char("-").pipe(
 77 |       Doc.cat(Doc.space),
 78 |       Doc.cat(Doc.text(choice.description)),
 79 |       Doc.annotate(Ansi.blackBright)
 80 |     )
 81 |   }
 82 |   return Doc.empty
 83 | }
 84 | 
 85 | const metaOptionsCount = 2
 86 | 
 87 | function renderChoices<A>(
 88 |   state: State,
 89 |   options: SelectOptions<A> & MultiSelectOptions,
 90 |   figures: Effect.Effect.Success<typeof InternalAnsiUtils.figures>
 91 | ) {
 92 |   const choices = options.choices
 93 |   const totalChoices = choices.length
 94 |   const selectedCount = state.selectedIndices.size
 95 |   const allSelected = selectedCount === totalChoices
 96 | 
 97 |   const selectAllText = allSelected
 98 |     ? options?.selectNone ?? "Select None"
 99 |     : options?.selectAll ?? "Select All"
100 | 
101 |   const inverseSelectionText = options?.inverseSelection ?? "Inverse Selection"
102 | 
103 |   const metaOptions = [
104 |     { title: selectAllText },
105 |     { title: inverseSelectionText }
106 |   ]
107 |   const allChoices = [...metaOptions, ...choices]
108 |   const toDisplay = entriesToDisplay(state.index, allChoices.length, options.maxPerPage)
109 |   const documents: Array<Doc.AnsiDoc> = []
110 |   for (let index = toDisplay.startIndex; index < toDisplay.endIndex; index++) {
111 |     const choice = allChoices[index]
112 |     const isHighlighted = state.index === index
113 |     let prefix: Doc.AnsiDoc = Doc.space
114 |     if (index === toDisplay.startIndex && toDisplay.startIndex > 0) {
115 |       prefix = figures.arrowUp
116 |     } else if (index === toDisplay.endIndex - 1 && toDisplay.endIndex < allChoices.length) {
117 |       prefix = figures.arrowDown
118 |     }
119 |     if (index < metaOptions.length) {
120 |       // Meta options
121 |       const title = isHighlighted
122 |         ? Doc.annotate(Doc.text(choice.title), Ansi.cyanBright)
123 |         : Doc.text(choice.title)
124 |       documents.push(
125 |         prefix.pipe(
126 |           Doc.cat(Doc.space),
127 |           Doc.cat(title)
128 |         )
129 |       )
130 |     } else {
131 |       // Regular choices
132 |       const choiceIndex = index - metaOptions.length
133 |       const isSelected = state.selectedIndices.has(choiceIndex)
134 |       const checkbox = isSelected ? figures.checkboxOn : figures.checkboxOff
135 |       const annotatedCheckbox = isHighlighted
136 |         ? Doc.annotate(checkbox, Ansi.cyanBright)
137 |         : checkbox
138 |       const title = Doc.text(choice.title)
139 |       const description = renderChoiceDescription(choice as Prompt.Prompt.SelectChoice<A>, isHighlighted)
140 |       documents.push(
141 |         prefix.pipe(
142 |           Doc.cat(Doc.space),
143 |           Doc.cat(annotatedCheckbox),
144 |           Doc.cat(Doc.space),
145 |           Doc.cat(title),
146 |           Doc.cat(Doc.space),
147 |           Doc.cat(description)
148 |         )
149 |       )
150 |     }
151 |   }
152 |   return Doc.vsep(documents)
153 | }
154 | 
155 | function renderNextFrame<A>(state: State, options: SelectOptions<A>) {
156 |   return Effect.gen(function*() {
157 |     const terminal = yield* Terminal.Terminal
158 |     const columns = yield* terminal.columns
159 |     const figures = yield* InternalAnsiUtils.figures
160 |     const choices = renderChoices(state, options, figures)
161 |     const leadingSymbol = Doc.annotate(Doc.text("?"), Ansi.cyanBright)
162 |     const trailingSymbol = Doc.annotate(figures.pointerSmall, Ansi.blackBright)
163 |     const promptMsg = renderOutput(leadingSymbol, trailingSymbol, options)
164 |     const error = renderError(state, figures.pointer)
165 |     return Doc.cursorHide.pipe(
166 |       Doc.cat(promptMsg),
167 |       Doc.cat(Doc.hardLine),
168 |       Doc.cat(choices),
169 |       Doc.cat(error),
170 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
171 |     )
172 |   })
173 | }
174 | 
175 | function renderSubmission<A>(state: State, options: SelectOptions<A>) {
176 |   return Effect.gen(function*() {
177 |     const terminal = yield* Terminal.Terminal
178 |     const columns = yield* terminal.columns
179 |     const figures = yield* InternalAnsiUtils.figures
180 |     const selectedChoices = Array.from(state.selectedIndices).sort(Number.Order).map((index) =>
181 |       options.choices[index].title
182 |     )
183 |     const selectedText = selectedChoices.join(", ")
184 |     const selected = Doc.text(selectedText)
185 |     const leadingSymbol = Doc.annotate(figures.tick, Ansi.green)
186 |     const trailingSymbol = Doc.annotate(figures.ellipsis, Ansi.blackBright)
187 |     const promptMsg = renderOutput(leadingSymbol, trailingSymbol, options)
188 |     return promptMsg.pipe(
189 |       Doc.cat(Doc.space),
190 |       Doc.cat(Doc.annotate(selected, Ansi.white)),
191 |       Doc.cat(Doc.hardLine),
192 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
193 |     )
194 |   })
195 | }
196 | 
197 | function processCursorUp(state: State, totalChoices: number) {
198 |   const newIndex = state.index === 0 ? totalChoices - 1 : state.index - 1
199 |   return Effect.succeed(Action.NextFrame({ state: { ...state, index: newIndex } }))
200 | }
201 | 
202 | function processCursorDown(state: State, totalChoices: number) {
203 |   const newIndex = (state.index + 1) % totalChoices
204 |   return Effect.succeed(Action.NextFrame({ state: { ...state, index: newIndex } }))
205 | }
206 | 
207 | function processSpace<A>(
208 |   state: State,
209 |   options: SelectOptions<A>
210 | ) {
211 |   const selectedIndices = new Set(state.selectedIndices)
212 |   if (state.index === 0) {
213 |     if (state.selectedIndices.size === options.choices.length) {
214 |       selectedIndices.clear()
215 |     } else {
216 |       for (let i = 0; i < options.choices.length; i++) {
217 |         selectedIndices.add(i)
218 |       }
219 |     }
220 |   } else if (state.index === 1) {
221 |     for (let i = 0; i < options.choices.length; i++) {
222 |       if (state.selectedIndices.has(i)) {
223 |         selectedIndices.delete(i)
224 |       } else {
225 |         selectedIndices.add(i)
226 |       }
227 |     }
228 |   } else {
229 |     const choiceIndex = state.index - metaOptionsCount
230 |     if (selectedIndices.has(choiceIndex)) {
231 |       selectedIndices.delete(choiceIndex)
232 |     } else {
233 |       selectedIndices.add(choiceIndex)
234 |     }
235 |   }
236 |   return Effect.succeed(Action.NextFrame({ state: { ...state, selectedIndices } }))
237 | }
238 | 
239 | export function handleClear<A>(options: SelectOptions<A>) {
240 |   return Effect.gen(function*() {
241 |     const terminal = yield* Terminal.Terminal
242 |     const columns = yield* terminal.columns
243 |     const clearPrompt = Doc.cat(Doc.eraseLine, Doc.cursorLeft)
244 |     const text = "\n".repeat(Math.min(options.choices.length + 2, options.maxPerPage)) + options.message + 1
245 |     const clearOutput = InternalAnsiUtils.eraseText(text, columns)
246 |     return clearOutput.pipe(
247 |       Doc.cat(clearPrompt),
248 |       Optimize.optimize(Optimize.Deep),
249 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
250 |     )
251 |   })
252 | }
253 | 
254 | function handleProcess<A>(options: SelectOptions<A> & MultiSelectOptions) {
255 |   return (input: Terminal.UserInput, state: State) => {
256 |     const totalChoices = options.choices.length + metaOptionsCount
257 |     switch (input.key.name) {
258 |       case "k":
259 |       case "up": {
260 |         return processCursorUp({ ...state, error: Option.none() }, totalChoices)
261 |       }
262 |       case "j":
263 |       case "down":
264 |       case "tab": {
265 |         return processCursorDown({ ...state, error: Option.none() }, totalChoices)
266 |       }
267 |       case "space": {
268 |         return processSpace(state, options)
269 |       }
270 |       case "enter":
271 |       case "return": {
272 |         const selectedCount = state.selectedIndices.size
273 |         if (options.min !== undefined && selectedCount < options.min) {
274 |           return Effect.succeed(
275 |             Action.NextFrame({ state: { ...state, error: Option.some(`At least ${options.min} are required`) } })
276 |           )
277 |         }
278 |         if (options.max !== undefined && selectedCount > options.max) {
279 |           return Effect.succeed(
280 |             Action.NextFrame({ state: { ...state, error: Option.some(`At most ${options.max} choices are allowed`) } })
281 |           )
282 |         }
283 |         const selectedValues = Array.from(state.selectedIndices).sort(Number.Order).map((index) =>
284 |           options.choices[index].value
285 |         )
286 |         return Effect.succeed(Action.Submit({ value: selectedValues }))
287 |       }
288 |       default: {
289 |         return Effect.succeed(Action.Beep())
290 |       }
291 |     }
292 |   }
293 | }
294 | 
295 | function handleRender<A>(options: SelectOptions<A>) {
296 |   return (state: State, action: Prompt.Prompt.Action<State, Array<A>>) => {
297 |     return Action.$match(action, {
298 |       Beep: () => Effect.succeed(renderBeep),
299 |       NextFrame: ({ state }) => renderNextFrame(state, options),
300 |       Submit: () => renderSubmission(state, options)
301 |     })
302 |   }
303 | }
304 | 
305 | /** @internal */
306 | export const multiSelect = <A>(
307 |   options: Prompt.Prompt.SelectOptions<A> & Prompt.Prompt.MultiSelectOptions
308 | ): Prompt.Prompt<Array<A>> => {
309 |   const opts: SelectOptions<A> & MultiSelectOptions = {
310 |     maxPerPage: 10,
311 |     ...options
312 |   }
313 |   return InternalPrompt.custom({ index: 0, selectedIndices: new Set<number>(), error: Option.none() }, {
314 |     render: handleRender(opts),
315 |     process: handleProcess(opts),
316 |     clear: () => handleClear(opts)
317 |   })
318 | }
319 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/prompt/select.ts:
--------------------------------------------------------------------------------
  1 | import * as Terminal from "@effect/platform/Terminal"
  2 | import { Optimize } from "@effect/printer"
  3 | import * as Ansi from "@effect/printer-ansi/Ansi"
  4 | import * as Doc from "@effect/printer-ansi/AnsiDoc"
  5 | import * as Arr from "effect/Array"
  6 | import * as Effect from "effect/Effect"
  7 | import type * as Prompt from "../../Prompt.js"
  8 | import * as InternalPrompt from "../prompt.js"
  9 | import { Action } from "./action.js"
 10 | import * as InternalAnsiUtils from "./ansi-utils.js"
 11 | import { entriesToDisplay } from "./utils.js"
 12 | 
 13 | type State = number
 14 | 
 15 | interface SelectOptions<A> extends Required<Prompt.Prompt.SelectOptions<A>> {}
 16 | 
 17 | const renderBeep = Doc.render(Doc.beep, { style: "pretty" })
 18 | 
 19 | const NEWLINE_REGEX = /\r?\n/
 20 | 
 21 | function renderOutput<A>(
 22 |   leadingSymbol: Doc.AnsiDoc,
 23 |   trailingSymbol: Doc.AnsiDoc,
 24 |   options: SelectOptions<A>
 25 | ) {
 26 |   const annotateLine = (line: string): Doc.AnsiDoc => Doc.annotate(Doc.text(line), Ansi.bold)
 27 |   const prefix = Doc.cat(leadingSymbol, Doc.space)
 28 |   return Arr.match(options.message.split(NEWLINE_REGEX), {
 29 |     onEmpty: () => Doc.hsep([prefix, trailingSymbol]),
 30 |     onNonEmpty: (promptLines) => {
 31 |       const lines = Arr.map(promptLines, (line) => annotateLine(line))
 32 |       return prefix.pipe(
 33 |         Doc.cat(Doc.nest(Doc.vsep(lines), 2)),
 34 |         Doc.cat(Doc.space),
 35 |         Doc.cat(trailingSymbol),
 36 |         Doc.cat(Doc.space)
 37 |       )
 38 |     }
 39 |   })
 40 | }
 41 | 
 42 | function renderChoicePrefix<A>(
 43 |   state: State,
 44 |   choices: SelectOptions<A>["choices"],
 45 |   toDisplay: { readonly startIndex: number; readonly endIndex: number },
 46 |   currentIndex: number,
 47 |   figures: Effect.Effect.Success<typeof InternalAnsiUtils.figures>
 48 | ) {
 49 |   let prefix: Doc.AnsiDoc = Doc.space
 50 |   if (currentIndex === toDisplay.startIndex && toDisplay.startIndex > 0) {
 51 |     prefix = figures.arrowUp
 52 |   } else if (currentIndex === toDisplay.endIndex - 1 && toDisplay.endIndex < choices.length) {
 53 |     prefix = figures.arrowDown
 54 |   }
 55 |   if (choices[currentIndex].disabled) {
 56 |     const annotation = Ansi.combine(Ansi.bold, Ansi.blackBright)
 57 |     return state === currentIndex
 58 |       ? figures.pointer.pipe(Doc.annotate(annotation), Doc.cat(prefix))
 59 |       : prefix.pipe(Doc.cat(Doc.space))
 60 |   }
 61 |   return state === currentIndex
 62 |     ? figures.pointer.pipe(Doc.annotate(Ansi.cyanBright), Doc.cat(prefix))
 63 |     : prefix.pipe(Doc.cat(Doc.space))
 64 | }
 65 | 
 66 | function renderChoiceTitle<A>(
 67 |   choice: Prompt.Prompt.SelectChoice<A>,
 68 |   isSelected: boolean
 69 | ) {
 70 |   const title = Doc.text(choice.title)
 71 |   if (isSelected) {
 72 |     return choice.disabled
 73 |       ? Doc.annotate(title, Ansi.combine(Ansi.underlined, Ansi.blackBright))
 74 |       : Doc.annotate(title, Ansi.combine(Ansi.underlined, Ansi.cyanBright))
 75 |   }
 76 |   return choice.disabled
 77 |     ? Doc.annotate(title, Ansi.combine(Ansi.strikethrough, Ansi.blackBright))
 78 |     : title
 79 | }
 80 | 
 81 | function renderChoiceDescription<A>(
 82 |   choice: Prompt.Prompt.SelectChoice<A>,
 83 |   isSelected: boolean
 84 | ) {
 85 |   if (!choice.disabled && choice.description && isSelected) {
 86 |     return Doc.char("-").pipe(
 87 |       Doc.cat(Doc.space),
 88 |       Doc.cat(Doc.text(choice.description)),
 89 |       Doc.annotate(Ansi.blackBright)
 90 |     )
 91 |   }
 92 |   return Doc.empty
 93 | }
 94 | 
 95 | function renderChoices<A>(
 96 |   state: State,
 97 |   options: SelectOptions<A>,
 98 |   figures: Effect.Effect.Success<typeof InternalAnsiUtils.figures>
 99 | ) {
100 |   const choices = options.choices
101 |   const toDisplay = entriesToDisplay(state, choices.length, options.maxPerPage)
102 |   const documents: Array<Doc.AnsiDoc> = []
103 |   for (let index = toDisplay.startIndex; index < toDisplay.endIndex; index++) {
104 |     const choice = choices[index]
105 |     const isSelected = state === index
106 |     const prefix = renderChoicePrefix(state, choices, toDisplay, index, figures)
107 |     const title = renderChoiceTitle(choice, isSelected)
108 |     const description = renderChoiceDescription(choice, isSelected)
109 |     documents.push(prefix.pipe(Doc.cat(title), Doc.cat(Doc.space), Doc.cat(description)))
110 |   }
111 |   return Doc.vsep(documents)
112 | }
113 | 
114 | function renderNextFrame<A>(state: State, options: SelectOptions<A>) {
115 |   return Effect.gen(function*() {
116 |     const terminal = yield* Terminal.Terminal
117 |     const columns = yield* terminal.columns
118 |     const figures = yield* InternalAnsiUtils.figures
119 |     const choices = renderChoices(state, options, figures)
120 |     const leadingSymbol = Doc.annotate(Doc.text("?"), Ansi.cyanBright)
121 |     const trailingSymbol = Doc.annotate(figures.pointerSmall, Ansi.blackBright)
122 |     const promptMsg = renderOutput(leadingSymbol, trailingSymbol, options)
123 |     return Doc.cursorHide.pipe(
124 |       Doc.cat(promptMsg),
125 |       Doc.cat(Doc.hardLine),
126 |       Doc.cat(choices),
127 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
128 |     )
129 |   })
130 | }
131 | 
132 | function renderSubmission<A>(state: State, options: SelectOptions<A>) {
133 |   return Effect.gen(function*() {
134 |     const terminal = yield* Terminal.Terminal
135 |     const columns = yield* terminal.columns
136 |     const figures = yield* InternalAnsiUtils.figures
137 |     const selected = Doc.text(options.choices[state].title)
138 |     const leadingSymbol = Doc.annotate(figures.tick, Ansi.green)
139 |     const trailingSymbol = Doc.annotate(figures.ellipsis, Ansi.blackBright)
140 |     const promptMsg = renderOutput(leadingSymbol, trailingSymbol, options)
141 |     return promptMsg.pipe(
142 |       Doc.cat(Doc.space),
143 |       Doc.cat(Doc.annotate(selected, Ansi.white)),
144 |       Doc.cat(Doc.hardLine),
145 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
146 |     )
147 |   })
148 | }
149 | 
150 | function processCursorUp<A>(state: State, choices: Prompt.Prompt.SelectOptions<A>["choices"]) {
151 |   if (state === 0) {
152 |     return Effect.succeed(Action.NextFrame({ state: choices.length - 1 }))
153 |   }
154 |   return Effect.succeed(Action.NextFrame({ state: state - 1 }))
155 | }
156 | 
157 | function processCursorDown<A>(state: State, choices: Prompt.Prompt.SelectOptions<A>["choices"]) {
158 |   if (state === choices.length - 1) {
159 |     return Effect.succeed(Action.NextFrame({ state: 0 }))
160 |   }
161 |   return Effect.succeed(Action.NextFrame({ state: state + 1 }))
162 | }
163 | 
164 | function processNext<A>(state: State, choices: Prompt.Prompt.SelectOptions<A>["choices"]) {
165 |   return Effect.succeed(Action.NextFrame({ state: (state + 1) % choices.length }))
166 | }
167 | 
168 | function handleRender<A>(options: SelectOptions<A>) {
169 |   return (state: State, action: Prompt.Prompt.Action<State, A>) => {
170 |     return Action.$match(action, {
171 |       Beep: () => Effect.succeed(renderBeep),
172 |       NextFrame: ({ state }) => renderNextFrame(state, options),
173 |       Submit: () => renderSubmission(state, options)
174 |     })
175 |   }
176 | }
177 | 
178 | export function handleClear<A>(options: SelectOptions<A>) {
179 |   return Effect.gen(function*() {
180 |     const terminal = yield* Terminal.Terminal
181 |     const columns = yield* terminal.columns
182 |     const clearPrompt = Doc.cat(Doc.eraseLine, Doc.cursorLeft)
183 |     const text = "\n".repeat(Math.min(options.choices.length, options.maxPerPage)) + options.message
184 |     const clearOutput = InternalAnsiUtils.eraseText(text, columns)
185 |     return clearOutput.pipe(
186 |       Doc.cat(clearPrompt),
187 |       Optimize.optimize(Optimize.Deep),
188 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
189 |     )
190 |   })
191 | }
192 | 
193 | function handleProcess<A>(options: SelectOptions<A>) {
194 |   return (input: Terminal.UserInput, state: State) => {
195 |     switch (input.key.name) {
196 |       case "k":
197 |       case "up": {
198 |         return processCursorUp(state, options.choices)
199 |       }
200 |       case "j":
201 |       case "down": {
202 |         return processCursorDown(state, options.choices)
203 |       }
204 |       case "tab": {
205 |         return processNext(state, options.choices)
206 |       }
207 |       case "enter":
208 |       case "return": {
209 |         const selected = options.choices[state]
210 |         if (selected.disabled) {
211 |           return Effect.succeed(Action.Beep())
212 |         }
213 |         return Effect.succeed(Action.Submit({ value: selected.value }))
214 |       }
215 |       default: {
216 |         return Effect.succeed(Action.Beep())
217 |       }
218 |     }
219 |   }
220 | }
221 | 
222 | /** @internal */
223 | export const select = <A>(options: Prompt.Prompt.SelectOptions<A>): Prompt.Prompt<A> => {
224 |   const opts: SelectOptions<A> = {
225 |     maxPerPage: 10,
226 |     ...options
227 |   }
228 |   return InternalPrompt.custom(0, {
229 |     render: handleRender(opts),
230 |     process: handleProcess(opts),
231 |     clear: () => handleClear(opts)
232 |   })
233 | }
234 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/prompt/text.ts:
--------------------------------------------------------------------------------
  1 | import * as Terminal from "@effect/platform/Terminal"
  2 | import * as Ansi from "@effect/printer-ansi/Ansi"
  3 | import * as Doc from "@effect/printer-ansi/AnsiDoc"
  4 | import * as Optimize from "@effect/printer/Optimize"
  5 | import * as Arr from "effect/Array"
  6 | import * as Effect from "effect/Effect"
  7 | import * as Option from "effect/Option"
  8 | import * as Redacted from "effect/Redacted"
  9 | import type * as Prompt from "../../Prompt.js"
 10 | import * as InternalPrompt from "../prompt.js"
 11 | import { Action } from "./action.js"
 12 | import * as InternalAnsiUtils from "./ansi-utils.js"
 13 | 
 14 | interface Options extends Required<Prompt.Prompt.TextOptions> {
 15 |   /**
 16 |    * The type of the text option.
 17 |    */
 18 |   readonly type: "hidden" | "password" | "text"
 19 | }
 20 | 
 21 | interface State {
 22 |   readonly cursor: number
 23 |   readonly offset: number
 24 |   readonly value: string
 25 |   readonly error: Option.Option<string>
 26 | }
 27 | 
 28 | function getValue(state: State, options: Options): string {
 29 |   return state.value.length > 0 ? state.value : options.default
 30 | }
 31 | 
 32 | const renderBeep = Doc.render(Doc.beep, { style: "pretty" })
 33 | 
 34 | function renderClearScreen(state: State, options: Options) {
 35 |   return Effect.gen(function*() {
 36 |     const terminal = yield* Terminal.Terminal
 37 |     const columns = yield* terminal.columns
 38 |     // Erase the current line and place the cursor in column one
 39 |     const resetCurrentLine = Doc.cat(Doc.eraseLine, Doc.cursorLeft)
 40 |     // Check for any error output
 41 |     const clearError = Option.match(state.error, {
 42 |       onNone: () => Doc.empty,
 43 |       onSome: (error) =>
 44 |         // If there was an error, move the cursor down to the final error line and
 45 |         // then clear all lines of error output
 46 |         Doc.cursorDown(InternalAnsiUtils.lines(error, columns)).pipe(
 47 |           // Add a leading newline to the error message to ensure that the corrrect
 48 |           // number of error lines are erased
 49 |           Doc.cat(InternalAnsiUtils.eraseText(`\n${error}`, columns))
 50 |         )
 51 |     })
 52 |     // Ensure that the prior prompt output is cleaned up
 53 |     const clearOutput = InternalAnsiUtils.eraseText(options.message, columns)
 54 |     // Concatenate and render all documents
 55 |     return clearError.pipe(
 56 |       Doc.cat(clearOutput),
 57 |       Doc.cat(resetCurrentLine),
 58 |       Optimize.optimize(Optimize.Deep),
 59 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
 60 |     )
 61 |   })
 62 | }
 63 | 
 64 | function renderInput(nextState: State, options: Options, submitted: boolean) {
 65 |   const text = getValue(nextState, options)
 66 | 
 67 |   const annotation = Option.match(nextState.error, {
 68 |     onNone: () => {
 69 |       if (submitted) {
 70 |         return Ansi.white
 71 |       }
 72 | 
 73 |       if (nextState.value.length === 0) {
 74 |         return Ansi.blackBright
 75 |       }
 76 | 
 77 |       return Ansi.combine(Ansi.underlined, Ansi.cyanBright)
 78 |     },
 79 |     onSome: () => Ansi.red
 80 |   })
 81 | 
 82 |   switch (options.type) {
 83 |     case "hidden": {
 84 |       return Doc.empty
 85 |     }
 86 |     case "password": {
 87 |       return Doc.annotate(Doc.text("*".repeat(text.length)), annotation)
 88 |     }
 89 |     case "text": {
 90 |       return Doc.annotate(Doc.text(text), annotation)
 91 |     }
 92 |   }
 93 | }
 94 | 
 95 | function renderError(nextState: State, pointer: Doc.AnsiDoc) {
 96 |   return Option.match(nextState.error, {
 97 |     onNone: () => Doc.empty,
 98 |     onSome: (error) =>
 99 |       Arr.match(error.split(/\r?\n/), {
100 |         onEmpty: () => Doc.empty,
101 |         onNonEmpty: (errorLines) => {
102 |           const annotateLine = (line: string): Doc.AnsiDoc =>
103 |             Doc.text(line).pipe(
104 |               Doc.annotate(Ansi.combine(Ansi.italicized, Ansi.red))
105 |             )
106 |           const prefix = Doc.cat(Doc.annotate(pointer, Ansi.red), Doc.space)
107 |           const lines = Arr.map(errorLines, (str) => annotateLine(str))
108 |           return Doc.cursorSavePosition.pipe(
109 |             Doc.cat(Doc.hardLine),
110 |             Doc.cat(prefix),
111 |             Doc.cat(Doc.align(Doc.vsep(lines))),
112 |             Doc.cat(Doc.cursorRestorePosition)
113 |           )
114 |         }
115 |       })
116 |   })
117 | }
118 | 
119 | function renderOutput(
120 |   nextState: State,
121 |   leadingSymbol: Doc.AnsiDoc,
122 |   trailingSymbol: Doc.AnsiDoc,
123 |   options: Options,
124 |   submitted: boolean = false
125 | ) {
126 |   const annotateLine = (line: string): Doc.AnsiDoc => Doc.annotate(Doc.text(line), Ansi.bold)
127 |   const promptLines = options.message.split(/\r?\n/)
128 |   const prefix = Doc.cat(leadingSymbol, Doc.space)
129 |   if (Arr.isNonEmptyReadonlyArray(promptLines)) {
130 |     const lines = Arr.map(promptLines, (line) => annotateLine(line))
131 |     return prefix.pipe(
132 |       Doc.cat(Doc.nest(Doc.vsep(lines), 2)),
133 |       Doc.cat(Doc.space),
134 |       Doc.cat(trailingSymbol),
135 |       Doc.cat(Doc.space),
136 |       Doc.cat(renderInput(nextState, options, submitted))
137 |     )
138 |   }
139 |   return Doc.hsep([prefix, trailingSymbol, renderInput(nextState, options, submitted)])
140 | }
141 | 
142 | function renderNextFrame(state: State, options: Options) {
143 |   return Effect.gen(function*() {
144 |     const terminal = yield* Terminal.Terminal
145 |     const columns = yield* terminal.columns
146 |     const figures = yield* InternalAnsiUtils.figures
147 |     const leadingSymbol = Doc.annotate(Doc.text("?"), Ansi.cyanBright)
148 |     const trailingSymbol = Doc.annotate(figures.pointerSmall, Ansi.blackBright)
149 |     const promptMsg = renderOutput(state, leadingSymbol, trailingSymbol, options)
150 |     const errorMsg = renderError(state, figures.pointerSmall)
151 |     return promptMsg.pipe(
152 |       Doc.cat(errorMsg),
153 |       Doc.cat(Doc.cursorMove(state.offset)),
154 |       Optimize.optimize(Optimize.Deep),
155 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
156 |     )
157 |   })
158 | }
159 | 
160 | function renderSubmission(state: State, options: Options) {
161 |   return Effect.gen(function*() {
162 |     const terminal = yield* Terminal.Terminal
163 |     const columns = yield* terminal.columns
164 |     const figures = yield* InternalAnsiUtils.figures
165 |     const leadingSymbol = Doc.annotate(figures.tick, Ansi.green)
166 |     const trailingSymbol = Doc.annotate(figures.ellipsis, Ansi.blackBright)
167 |     const promptMsg = renderOutput(state, leadingSymbol, trailingSymbol, options, true)
168 |     return promptMsg.pipe(
169 |       Doc.cat(Doc.hardLine),
170 |       Optimize.optimize(Optimize.Deep),
171 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
172 |     )
173 |   })
174 | }
175 | 
176 | function processBackspace(state: State) {
177 |   if (state.cursor <= 0) {
178 |     return Effect.succeed(Action.Beep())
179 |   }
180 |   const beforeCursor = state.value.slice(0, state.cursor - 1)
181 |   const afterCursor = state.value.slice(state.cursor)
182 |   const cursor = state.cursor - 1
183 |   const value = `${beforeCursor}${afterCursor}`
184 |   return Effect.succeed(Action.NextFrame({
185 |     state: { ...state, cursor, value, error: Option.none() }
186 |   }))
187 | }
188 | 
189 | function processCursorLeft(state: State) {
190 |   if (state.cursor <= 0) {
191 |     return Effect.succeed(Action.Beep())
192 |   }
193 |   const cursor = state.cursor - 1
194 |   const offset = state.offset - 1
195 |   return Effect.succeed(Action.NextFrame({
196 |     state: { ...state, cursor, offset, error: Option.none() }
197 |   }))
198 | }
199 | 
200 | function processCursorRight(state: State) {
201 |   if (state.cursor >= state.value.length) {
202 |     return Effect.succeed(Action.Beep())
203 |   }
204 |   const cursor = Math.min(state.cursor + 1, state.value.length)
205 |   const offset = Math.min(state.offset + 1, state.value.length)
206 |   return Effect.succeed(Action.NextFrame({
207 |     state: { ...state, cursor, offset, error: Option.none() }
208 |   }))
209 | }
210 | 
211 | function processTab(state: State, options: Options) {
212 |   if (state.value === options.default) {
213 |     return Effect.succeed(Action.Beep())
214 |   }
215 |   const value = getValue(state, options)
216 |   const cursor = value.length
217 |   return Effect.succeed(Action.NextFrame({
218 |     state: { ...state, value, cursor, error: Option.none() }
219 |   }))
220 | }
221 | 
222 | function defaultProcessor(input: string, state: State) {
223 |   const beforeCursor = state.value.slice(0, state.cursor)
224 |   const afterCursor = state.value.slice(state.cursor)
225 |   const value = `${beforeCursor}${input}${afterCursor}`
226 |   const cursor = beforeCursor.length + 1
227 |   return Effect.succeed(Action.NextFrame({
228 |     state: { ...state, cursor, value, error: Option.none() }
229 |   }))
230 | }
231 | 
232 | const initialState: State = {
233 |   cursor: 0,
234 |   offset: 0,
235 |   value: "",
236 |   error: Option.none()
237 | }
238 | 
239 | function handleRender(options: Options) {
240 |   return (state: State, action: Prompt.Prompt.Action<State, string>) => {
241 |     return Action.$match(action, {
242 |       Beep: () => Effect.succeed(renderBeep),
243 |       NextFrame: ({ state }) => renderNextFrame(state, options),
244 |       Submit: () => renderSubmission(state, options)
245 |     })
246 |   }
247 | }
248 | 
249 | function handleProcess(options: Options) {
250 |   return (input: Terminal.UserInput, state: State) => {
251 |     switch (input.key.name) {
252 |       case "backspace": {
253 |         return processBackspace(state)
254 |       }
255 |       case "left": {
256 |         return processCursorLeft(state)
257 |       }
258 |       case "right": {
259 |         return processCursorRight(state)
260 |       }
261 |       case "enter":
262 |       case "return": {
263 |         const value = getValue(state, options)
264 |         return Effect.match(options.validate(value), {
265 |           onFailure: (error) =>
266 |             Action.NextFrame({
267 |               state: { ...state, value, error: Option.some(error) }
268 |             }),
269 |           onSuccess: (value) => Action.Submit({ value })
270 |         })
271 |       }
272 |       case "tab": {
273 |         return processTab(state, options)
274 |       }
275 |       default: {
276 |         const value = Option.getOrElse(input.input, () => "")
277 |         return defaultProcessor(value, state)
278 |       }
279 |     }
280 |   }
281 | }
282 | 
283 | function handleClear(options: Options) {
284 |   return (state: State, _: Prompt.Prompt.Action<State, string>) => {
285 |     return renderClearScreen(state, options)
286 |   }
287 | }
288 | 
289 | function basePrompt(
290 |   options: Prompt.Prompt.TextOptions,
291 |   type: Options["type"]
292 | ): Prompt.Prompt<string> {
293 |   const opts: Options = {
294 |     default: "",
295 |     type,
296 |     validate: Effect.succeed,
297 |     ...options
298 |   }
299 | 
300 |   return InternalPrompt.custom(initialState, {
301 |     render: handleRender(opts),
302 |     process: handleProcess(opts),
303 |     clear: handleClear(opts)
304 |   })
305 | }
306 | 
307 | /** @internal */
308 | export const hidden = (options: Prompt.Prompt.TextOptions): Prompt.Prompt<Redacted.Redacted> =>
309 |   basePrompt(options, "hidden").pipe(InternalPrompt.map(Redacted.make))
310 | 
311 | /** @internal */
312 | export const password = (options: Prompt.Prompt.TextOptions): Prompt.Prompt<Redacted.Redacted> =>
313 |   basePrompt(options, "password").pipe(InternalPrompt.map(Redacted.make))
314 | 
315 | /** @internal */
316 | export const text = (options: Prompt.Prompt.TextOptions): Prompt.Prompt<string> => basePrompt(options, "text")
317 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/prompt/toggle.ts:
--------------------------------------------------------------------------------
  1 | import * as Terminal from "@effect/platform/Terminal"
  2 | import * as Ansi from "@effect/printer-ansi/Ansi"
  3 | import * as Doc from "@effect/printer-ansi/AnsiDoc"
  4 | import * as Optimize from "@effect/printer/Optimize"
  5 | import * as Arr from "effect/Array"
  6 | import * as Effect from "effect/Effect"
  7 | import type * as Prompt from "../../Prompt.js"
  8 | import * as InternalPrompt from "../prompt.js"
  9 | import { Action } from "./action.js"
 10 | import * as InternalAnsiUtils from "./ansi-utils.js"
 11 | 
 12 | interface ToggleOptions extends Required<Prompt.Prompt.ToggleOptions> {}
 13 | 
 14 | type State = boolean
 15 | 
 16 | const renderBeep = Doc.render(Doc.beep, { style: "pretty" })
 17 | 
 18 | function handleClear(options: ToggleOptions) {
 19 |   return Effect.gen(function*() {
 20 |     const terminal = yield* Terminal.Terminal
 21 |     const columns = yield* terminal.columns
 22 |     const clearPrompt = Doc.cat(Doc.eraseLine, Doc.cursorLeft)
 23 |     const clearOutput = InternalAnsiUtils.eraseText(options.message, columns)
 24 |     return clearOutput.pipe(
 25 |       Doc.cat(clearPrompt),
 26 |       Optimize.optimize(Optimize.Deep),
 27 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
 28 |     )
 29 |   })
 30 | }
 31 | 
 32 | function renderToggle(
 33 |   value: boolean,
 34 |   options: ToggleOptions,
 35 |   submitted: boolean = false
 36 | ) {
 37 |   const separator = Doc.annotate(Doc.char("/"), Ansi.blackBright)
 38 |   const selectedAnnotation = Ansi.combine(Ansi.underlined, submitted ? Ansi.white : Ansi.cyanBright)
 39 |   const inactive = value
 40 |     ? Doc.text(options.inactive)
 41 |     : Doc.annotate(Doc.text(options.inactive), selectedAnnotation)
 42 |   const active = value
 43 |     ? Doc.annotate(Doc.text(options.active), selectedAnnotation)
 44 |     : Doc.text(options.active)
 45 |   return Doc.hsep([active, separator, inactive])
 46 | }
 47 | 
 48 | function renderOutput(
 49 |   toggle: Doc.AnsiDoc,
 50 |   leadingSymbol: Doc.AnsiDoc,
 51 |   trailingSymbol: Doc.AnsiDoc,
 52 |   options: ToggleOptions
 53 | ) {
 54 |   const annotateLine = (line: string): Doc.AnsiDoc => Doc.annotate(Doc.text(line), Ansi.bold)
 55 |   const promptLines = options.message.split(/\r?\n/)
 56 |   const prefix = Doc.cat(leadingSymbol, Doc.space)
 57 |   if (Arr.isNonEmptyReadonlyArray(promptLines)) {
 58 |     const lines = Arr.map(promptLines, (line) => annotateLine(line))
 59 |     return prefix.pipe(
 60 |       Doc.cat(Doc.nest(Doc.vsep(lines), 2)),
 61 |       Doc.cat(Doc.space),
 62 |       Doc.cat(trailingSymbol),
 63 |       Doc.cat(Doc.space),
 64 |       Doc.cat(toggle)
 65 |     )
 66 |   }
 67 |   return Doc.hsep([prefix, trailingSymbol, toggle])
 68 | }
 69 | 
 70 | function renderNextFrame(state: State, options: ToggleOptions) {
 71 |   return Effect.gen(function*() {
 72 |     const terminal = yield* Terminal.Terminal
 73 |     const figures = yield* InternalAnsiUtils.figures
 74 |     const columns = yield* terminal.columns
 75 |     const leadingSymbol = Doc.annotate(Doc.text("?"), Ansi.cyanBright)
 76 |     const trailingSymbol = Doc.annotate(figures.pointerSmall, Ansi.blackBright)
 77 |     const toggle = renderToggle(state, options)
 78 |     const promptMsg = renderOutput(toggle, leadingSymbol, trailingSymbol, options)
 79 |     return Doc.cursorHide.pipe(
 80 |       Doc.cat(promptMsg),
 81 |       Optimize.optimize(Optimize.Deep),
 82 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
 83 |     )
 84 |   })
 85 | }
 86 | 
 87 | function renderSubmission(value: boolean, options: ToggleOptions) {
 88 |   return Effect.gen(function*() {
 89 |     const terminal = yield* Terminal.Terminal
 90 |     const figures = yield* InternalAnsiUtils.figures
 91 |     const columns = yield* terminal.columns
 92 |     const leadingSymbol = Doc.annotate(figures.tick, Ansi.green)
 93 |     const trailingSymbol = Doc.annotate(figures.ellipsis, Ansi.blackBright)
 94 |     const toggle = renderToggle(value, options, true)
 95 |     const promptMsg = renderOutput(toggle, leadingSymbol, trailingSymbol, options)
 96 |     return promptMsg.pipe(
 97 |       Doc.cat(Doc.hardLine),
 98 |       Optimize.optimize(Optimize.Deep),
 99 |       Doc.render({ style: "pretty", options: { lineWidth: columns } })
100 |     )
101 |   })
102 | }
103 | 
104 | const activate = Effect.succeed(Action.NextFrame({ state: true }))
105 | const deactivate = Effect.succeed(Action.NextFrame({ state: false }))
106 | 
107 | function handleRender(options: ToggleOptions) {
108 |   return (state: State, action: Prompt.Prompt.Action<State, boolean>) => {
109 |     switch (action._tag) {
110 |       case "Beep": {
111 |         return Effect.succeed(renderBeep)
112 |       }
113 |       case "NextFrame": {
114 |         return renderNextFrame(state, options)
115 |       }
116 |       case "Submit": {
117 |         return renderSubmission(state, options)
118 |       }
119 |     }
120 |   }
121 | }
122 | 
123 | function handleProcess(input: Terminal.UserInput, state: State) {
124 |   switch (input.key.name) {
125 |     case "0":
126 |     case "j":
127 |     case "delete":
128 |     case "right":
129 |     case "down": {
130 |       return deactivate
131 |     }
132 |     case "1":
133 |     case "k":
134 |     case "left":
135 |     case "up": {
136 |       return activate
137 |     }
138 |     case " ":
139 |     case "tab": {
140 |       return state ? deactivate : activate
141 |     }
142 |     case "enter":
143 |     case "return": {
144 |       return Effect.succeed(Action.Submit({ value: state }))
145 |     }
146 |     default: {
147 |       return Effect.succeed(Action.Beep())
148 |     }
149 |   }
150 | }
151 | 
152 | /** @internal */
153 | export const toggle = (options: Prompt.Prompt.ToggleOptions): Prompt.Prompt<boolean> => {
154 |   const opts: ToggleOptions = {
155 |     initial: false,
156 |     active: "on",
157 |     inactive: "off",
158 |     ...options
159 |   }
160 |   return InternalPrompt.custom(opts.initial, {
161 |     render: handleRender(opts),
162 |     process: handleProcess,
163 |     clear: () => handleClear(opts)
164 |   })
165 | }
166 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/prompt/utils.ts:
--------------------------------------------------------------------------------
 1 | /** @internal */
 2 | export const entriesToDisplay = (cursor: number, total: number, maxVisible?: number) => {
 3 |   const max = maxVisible === undefined ? total : maxVisible
 4 |   let startIndex = Math.min(total - max, cursor - Math.floor(max / 2))
 5 |   if (startIndex < 0) {
 6 |     startIndex = 0
 7 |   }
 8 |   const endIndex = Math.min(startIndex + max, total)
 9 |   return { startIndex, endIndex }
10 | }
11 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/usage.ts:
--------------------------------------------------------------------------------
  1 | import * as Arr from "effect/Array"
  2 | import { dual, pipe } from "effect/Function"
  3 | import * as Option from "effect/Option"
  4 | import type * as CliConfig from "../CliConfig.js"
  5 | import type * as HelpDoc from "../HelpDoc.js"
  6 | import type * as Span from "../HelpDoc/Span.js"
  7 | import type * as Usage from "../Usage.js"
  8 | import * as InternalCliConfig from "./cliConfig.js"
  9 | import * as InternalHelpDoc from "./helpDoc.js"
 10 | import * as InternalSpan from "./helpDoc/span.js"
 11 | 
 12 | // =============================================================================
 13 | // Constructors
 14 | // =============================================================================
 15 | 
 16 | /** @internal */
 17 | export const empty: Usage.Usage = {
 18 |   _tag: "Empty"
 19 | }
 20 | 
 21 | /** @internal */
 22 | export const mixed: Usage.Usage = {
 23 |   _tag: "Empty"
 24 | }
 25 | 
 26 | /** @internal */
 27 | export const named = (
 28 |   names: ReadonlyArray<string>,
 29 |   acceptedValues: Option.Option<string>
 30 | ): Usage.Usage => ({
 31 |   _tag: "Named",
 32 |   names,
 33 |   acceptedValues
 34 | })
 35 | 
 36 | /** @internal */
 37 | export const optional = (self: Usage.Usage): Usage.Usage => ({
 38 |   _tag: "Optional",
 39 |   usage: self
 40 | })
 41 | 
 42 | /** @internal */
 43 | export const repeated = (self: Usage.Usage): Usage.Usage => ({
 44 |   _tag: "Repeated",
 45 |   usage: self
 46 | })
 47 | 
 48 | export const alternation = dual<
 49 |   (that: Usage.Usage) => (self: Usage.Usage) => Usage.Usage,
 50 |   (self: Usage.Usage, that: Usage.Usage) => Usage.Usage
 51 | >(2, (self, that) => ({
 52 |   _tag: "Alternation",
 53 |   left: self,
 54 |   right: that
 55 | }))
 56 | 
 57 | /** @internal */
 58 | export const concat = dual<
 59 |   (that: Usage.Usage) => (self: Usage.Usage) => Usage.Usage,
 60 |   (self: Usage.Usage, that: Usage.Usage) => Usage.Usage
 61 | >(2, (self, that) => ({
 62 |   _tag: "Concat",
 63 |   left: self,
 64 |   right: that
 65 | }))
 66 | 
 67 | // =============================================================================
 68 | // Combinators
 69 | // =============================================================================
 70 | 
 71 | /** @internal */
 72 | export const getHelp = (self: Usage.Usage): HelpDoc.HelpDoc => {
 73 |   const spans = enumerate(self, InternalCliConfig.defaultConfig)
 74 |   if (Arr.isNonEmptyReadonlyArray(spans)) {
 75 |     const head = Arr.headNonEmpty(spans)
 76 |     const tail = Arr.tailNonEmpty(spans)
 77 |     if (Arr.isNonEmptyReadonlyArray(tail)) {
 78 |       return pipe(
 79 |         Arr.map(spans, (span) => InternalHelpDoc.p(span)),
 80 |         Arr.reduceRight(
 81 |           InternalHelpDoc.empty,
 82 |           (left, right) => InternalHelpDoc.sequence(left, right)
 83 |         )
 84 |       )
 85 |     }
 86 |     return InternalHelpDoc.p(head)
 87 |   }
 88 |   return InternalHelpDoc.empty
 89 | }
 90 | 
 91 | /** @internal */
 92 | export const enumerate = dual<
 93 |   (config: CliConfig.CliConfig) => (self: Usage.Usage) => Array<Span.Span>,
 94 |   (self: Usage.Usage, config: CliConfig.CliConfig) => Array<Span.Span>
 95 | >(2, (self, config) => render(simplify(self, config), config))
 96 | 
 97 | // =============================================================================
 98 | // Internals
 99 | // =============================================================================
100 | 
101 | const simplify = (self: Usage.Usage, config: CliConfig.CliConfig): Usage.Usage => {
102 |   switch (self._tag) {
103 |     case "Empty": {
104 |       return empty
105 |     }
106 |     case "Mixed": {
107 |       return mixed
108 |     }
109 |     case "Named": {
110 |       if (Option.isNone(Arr.head(render(self, config)))) {
111 |         return empty
112 |       }
113 |       return self
114 |     }
115 |     case "Optional": {
116 |       if (self.usage._tag === "Empty") {
117 |         return empty
118 |       }
119 |       const usage = simplify(self.usage, config)
120 |       // No need to do anything for empty usage
121 |       return usage._tag === "Empty"
122 |         ? empty
123 |         // Avoid re-wrapping the usage in an optional instruction
124 |         : usage._tag === "Optional"
125 |         ? usage
126 |         : optional(usage)
127 |     }
128 |     case "Repeated": {
129 |       const usage = simplify(self.usage, config)
130 |       return usage._tag === "Empty" ? empty : repeated(usage)
131 |     }
132 |     case "Alternation": {
133 |       const leftUsage = simplify(self.left, config)
134 |       const rightUsage = simplify(self.right, config)
135 |       return leftUsage._tag === "Empty"
136 |         ? rightUsage
137 |         : rightUsage._tag === "Empty"
138 |         ? leftUsage
139 |         : alternation(leftUsage, rightUsage)
140 |     }
141 |     case "Concat": {
142 |       const leftUsage = simplify(self.left, config)
143 |       const rightUsage = simplify(self.right, config)
144 |       return leftUsage._tag === "Empty"
145 |         ? rightUsage
146 |         : rightUsage._tag === "Empty"
147 |         ? leftUsage
148 |         : concat(leftUsage, rightUsage)
149 |     }
150 |   }
151 | }
152 | 
153 | const render = (self: Usage.Usage, config: CliConfig.CliConfig): Array<Span.Span> => {
154 |   switch (self._tag) {
155 |     case "Empty": {
156 |       return Arr.of(InternalSpan.text(""))
157 |     }
158 |     case "Mixed": {
159 |       return Arr.of(InternalSpan.text("<command>"))
160 |     }
161 |     case "Named": {
162 |       const typeInfo = config.showTypes
163 |         ? Option.match(self.acceptedValues, {
164 |           onNone: () => InternalSpan.empty,
165 |           onSome: (s) => InternalSpan.concat(InternalSpan.space, InternalSpan.text(s))
166 |         })
167 |         : InternalSpan.empty
168 |       const namesToShow = config.showAllNames
169 |         ? self.names
170 |         : self.names.length > 1
171 |         ? pipe(
172 |           Arr.filter(self.names, (name) => name.startsWith("--")),
173 |           Arr.head,
174 |           Option.map(Arr.of),
175 |           Option.getOrElse(() => self.names)
176 |         )
177 |         : self.names
178 |       const nameInfo = InternalSpan.text(Arr.join(namesToShow, ", "))
179 |       return config.showAllNames && self.names.length > 1
180 |         ? Arr.of(InternalSpan.spans([
181 |           InternalSpan.text("("),
182 |           nameInfo,
183 |           typeInfo,
184 |           InternalSpan.text(")")
185 |         ]))
186 |         : Arr.of(InternalSpan.concat(nameInfo, typeInfo))
187 |     }
188 |     case "Optional": {
189 |       return Arr.map(render(self.usage, config), (span) =>
190 |         InternalSpan.spans([
191 |           InternalSpan.text("["),
192 |           span,
193 |           InternalSpan.text("]")
194 |         ]))
195 |     }
196 |     case "Repeated": {
197 |       return Arr.map(
198 |         render(self.usage, config),
199 |         (span) => InternalSpan.concat(span, InternalSpan.text("..."))
200 |       )
201 |     }
202 |     case "Alternation": {
203 |       if (
204 |         self.left._tag === "Repeated" ||
205 |         self.right._tag === "Repeated" ||
206 |         self.left._tag === "Concat" ||
207 |         self.right._tag === "Concat"
208 |       ) {
209 |         return Arr.appendAll(
210 |           render(self.left, config),
211 |           render(self.right, config)
212 |         )
213 |       }
214 |       return Arr.flatMap(
215 |         render(self.left, config),
216 |         (left) =>
217 |           Arr.map(
218 |             render(self.right, config),
219 |             (right) => InternalSpan.spans([left, InternalSpan.text("|"), right])
220 |           )
221 |       )
222 |     }
223 |     case "Concat": {
224 |       const leftSpan = render(self.left, config)
225 |       const rightSpan = render(self.right, config)
226 |       const separator = Arr.isNonEmptyReadonlyArray(leftSpan) &&
227 |           Arr.isNonEmptyReadonlyArray(rightSpan)
228 |         ? InternalSpan.space
229 |         : InternalSpan.empty
230 |       return Arr.flatMap(
231 |         leftSpan,
232 |         (left) => Arr.map(rightSpan, (right) => InternalSpan.spans([left, separator, right]))
233 |       )
234 |     }
235 |   }
236 | }
237 | 


--------------------------------------------------------------------------------
/packages/cli/src/internal/validationError.ts:
--------------------------------------------------------------------------------
  1 | import type * as HelpDoc from "../HelpDoc.js"
  2 | import type * as ValidationError from "../ValidationError.js"
  3 | 
  4 | const ValidationErrorSymbolKey = "@effect/cli/ValidationError"
  5 | 
  6 | /** @internal */
  7 | export const ValidationErrorTypeId: ValidationError.ValidationErrorTypeId = Symbol.for(
  8 |   ValidationErrorSymbolKey
  9 | ) as ValidationError.ValidationErrorTypeId
 10 | 
 11 | /** @internal */
 12 | export const proto: ValidationError.ValidationError.Proto = {
 13 |   [ValidationErrorTypeId]: ValidationErrorTypeId
 14 | }
 15 | 
 16 | /** @internal */
 17 | export const isValidationError = (u: unknown): u is ValidationError.ValidationError =>
 18 |   typeof u === "object" && u != null && ValidationErrorTypeId in u
 19 | 
 20 | /** @internal */
 21 | export const isCommandMismatch = (
 22 |   self: ValidationError.ValidationError
 23 | ): self is ValidationError.CommandMismatch => self._tag === "CommandMismatch"
 24 | 
 25 | /** @internal */
 26 | export const isCorrectedFlag = (
 27 |   self: ValidationError.ValidationError
 28 | ): self is ValidationError.CorrectedFlag => self._tag === "CorrectedFlag"
 29 | 
 30 | /** @internal */
 31 | export const isHelpRequested = (
 32 |   self: ValidationError.ValidationError
 33 | ): self is ValidationError.HelpRequested => self._tag === "HelpRequested"
 34 | 
 35 | /** @internal */
 36 | export const isInvalidArgument = (
 37 |   self: ValidationError.ValidationError
 38 | ): self is ValidationError.InvalidArgument => self._tag === "InvalidArgument"
 39 | 
 40 | /** @internal */
 41 | export const isInvalidValue = (
 42 |   self: ValidationError.ValidationError
 43 | ): self is ValidationError.InvalidValue => self._tag === "InvalidValue"
 44 | 
 45 | /** @internal */
 46 | export const isMultipleValuesDetected = (
 47 |   self: ValidationError.ValidationError
 48 | ): self is ValidationError.MultipleValuesDetected => self._tag === "MultipleValuesDetected"
 49 | 
 50 | /** @internal */
 51 | export const isMissingFlag = (
 52 |   self: ValidationError.ValidationError
 53 | ): self is ValidationError.MissingFlag => self._tag === "MissingFlag"
 54 | 
 55 | /** @internal */
 56 | export const isMissingValue = (
 57 |   self: ValidationError.ValidationError
 58 | ): self is ValidationError.MissingValue => self._tag === "MissingValue"
 59 | 
 60 | /** @internal */
 61 | export const isMissingSubcommand = (
 62 |   self: ValidationError.ValidationError
 63 | ): self is ValidationError.MissingSubcommand => self._tag === "MissingSubcommand"
 64 | 
 65 | /** @internal */
 66 | export const isNoBuiltInMatch = (
 67 |   self: ValidationError.ValidationError
 68 | ): self is ValidationError.NoBuiltInMatch => self._tag === "NoBuiltInMatch"
 69 | 
 70 | /** @internal */
 71 | export const isUnclusteredFlag = (
 72 |   self: ValidationError.ValidationError
 73 | ): self is ValidationError.UnclusteredFlag => self._tag === "UnclusteredFlag"
 74 | 
 75 | /** @internal */
 76 | export const commandMismatch = (error: HelpDoc.HelpDoc): ValidationError.ValidationError => {
 77 |   const op = Object.create(proto)
 78 |   op._tag = "CommandMismatch"
 79 |   op.error = error
 80 |   return op
 81 | }
 82 | 
 83 | /** @internal */
 84 | export const correctedFlag = (error: HelpDoc.HelpDoc): ValidationError.ValidationError => {
 85 |   const op = Object.create(proto)
 86 |   op._tag = "CorrectedFlag"
 87 |   op.error = error
 88 |   return op
 89 | }
 90 | 
 91 | /** @internal */
 92 | export const invalidArgument = (error: HelpDoc.HelpDoc): ValidationError.ValidationError => {
 93 |   const op = Object.create(proto)
 94 |   op._tag = "InvalidArgument"
 95 |   op.error = error
 96 |   return op
 97 | }
 98 | 
 99 | /** @internal */
100 | export const invalidValue = (error: HelpDoc.HelpDoc): ValidationError.ValidationError => {
101 |   const op = Object.create(proto)
102 |   op._tag = "InvalidValue"
103 |   op.error = error
104 |   return op
105 | }
106 | 
107 | /** @internal */
108 | export const missingFlag = (error: HelpDoc.HelpDoc): ValidationError.ValidationError => {
109 |   const op = Object.create(proto)
110 |   op._tag = "MissingFlag"
111 |   op.error = error
112 |   return op
113 | }
114 | 
115 | /** @internal */
116 | export const missingValue = (error: HelpDoc.HelpDoc): ValidationError.ValidationError => {
117 |   const op = Object.create(proto)
118 |   op._tag = "MissingValue"
119 |   op.error = error
120 |   return op
121 | }
122 | 
123 | /** @internal */
124 | export const missingSubcommand = (error: HelpDoc.HelpDoc): ValidationError.ValidationError => {
125 |   const op = Object.create(proto)
126 |   op._tag = "MissingSubcommand"
127 |   op.error = error
128 |   return op
129 | }
130 | 
131 | /** @internal */
132 | export const multipleValuesDetected = (
133 |   error: HelpDoc.HelpDoc,
134 |   values: ReadonlyArray<unknown>
135 | ): ValidationError.ValidationError => {
136 |   const op = Object.create(proto)
137 |   op._tag = "MultipleValuesDetected"
138 |   op.error = error
139 |   op.values = values
140 |   return op
141 | }
142 | 
143 | /** @internal */
144 | export const noBuiltInMatch = (error: HelpDoc.HelpDoc): ValidationError.ValidationError => {
145 |   const op = Object.create(proto)
146 |   op._tag = "NoBuiltInMatch"
147 |   op.error = error
148 |   return op
149 | }
150 | 
151 | /** @internal */
152 | export const unclusteredFlag = (
153 |   error: HelpDoc.HelpDoc,
154 |   unclustered: ReadonlyArray<string>,
155 |   rest: ReadonlyArray<string>
156 | ): ValidationError.ValidationError => {
157 |   const op = Object.create(proto)
158 |   op._tag = "UnclusteredFlag"
159 |   op.error = error
160 |   op.unclustered = unclustered
161 |   op.rest = rest
162 |   return op
163 | }
164 | 


--------------------------------------------------------------------------------
/packages/cli/test/Args.test.ts:
--------------------------------------------------------------------------------
  1 | import * as Args from "@effect/cli/Args"
  2 | import * as CliConfig from "@effect/cli/CliConfig"
  3 | import * as HelpDoc from "@effect/cli/HelpDoc"
  4 | import * as ValidationError from "@effect/cli/ValidationError"
  5 | import { FileSystem, Path } from "@effect/platform"
  6 | import { NodeContext } from "@effect/platform-node"
  7 | import * as Array from "effect/Array"
  8 | import * as Effect from "effect/Effect"
  9 | import * as Option from "effect/Option"
 10 | import * as Schema from "effect/Schema"
 11 | import { describe, expect, it } from "vitest"
 12 | 
 13 | const runEffect = <E, A>(
 14 |   self: Effect.Effect<A, E, NodeContext.NodeContext>
 15 | ): Promise<A> => Effect.provide(self, NodeContext.layer).pipe(Effect.runPromise)
 16 | 
 17 | describe("Args", () => {
 18 |   it("validates an valid argument with a default", () =>
 19 |     Effect.gen(function*(_) {
 20 |       const args = Args.integer().pipe(Args.withDefault(0))
 21 |       const result = yield* _(
 22 |         Args.validate(args, Array.empty(), CliConfig.defaultConfig)
 23 |       )
 24 |       expect(result).toEqual([Array.empty(), 0])
 25 |     }).pipe(runEffect))
 26 | 
 27 |   it("validates an valid optional argument", () =>
 28 |     Effect.gen(function*(_) {
 29 |       const args = Args.integer().pipe(Args.optional)
 30 |       let result = yield* _(
 31 |         Args.validate(args, Array.empty(), CliConfig.defaultConfig)
 32 |       )
 33 |       expect(result).toEqual([Array.empty(), Option.none()])
 34 | 
 35 |       result = yield* _(
 36 |         Args.validate(args, ["123"], CliConfig.defaultConfig)
 37 |       )
 38 |       expect(result).toEqual([Array.empty(), Option.some(123)])
 39 |     }).pipe(runEffect))
 40 | 
 41 |   it("does not validate an invalid argument even when there is a default", () =>
 42 |     Effect.gen(function*(_) {
 43 |       const args = Args.integer().pipe(Args.withDefault(0))
 44 |       const result = yield* _(Effect.flip(
 45 |         Args.validate(args, Array.of("abc"), CliConfig.defaultConfig)
 46 |       ))
 47 |       expect(result).toEqual(ValidationError.invalidArgument(HelpDoc.p("'abc' is not a integer")))
 48 |     }).pipe(runEffect))
 49 | 
 50 |   it("should validate an existing file that is expected to exist", () =>
 51 |     Effect.gen(function*(_) {
 52 |       const path = yield* _(Path.Path)
 53 |       const filePath = path.join(__dirname, "Args.test.ts")
 54 |       const args = Args.file({ name: "files", exists: "yes" }).pipe(Args.repeated)
 55 |       const result = yield* _(
 56 |         Args.validate(args, Array.of(filePath), CliConfig.defaultConfig)
 57 |       )
 58 |       expect(result).toEqual([Array.empty(), Array.of(filePath)])
 59 |     }).pipe(runEffect))
 60 | 
 61 |   it("should return an error when a file that is expected to exist is not found", () =>
 62 |     Effect.gen(function*(_) {
 63 |       const path = yield* _(Path.Path)
 64 |       const filePath = path.join(__dirname, "NotExist.test.ts")
 65 |       const args = Args.file({ name: "files", exists: "yes" }).pipe(Args.repeated)
 66 |       const result = yield* _(
 67 |         Effect.flip(Args.validate(args, Array.of(filePath), CliConfig.defaultConfig))
 68 |       )
 69 |       expect(result).toEqual(ValidationError.invalidArgument(HelpDoc.p(
 70 |         `Path '${filePath}' must exist`
 71 |       )))
 72 |     }).pipe(runEffect))
 73 | 
 74 |   it("should validate a non-existent file that is expected not to exist", () =>
 75 |     Effect.gen(function*(_) {
 76 |       const path = yield* _(Path.Path)
 77 |       const filePath = path.join(__dirname, "NotExist.test.ts")
 78 |       const args = Args.file({ name: "files", exists: "no" }).pipe(Args.repeated)
 79 |       const result = yield* _(
 80 |         Args.validate(args, Array.of(filePath), CliConfig.defaultConfig)
 81 |       )
 82 |       expect(result).toEqual([Array.empty(), Array.of(filePath)])
 83 |     }).pipe(runEffect))
 84 | 
 85 |   it("should validate a series of files", () =>
 86 |     Effect.gen(function*(_) {
 87 |       const path = yield* _(Path.Path)
 88 |       const filePath = path.join(__dirname, "NotExist.test.ts")
 89 |       const args = Args.file({ name: "files", exists: "no" }).pipe(Args.repeated)
 90 |       const result = yield* _(
 91 |         Args.validate(args, Array.make(filePath, filePath), CliConfig.defaultConfig)
 92 |       )
 93 |       expect(result).toEqual([Array.empty(), Array.make(filePath, filePath)])
 94 |     }).pipe(runEffect))
 95 | 
 96 |   it("validates an valid argument with a Schema", () =>
 97 |     Effect.gen(function*(_) {
 98 |       const args = Args.integer().pipe(Args.withSchema(Schema.Positive))
 99 |       const result = yield* _(
100 |         Args.validate(args, ["123"], CliConfig.defaultConfig)
101 |       )
102 |       expect(result).toEqual([Array.empty(), 123])
103 |     }).pipe(runEffect))
104 | 
105 |   it("does not validate an invalid argument with a Schema", () =>
106 |     Effect.gen(function*(_) {
107 |       const args = Args.integer().pipe(Args.withSchema(Schema.Positive))
108 |       const result = yield* _(Effect.flip(
109 |         Args.validate(args, Array.of("-123"), CliConfig.defaultConfig)
110 |       ))
111 |       expect(result).toEqual(ValidationError.invalidArgument(HelpDoc.p(
112 |         "Positive\n" +
113 |           "└─ Predicate refinement failure\n" +
114 |           "   └─ Expected a positive number, actual -123"
115 |       )))
116 |     }).pipe(runEffect))
117 | 
118 |   it("fileContent", () =>
119 |     Effect.gen(function*(_) {
120 |       const fs = yield* _(FileSystem.FileSystem)
121 |       const path = yield* _(Path.Path)
122 |       const filePath = path.join(__dirname, "fixtures/config.json")
123 |       const content = yield* _(fs.readFile(filePath))
124 |       const args = Args.fileContent({ name: "files" }).pipe(Args.repeated)
125 |       const result = yield* _(
126 |         Args.validate(args, Array.of(filePath), CliConfig.defaultConfig)
127 |       )
128 |       expect(result).toEqual([Array.empty(), Array.of([filePath, content])])
129 |     }).pipe(runEffect))
130 | 
131 |   it("fileText", () =>
132 |     Effect.gen(function*(_) {
133 |       const fs = yield* _(FileSystem.FileSystem)
134 |       const path = yield* _(Path.Path)
135 |       const filePath = path.join(__dirname, "fixtures/config.json")
136 |       const content = yield* _(fs.readFileString(filePath))
137 |       const args = Args.fileText({ name: "files" }).pipe(Args.repeated)
138 |       const result = yield* _(
139 |         Args.validate(args, Array.of(filePath), CliConfig.defaultConfig)
140 |       )
141 |       expect(result).toEqual([Array.empty(), Array.of([filePath, content])])
142 |     }).pipe(runEffect))
143 | 
144 |   it("fileParse", () =>
145 |     Effect.gen(function*(_) {
146 |       const fs = yield* _(FileSystem.FileSystem)
147 |       const path = yield* _(Path.Path)
148 |       const filePath = path.join(__dirname, "fixtures/config.json")
149 |       const content = yield* _(fs.readFileString(filePath), Effect.map(JSON.parse))
150 |       const args = Args.fileParse({ name: "files" }).pipe(Args.repeated)
151 |       const result = yield* _(
152 |         Args.validate(args, Array.of(filePath), CliConfig.defaultConfig)
153 |       )
154 |       expect(result).toEqual([Array.empty(), Array.of(content)])
155 |     }).pipe(runEffect))
156 | 
157 |   it("fileSchema", () =>
158 |     Effect.gen(function*(_) {
159 |       const fs = yield* _(FileSystem.FileSystem)
160 |       const path = yield* _(Path.Path)
161 |       const filePath = path.join(__dirname, "fixtures/config.json")
162 |       const content = yield* _(fs.readFileString(filePath), Effect.map(JSON.parse))
163 |       const args = Args.fileSchema(
164 |         Schema.Struct({
165 |           foo: Schema.Boolean,
166 |           bar: Schema.Literal("baz")
167 |         }),
168 |         { name: "files" }
169 |       ).pipe(Args.repeated)
170 |       const result = yield* _(
171 |         Args.validate(args, Array.of(filePath), CliConfig.defaultConfig)
172 |       )
173 |       expect(result).toEqual([Array.empty(), Array.of(content)])
174 |     }).pipe(runEffect))
175 | })
176 | 


--------------------------------------------------------------------------------
/packages/cli/test/AutoCorrect.test.ts:
--------------------------------------------------------------------------------
/packages/cli/test/CliApp.test.ts:
--------------------------------------------------------------------------------
  1 | import type * as CliApp from "@effect/cli/CliApp"
  2 | import * as CliConfig from "@effect/cli/CliConfig"
  3 | import * as Command from "@effect/cli/Command"
  4 | import * as HelpDoc from "@effect/cli/HelpDoc"
  5 | import * as MockConsole from "@effect/cli/test/services/MockConsole"
  6 | import * as ValidationError from "@effect/cli/ValidationError"
  7 | import { NodeContext } from "@effect/platform-node"
  8 | import { Array, Console, Effect, FiberRef, Layer, LogLevel } from "effect"
  9 | import { describe, expect, it } from "vitest"
 10 | 
 11 | const MainLive = Effect.gen(function*(_) {
 12 |   const console = yield* _(MockConsole.make)
 13 |   return Layer.mergeAll(
 14 |     Console.setConsole(console),
 15 |     NodeContext.layer
 16 |   )
 17 | }).pipe(Layer.unwrapEffect)
 18 | 
 19 | const runEffect = <E, A>(
 20 |   self: Effect.Effect<A, E, CliApp.CliApp.Environment>
 21 | ): Promise<A> =>
 22 |   Effect.provide(self, MainLive).pipe(
 23 |     Effect.runPromise
 24 |   )
 25 | 
 26 | describe("CliApp", () => {
 27 |   it("should return an error if excess arguments are provided", () =>
 28 |     Effect.gen(function*() {
 29 |       const cli = Command.run(Command.make("foo"), {
 30 |         name: "Test",
 31 |         version: "1.0.0"
 32 |       })
 33 |       const args = Array.make("node", "test.js", "--bar")
 34 |       const result = yield* Effect.flip(cli(args))
 35 |       expect(result).toEqual(ValidationError.invalidValue(HelpDoc.p(
 36 |         "Received unknown argument: '--bar'"
 37 |       )))
 38 |     }).pipe(runEffect))
 39 | 
 40 |   describe("Built-In Options Processing", () => {
 41 |     it("should display built-in options in help if `CliConfig.showBuiltIns` is true", () => {
 42 |       const CliConfigLive = CliConfig.layer({
 43 |         showBuiltIns: true // this is the default
 44 |       })
 45 |       return Effect.gen(function*() {
 46 |         const cli = Command.run(Command.make("foo"), {
 47 |           name: "Test",
 48 |           version: "1.0.0"
 49 |         })
 50 |         yield* cli([])
 51 |         const lines = yield* MockConsole.getLines()
 52 |         const output = lines.join("\n")
 53 |         expect(output).toContain("--completions sh | bash | fish | zsh")
 54 |         expect(output).toContain("(-h, --help)")
 55 |         expect(output).toContain("--wizard")
 56 |         expect(output).toContain("--version")
 57 |       }).pipe(
 58 |         Effect.provide(Layer.mergeAll(MainLive, CliConfigLive)),
 59 |         Effect.runPromise
 60 |       )
 61 |     })
 62 | 
 63 |     it("should not display built-in options in help if `CliConfig.showBuiltIns` is false", () => {
 64 |       const CliConfigLive = CliConfig.layer({
 65 |         showBuiltIns: false
 66 |       })
 67 |       return Effect.gen(function*() {
 68 |         const cli = Command.run(Command.make("foo"), {
 69 |           name: "Test",
 70 |           version: "1.0.0"
 71 |         })
 72 |         yield* cli([])
 73 |         const lines = yield* MockConsole.getLines()
 74 |         const output = lines.join("\n")
 75 |         expect(output).not.toContain("--completions sh | bash | fish | zsh")
 76 |         expect(output).not.toContain("(-h, --help)")
 77 |         expect(output).not.toContain("--wizard")
 78 |         expect(output).not.toContain("--version")
 79 |       }).pipe(
 80 |         Effect.provide(Layer.mergeAll(MainLive, CliConfigLive)),
 81 |         Effect.runPromise
 82 |       )
 83 |     })
 84 | 
 85 |     it("should set the minimum log level for a command", () =>
 86 |       Effect.gen(function*() {
 87 |         let logLevel: LogLevel.LogLevel | undefined = undefined
 88 |         const logging = Command.make("logging").pipe(Command.withHandler(() =>
 89 |           Effect.gen(function*() {
 90 |             logLevel = yield* FiberRef.get(FiberRef.currentMinimumLogLevel)
 91 |           })
 92 |         ))
 93 |         const cli = Command.run(logging, {
 94 |           name: "Test",
 95 |           version: "1.0.0"
 96 |         })
 97 |         yield* cli(["node", "logging.js", "--log-level", "debug"])
 98 |         expect(logLevel).toEqual(LogLevel.Debug)
 99 |       }).pipe(runEffect))
100 |   })
101 | })
102 | 


--------------------------------------------------------------------------------
/packages/cli/test/Command.test.ts:
--------------------------------------------------------------------------------
  1 | import { Args, Command, Options } from "@effect/cli"
  2 | import { NodeContext } from "@effect/platform-node"
  3 | import { Config, ConfigProvider, Context, Effect, Layer } from "effect"
  4 | import { assert, describe, it } from "vitest"
  5 | 
  6 | const git = Command.make("git", {
  7 |   verbose: Options.boolean("verbose").pipe(
  8 |     Options.withAlias("v"),
  9 |     Options.withFallbackConfig(Config.boolean("VERBOSE"))
 10 |   )
 11 | }).pipe(
 12 |   Command.withDescription("the stupid content tracker"),
 13 |   Command.provideEffectDiscard(() =>
 14 |     Effect.flatMap(
 15 |       Messages,
 16 |       (_) => _.log("shared")
 17 |     )
 18 |   )
 19 | )
 20 | 
 21 | const clone = Command.make("clone", {
 22 |   repository: Args.text({ name: "repository" }).pipe(
 23 |     Args.withFallbackConfig(Config.string("REPOSITORY"))
 24 |   )
 25 | }, ({ repository }) =>
 26 |   Effect.gen(function*(_) {
 27 |     const { log } = yield* _(Messages)
 28 |     const { verbose } = yield* _(git)
 29 |     if (verbose) {
 30 |       yield* _(log(`Cloning ${repository}`))
 31 |     } else {
 32 |       yield* _(log("Cloning"))
 33 |     }
 34 |   })).pipe(Command.withDescription("Clone a repository into a new directory"))
 35 | 
 36 | const AddService = Context.GenericTag<"AddService">("AddService")
 37 | 
 38 | const add = Command.make("add", {
 39 |   pathspec: Args.text({ name: "pathspec" })
 40 | }).pipe(
 41 |   Command.withHandler(({ pathspec }) =>
 42 |     Effect.gen(function*(_) {
 43 |       yield* _(AddService)
 44 |       const { log } = yield* _(Messages)
 45 |       const { verbose } = yield* _(git)
 46 |       if (verbose) {
 47 |         yield* _(log(`Adding ${pathspec}`))
 48 |       } else {
 49 |         yield* _(log(`Adding`))
 50 |       }
 51 |     })
 52 |   ),
 53 |   Command.withDescription("Add file contents to the index"),
 54 |   Command.provideEffect(AddService, (_) => Effect.succeed("AddService" as const))
 55 | )
 56 | 
 57 | const run = git.pipe(
 58 |   Command.withSubcommands([clone, add]),
 59 |   Command.run({
 60 |     name: "git",
 61 |     version: "1.0.0"
 62 |   })
 63 | )
 64 | 
 65 | describe("Command", () => {
 66 |   describe("git", () => {
 67 |     it("no sub-command", () =>
 68 |       Effect.gen(function*(_) {
 69 |         const messages = yield* _(Messages)
 70 |         yield* _(run(["--verbose"]))
 71 |         yield* _(run([]))
 72 |         assert.deepStrictEqual(yield* _(messages.messages), ["shared", "shared"])
 73 |       }).pipe(Effect.provide(EnvLive), Effect.runPromise))
 74 | 
 75 |     it("add", () =>
 76 |       Effect.gen(function*(_) {
 77 |         const messages = yield* _(Messages)
 78 |         yield* _(run(["node", "git.js", "add", "file"]))
 79 |         yield* _(run(["node", "git.js", "--verbose", "add", "file"]))
 80 |         assert.deepStrictEqual(yield* _(messages.messages), [
 81 |           "shared",
 82 |           "Adding",
 83 |           "shared",
 84 |           "Adding file"
 85 |         ])
 86 |       }).pipe(Effect.provide(EnvLive), Effect.runPromise))
 87 | 
 88 |     it("clone", () =>
 89 |       Effect.gen(function*(_) {
 90 |         const messages = yield* _(Messages)
 91 |         yield* _(run(["node", "git.js", "clone", "repo"]))
 92 |         yield* _(run(["node", "git.js", "--verbose", "clone", "repo"]))
 93 |         assert.deepStrictEqual(yield* _(messages.messages), [
 94 |           "shared",
 95 |           "Cloning",
 96 |           "shared",
 97 |           "Cloning repo"
 98 |         ])
 99 |       }).pipe(Effect.provide(EnvLive), Effect.runPromise))
100 | 
101 |     it("withFallbackConfig Options boolean", () =>
102 |       Effect.gen(function*(_) {
103 |         const messages = yield* _(Messages)
104 |         yield* _(run(["node", "git.js", "clone", "repo"]))
105 |         assert.deepStrictEqual(yield* _(messages.messages), [
106 |           "shared",
107 |           "Cloning repo"
108 |         ])
109 |       }).pipe(
110 |         Effect.withConfigProvider(ConfigProvider.fromMap(
111 |           new Map([["VERBOSE", "true"]])
112 |         )),
113 |         Effect.provide(EnvLive),
114 |         Effect.runPromise
115 |       ))
116 | 
117 |     it("withFallbackConfig Args", () =>
118 |       Effect.gen(function*(_) {
119 |         const messages = yield* _(Messages)
120 |         yield* _(run(["node", "git.js", "clone"]))
121 |         assert.deepStrictEqual(yield* _(messages.messages), [
122 |           "shared",
123 |           "Cloning repo"
124 |         ])
125 |       }).pipe(
126 |         Effect.withConfigProvider(ConfigProvider.fromMap(
127 |           new Map([["VERBOSE", "true"], ["REPOSITORY", "repo"]])
128 |         )),
129 |         Effect.provide(EnvLive),
130 |         Effect.runPromise
131 |       ))
132 |   })
133 | })
134 | 
135 | // --
136 | 
137 | interface Messages {
138 |   readonly log: (message: string) => Effect.Effect<void>
139 |   readonly messages: Effect.Effect<ReadonlyArray<string>>
140 | }
141 | const Messages = Context.GenericTag<Messages>("Messages")
142 | const MessagesLive = Layer.sync(Messages, () => {
143 |   const messages: Array<string> = []
144 |   return Messages.of({
145 |     log: (message) => Effect.sync(() => messages.push(message)),
146 |     messages: Effect.sync(() => messages)
147 |   })
148 | })
149 | const EnvLive = Layer.mergeAll(MessagesLive, NodeContext.layer)
150 | 


--------------------------------------------------------------------------------
/packages/cli/test/ConfigFile.test.ts:
--------------------------------------------------------------------------------
 1 | import * as ConfigFile from "@effect/cli/ConfigFile"
 2 | import type { FileSystem } from "@effect/platform"
 3 | import { Path } from "@effect/platform"
 4 | import { NodeContext } from "@effect/platform-node"
 5 | import * as Config from "effect/Config"
 6 | import * as Effect from "effect/Effect"
 7 | import { assert, describe, it } from "vitest"
 8 | 
 9 | const runEffect = <E, A>(
10 |   self: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>
11 | ): Promise<A> => Effect.provide(self, NodeContext.layer).pipe(Effect.runPromise)
12 | 
13 | describe("ConfigFile", () => {
14 |   it("loads json files", () =>
15 |     Effect.gen(function*(_) {
16 |       const path = yield* _(Path.Path)
17 |       const result = yield* _(
18 |         Config.all([
19 |           Config.boolean("foo"),
20 |           Config.string("bar")
21 |         ]),
22 |         Effect.provide(ConfigFile.layer("config", {
23 |           searchPaths: [path.join(__dirname, "fixtures")],
24 |           formats: ["json"]
25 |         }))
26 |       )
27 |       assert.deepStrictEqual(result, [true, "baz"])
28 |     }).pipe(runEffect))
29 | 
30 |   it("loads yaml", () =>
31 |     Effect.gen(function*(_) {
32 |       const path = yield* _(Path.Path)
33 |       const result = yield* _(
34 |         Config.integer("foo"),
35 |         Effect.provide(ConfigFile.layer("config-file", {
36 |           searchPaths: [path.join(__dirname, "fixtures")]
37 |         }))
38 |       )
39 |       assert.deepStrictEqual(result, 123)
40 |     }).pipe(runEffect))
41 | })
42 | 


--------------------------------------------------------------------------------
/packages/cli/test/Primitive.test.ts:
--------------------------------------------------------------------------------
  1 | import * as CliConfig from "@effect/cli/CliConfig"
  2 | import * as Primitive from "@effect/cli/Primitive"
  3 | import type { FileSystem } from "@effect/platform"
  4 | import { NodeFileSystem } from "@effect/platform-node"
  5 | import { Array, Effect, Equal, Function, Option } from "effect"
  6 | import * as fc from "effect/FastCheck"
  7 | import { describe, expect, it } from "vitest"
  8 | 
  9 | const runEffect = <E, A>(self: Effect.Effect<A, E, FileSystem.FileSystem>): Promise<A> =>
 10 |   Effect.provide(self, NodeFileSystem.layer).pipe(Effect.runPromise)
 11 | 
 12 | describe("Primitive", () => {
 13 |   describe("Bool", () => {
 14 |     it("validates that truthy text representations of a boolean return true", () =>
 15 |       fc.assert(fc.asyncProperty(trueValuesArb, (str) =>
 16 |         Effect.gen(function*(_) {
 17 |           const bool = Primitive.boolean(Option.none())
 18 |           const result = yield* _(Primitive.validate(
 19 |             bool,
 20 |             Option.some(str),
 21 |             CliConfig.defaultConfig
 22 |           ))
 23 |           expect(result).toBe(true)
 24 |         }).pipe(runEffect))))
 25 | 
 26 |     it("validates that falsy text representations of a boolean return false", () =>
 27 |       fc.assert(fc.asyncProperty(falseValuesArb, (str) =>
 28 |         Effect.gen(function*(_) {
 29 |           const bool = Primitive.boolean(Option.none())
 30 |           const result = yield* _(Primitive.validate(
 31 |             bool,
 32 |             Option.some(str),
 33 |             CliConfig.defaultConfig
 34 |           ))
 35 |           expect(result).toBe(false)
 36 |         }).pipe(runEffect))))
 37 | 
 38 |     it("validates that invalid boolean representations are rejected", () =>
 39 |       Effect.gen(function*(_) {
 40 |         const bool = Primitive.boolean(Option.none())
 41 |         const result = yield* _(
 42 |           Effect.flip(Primitive.validate(bool, Option.some("bad"), CliConfig.defaultConfig))
 43 |         )
 44 |         expect(result).toBe("Unable to recognize 'bad' as a valid boolean")
 45 |       }).pipe(runEffect))
 46 | 
 47 |     it("validates that the default value will be used if a value is not provided", () =>
 48 |       fc.assert(fc.asyncProperty(fc.boolean(), (value) =>
 49 |         Effect.gen(function*(_) {
 50 |           const bool = Primitive.boolean(Option.some(value))
 51 |           const result = yield* _(Primitive.validate(bool, Option.none(), CliConfig.defaultConfig))
 52 |           expect(result).toBe(value)
 53 |         }).pipe(runEffect))))
 54 |   })
 55 | 
 56 |   describe("Choice", () => {
 57 |     it("validates a choice that is one of the alternatives", () =>
 58 |       fc.assert(
 59 |         fc.asyncProperty(pairsArb, ([[selectedName, selectedValue], pairs]) =>
 60 |           Effect.gen(function*(_) {
 61 |             const alternatives = Function.unsafeCoerce<
 62 |               ReadonlyArray<[string, number]>,
 63 |               Array.NonEmptyReadonlyArray<[string, number]>
 64 |             >(pairs)
 65 |             const choice = Primitive.choice(alternatives)
 66 |             const result = yield* _(Primitive.validate(
 67 |               choice,
 68 |               Option.some(selectedName),
 69 |               CliConfig.defaultConfig
 70 |             ))
 71 |             expect(result).toEqual(selectedValue)
 72 |           }).pipe(runEffect))
 73 |       ))
 74 | 
 75 |     it("does not validate a choice that is not one of the alternatives", () =>
 76 |       fc.assert(fc.asyncProperty(pairsArb, ([tuple, pairs]) =>
 77 |         Effect.gen(function*(_) {
 78 |           const selectedName = tuple[0]
 79 |           const alternatives = Function.unsafeCoerce<
 80 |             ReadonlyArray<[string, number]>,
 81 |             Array.NonEmptyReadonlyArray<[string, number]>
 82 |           >(Array.filter(pairs, (pair) => !Equal.equals(tuple, pair)))
 83 |           const choice = Primitive.choice(alternatives)
 84 |           const result = yield* _(Effect.flip(Primitive.validate(
 85 |             choice,
 86 |             Option.some(selectedName),
 87 |             CliConfig.defaultConfig
 88 |           )))
 89 |           expect(result).toMatch(/^Expected one of the following cases:\s.*/)
 90 |         }).pipe(runEffect))))
 91 |   })
 92 | 
 93 |   simplePrimitiveTestSuite(Primitive.date, fc.date({ noInvalidDate: true }), "Date")
 94 | 
 95 |   simplePrimitiveTestSuite(
 96 |     Primitive.float,
 97 |     fc.float({ noNaN: true }).filter((n) => n !== 0),
 98 |     "Float"
 99 |   )
100 | 
101 |   simplePrimitiveTestSuite(Primitive.integer, fc.integer(), "Integer")
102 | 
103 |   describe("Text", () => {
104 |     it("validates all user-defined text", () =>
105 |       fc.assert(fc.asyncProperty(fc.string(), (str) =>
106 |         Effect.gen(function*(_) {
107 |           const result = yield* _(Primitive.validate(
108 |             Primitive.text,
109 |             Option.some(str),
110 |             CliConfig.defaultConfig
111 |           ))
112 |           expect(result).toEqual(str)
113 |         }).pipe(runEffect))))
114 |   })
115 | })
116 | 
117 | const simplePrimitiveTestSuite = <A>(
118 |   primitive: Primitive.Primitive<A>,
119 |   arb: fc.Arbitrary<A>,
120 |   primitiveTypeName: string
121 | ) => {
122 |   describe(`${primitiveTypeName}`, () => {
123 |     it(`validates that valid values are accepted`, () =>
124 |       fc.assert(fc.asyncProperty(arb, (value) =>
125 |         Effect.gen(function*(_) {
126 |           const str = value instanceof Date ? value.toISOString() : `${value}`
127 |           const result = yield* _(
128 |             Primitive.validate(primitive, Option.some(str), CliConfig.defaultConfig)
129 |           )
130 |           expect(result).toEqual(value)
131 |         }).pipe(runEffect))))
132 | 
133 |     it(`validates that invalid values are rejected`, () =>
134 |       Effect.gen(function*(_) {
135 |         const result = yield* _(
136 |           Effect.flip(Primitive.validate(primitive, Option.some("bad"), CliConfig.defaultConfig))
137 |         )
138 |         expect(result).toBe(`'bad' is not a ${Primitive.getTypeName(primitive)}`)
139 |       }).pipe(runEffect))
140 |   })
141 | }
142 | 
143 | const randomizeCharacterCases = (str: string): string => {
144 |   let result = ""
145 |   for (let i = 0; i < str.length; i++) {
146 |     const char = str[i]
147 |     result += Math.random() < 0.5 ? char.toLowerCase() : char.toUpperCase()
148 |   }
149 |   return result
150 | }
151 | 
152 | const trueValuesArb = fc.constantFrom("true", "1", "y", "yes", "on").map(randomizeCharacterCases)
153 | const falseValuesArb = fc.constantFrom("false", "0", "n", "no", "off").map(randomizeCharacterCases)
154 | 
155 | const pairsArb = fc.array(fc.tuple(fc.string(), fc.float()), { minLength: 2, maxLength: 100 })
156 |   .map((pairs) => Array.dedupeWith(pairs, ([str1], [str2]) => str1 === str2))
157 |   .chain((pairs) => fc.tuple(fc.constantFrom(...pairs), fc.constant(pairs)))
158 | 


--------------------------------------------------------------------------------
/packages/cli/test/Wizard.test.ts:
--------------------------------------------------------------------------------
 1 | import type * as CliApp from "@effect/cli/CliApp"
 2 | import * as Command from "@effect/cli/Command"
 3 | import * as Options from "@effect/cli/Options"
 4 | import * as MockConsole from "@effect/cli/test/services/MockConsole"
 5 | import * as MockTerminal from "@effect/cli/test/services/MockTerminal"
 6 | import {} from "@effect/platform"
 7 | import { NodeFileSystem, NodePath } from "@effect/platform-node"
 8 | import { Array, Effect } from "effect"
 9 | import * as Console from "effect/Console"
10 | import * as Fiber from "effect/Fiber"
11 | import * as Layer from "effect/Layer"
12 | import { describe, expect, it } from "vitest"
13 | 
14 | const MainLive = Effect.gen(function*(_) {
15 |   const console = yield* _(MockConsole.make)
16 |   return Layer.mergeAll(
17 |     Console.setConsole(console),
18 |     NodeFileSystem.layer,
19 |     MockTerminal.layer,
20 |     NodePath.layer
21 |   )
22 | }).pipe(Layer.unwrapEffect)
23 | 
24 | const runEffect = <E, A>(
25 |   self: Effect.Effect<A, E, CliApp.CliApp.Environment>
26 | ): Promise<A> => Effect.provide(self, MainLive).pipe(Effect.runPromise)
27 | 
28 | describe("Wizard", () => {
29 |   it("should quit the wizard when CTRL+C is entered", () =>
30 |     Effect.gen(function*(_) {
31 |       const cli = Command.make("foo", { message: Options.text("message") }).pipe(
32 |         Command.run({
33 |           name: "Test",
34 |           version: "1.0.0"
35 |         })
36 |       )
37 |       const args = Array.make("node", "test", "--wizard")
38 |       const fiber = yield* _(Effect.fork(cli(args)))
39 |       yield* _(MockTerminal.inputKey("c", { ctrl: true }))
40 |       yield* _(Fiber.join(fiber))
41 |       const lines = yield* _(MockConsole.getLines({ stripAnsi: true }))
42 |       const result = Array.some(lines, (line) => line.includes("Quitting wizard mode..."))
43 |       expect(result).toBe(true)
44 |     }).pipe(runEffect))
45 | })
46 | 


--------------------------------------------------------------------------------
/packages/cli/test/fixtures/config-file.toml:
--------------------------------------------------------------------------------
1 | foo = 123
2 | 


--------------------------------------------------------------------------------
/packages/cli/test/fixtures/config.ini:
--------------------------------------------------------------------------------
1 | foo = true
2 | bar = baz
3 | 


--------------------------------------------------------------------------------
/packages/cli/test/fixtures/config.json:
--------------------------------------------------------------------------------
1 | {
2 |   "foo": true,
3 |   "bar": "baz"
4 | }
5 | 


--------------------------------------------------------------------------------
/packages/cli/test/fixtures/config.toml:
--------------------------------------------------------------------------------
1 | foo = true
2 | bar = "baz"
3 | 


--------------------------------------------------------------------------------
/packages/cli/test/fixtures/config.yaml:
--------------------------------------------------------------------------------
1 | foo: true
2 | bar: baz
3 | 


--------------------------------------------------------------------------------
/packages/cli/test/services/MockConsole.ts:
--------------------------------------------------------------------------------
 1 | import * as Array from "effect/Array"
 2 | import * as Console from "effect/Console"
 3 | import * as Context from "effect/Context"
 4 | import * as Effect from "effect/Effect"
 5 | import * as Ref from "effect/Ref"
 6 | 
 7 | export interface MockConsole extends Console.Console {
 8 |   readonly getLines: (
 9 |     params?: Partial<{
10 |       readonly stripAnsi: boolean
11 |     }>
12 |   ) => Effect.Effect<ReadonlyArray<string>>
13 | }
14 | 
15 | export const MockConsole = Context.GenericTag<Console.Console, MockConsole>(
16 |   "effect/Console"
17 | )
18 | const pattern = new RegExp(
19 |   [
20 |     "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
21 |     "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))"
22 |   ].join("|"),
23 |   "g"
24 | )
25 | 
26 | const stripAnsi = (str: string) => str.replace(pattern, "")
27 | 
28 | export const make = Effect.gen(function*(_) {
29 |   const lines = yield* _(Ref.make(Array.empty<string>()))
30 | 
31 |   const getLines: MockConsole["getLines"] = (params = {}) =>
32 |     Ref.get(lines).pipe(Effect.map((lines) =>
33 |       params.stripAnsi || false
34 |         ? Array.map(lines, stripAnsi)
35 |         : lines
36 |     ))
37 | 
38 |   const log: MockConsole["log"] = (...args) => Ref.update(lines, Array.appendAll(args))
39 | 
40 |   return MockConsole.of({
41 |     [Console.TypeId]: Console.TypeId,
42 |     getLines,
43 |     log,
44 |     unsafe: globalThis.console,
45 |     assert: () => Effect.void,
46 |     clear: Effect.void,
47 |     count: () => Effect.void,
48 |     countReset: () => Effect.void,
49 |     debug: () => Effect.void,
50 |     dir: () => Effect.void,
51 |     dirxml: () => Effect.void,
52 |     error: () => Effect.void,
53 |     group: () => Effect.void,
54 |     groupEnd: Effect.void,
55 |     info: () => Effect.void,
56 |     table: () => Effect.void,
57 |     time: () => Effect.void,
58 |     timeEnd: () => Effect.void,
59 |     timeLog: () => Effect.void,
60 |     trace: () => Effect.void,
61 |     warn: () => Effect.void
62 |   })
63 | })
64 | 
65 | export const getLines = (
66 |   params?: Partial<{
67 |     readonly stripAnsi?: boolean
68 |   }>
69 | ): Effect.Effect<ReadonlyArray<string>> => Effect.consoleWith((console) => (console as MockConsole).getLines(params))
70 | 


--------------------------------------------------------------------------------
/packages/cli/test/services/MockTerminal.ts:
--------------------------------------------------------------------------------
  1 | import * as Terminal from "@effect/platform/Terminal"
  2 | import * as Array from "effect/Array"
  3 | import * as Console from "effect/Console"
  4 | import * as Context from "effect/Context"
  5 | import * as Effect from "effect/Effect"
  6 | import * as Layer from "effect/Layer"
  7 | import * as Option from "effect/Option"
  8 | import * as Queue from "effect/Queue"
  9 | 
 10 | // =============================================================================
 11 | // Models
 12 | // =============================================================================
 13 | 
 14 | export interface MockTerminal extends Terminal.Terminal {
 15 |   readonly inputText: (text: string) => Effect.Effect<void>
 16 |   readonly inputKey: (
 17 |     key: string,
 18 |     modifiers?: Partial<MockTerminal.Modifiers>
 19 |   ) => Effect.Effect<void>
 20 | }
 21 | 
 22 | export declare namespace MockTerminal {
 23 |   export interface Modifiers {
 24 |     readonly ctrl: boolean
 25 |     readonly meta: boolean
 26 |     readonly shift: boolean
 27 |   }
 28 | }
 29 | 
 30 | // =============================================================================
 31 | // Context
 32 | // =============================================================================
 33 | 
 34 | export const MockTerminal = Context.GenericTag<Terminal.Terminal, MockTerminal>(
 35 |   "@effect/platform/Terminal"
 36 | )
 37 | 
 38 | // =============================================================================
 39 | // Constructors
 40 | // =============================================================================
 41 | 
 42 | export const make = Effect.gen(function*(_) {
 43 |   const queue = yield* _(Effect.acquireRelease(
 44 |     Queue.unbounded<Terminal.UserInput>(),
 45 |     Queue.shutdown
 46 |   ))
 47 | 
 48 |   const inputText: MockTerminal["inputText"] = (text: string) => {
 49 |     const inputs = Array.map(text.split(""), (key) => toUserInput(key))
 50 |     return Queue.offerAll(queue, inputs).pipe(Effect.asVoid)
 51 |   }
 52 | 
 53 |   const inputKey: MockTerminal["inputKey"] = (
 54 |     key: string,
 55 |     modifiers?: Partial<MockTerminal.Modifiers>
 56 |   ) => {
 57 |     const input = toUserInput(key, modifiers)
 58 |     return Queue.offer(queue, input).pipe(Effect.asVoid)
 59 |   }
 60 | 
 61 |   const display: MockTerminal["display"] = (input) => Console.log(input)
 62 | 
 63 |   const readInput: MockTerminal["readInput"] = Queue.take(queue).pipe(
 64 |     Effect.filterOrFail((input) => !shouldQuit(input), () => new Terminal.QuitException()),
 65 |     Effect.timeoutFail({
 66 |       duration: "2 seconds",
 67 |       onTimeout: () => new Terminal.QuitException()
 68 |     })
 69 |   )
 70 | 
 71 |   return MockTerminal.of({
 72 |     columns: Effect.succeed(80),
 73 |     display,
 74 |     readInput,
 75 |     readLine: Effect.succeed(""),
 76 |     inputKey,
 77 |     inputText
 78 |   })
 79 | })
 80 | 
 81 | // =============================================================================
 82 | // Layer
 83 | // =============================================================================
 84 | 
 85 | export const layer = Layer.scoped(MockTerminal, make)
 86 | 
 87 | // =============================================================================
 88 | // Accessors
 89 | // =============================================================================
 90 | 
 91 | export const { columns, readInput, readLine } = Effect.serviceConstants(MockTerminal)
 92 | export const { inputKey, inputText } = Effect.serviceFunctions(MockTerminal)
 93 | 
 94 | // =============================================================================
 95 | // Utilities
 96 | // =============================================================================
 97 | 
 98 | const shouldQuit = (input: Terminal.UserInput): boolean =>
 99 |   input.key.ctrl && (input.key.name === "c" || input.key.name === "d")
100 | 
101 | const toUserInput = (
102 |   key: string,
103 |   modifiers: Partial<MockTerminal.Modifiers> = {}
104 | ): Terminal.UserInput => {
105 |   const { ctrl = false, meta = false, shift = false } = modifiers
106 |   return {
107 |     input: Option.some(key),
108 |     key: { name: key, ctrl, meta, shift }
109 |   }
110 | }
111 | 


--------------------------------------------------------------------------------
/packages/cli/test/snapshots/bash-completions:
--------------------------------------------------------------------------------
 1 | [
 2 |   "function _forge_bash_completions() {",
 3 |   "    local i cur prev opts cmd",
 4 |   "    COMPREPLY=()",
 5 |   "    cur="${COMP_WORDS[COMP_CWORD]}"",
 6 |   "    prev="${COMP_WORDS[COMP_CWORD-1]}"",
 7 |   "    cmd=""",
 8 |   "    opts=""",
 9 |   "    for i in "${COMP_WORDS[@]}"; do",
10 |   "        case "${cmd},${i}" in",
11 |   "            ",$1")",
12 |   "                cmd="forge"",
13 |   "                ;;",
14 |   "            forge,cache)",
15 |   "                cmd="forge__cache"",
16 |   "                ;;",
17 |   "            forge,cache,clean)",
18 |   "                cmd="forge__cache__clean"",
19 |   "                ;;",
20 |   "            forge,cache,ls)",
21 |   "                cmd="forge__cache__ls"",
22 |   "                ;;",
23 |   "            *)",
24 |   "                ;;",
25 |   "        esac",
26 |   "    done",
27 |   "    case "${cmd}" in",
28 |   "        forge)",
29 |   "            opts="-h --completions --log-level --help --wizard --version cache"",
30 |   "            if [[ ${cur} == -* || ${COMP_CWORD} -eq 1 ]] ; then",
31 |   "                COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )",
32 |   "                return 0",
33 |   "            fi",
34 |   "            case "${prev}" in",
35 |   "            *)",
36 |   "                COMPREPLY=()",
37 |   "                ;;",
38 |   "            esac",
39 |   "            COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )",
40 |   "            return 0",
41 |   "            ;;",
42 |   "        forge__cache)",
43 |   "            opts="-h --verbose --completions --log-level --help --wizard --version clean ls"",
44 |   "            if [[ ${cur} == -* || ${COMP_CWORD} -eq 2 ]] ; then",
45 |   "                COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )",
46 |   "                return 0",
47 |   "            fi",
48 |   "            case "${prev}" in",
49 |   "                --verbose)",
50 |   "                    COMPREPLY=( "${cur}" )",
51 |   "                    return 0",
52 |   "                    ;;",
53 |   "            *)",
54 |   "                COMPREPLY=()",
55 |   "                ;;",
56 |   "            esac",
57 |   "            COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )",
58 |   "            return 0",
59 |   "            ;;",
60 |   "        forge__cache__clean)",
61 |   "            opts="-h --completions --log-level --help --wizard --version"",
62 |   "            if [[ ${cur} == -* || ${COMP_CWORD} -eq 3 ]] ; then",
63 |   "                COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )",
64 |   "                return 0",
65 |   "            fi",
66 |   "            case "${prev}" in",
67 |   "            *)",
68 |   "                COMPREPLY=()",
69 |   "                ;;",
70 |   "            esac",
71 |   "            COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )",
72 |   "            return 0",
73 |   "            ;;",
74 |   "        forge__cache__ls)",
75 |   "            opts="-h --completions --log-level --help --wizard --version"",
76 |   "            if [[ ${cur} == -* || ${COMP_CWORD} -eq 3 ]] ; then",
77 |   "                COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )",
78 |   "                return 0",
79 |   "            fi",
80 |   "            case "${prev}" in",
81 |   "            *)",
82 |   "                COMPREPLY=()",
83 |   "                ;;",
84 |   "            esac",
85 |   "            COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )",
86 |   "            return 0",
87 |   "            ;;",
88 |   "    esac",
89 |   "}",
90 |   "complete -F _forge_bash_completions -o nosort -o bashdefault -o default forge",
91 | ]


--------------------------------------------------------------------------------
/packages/cli/test/snapshots/fish-completions:
--------------------------------------------------------------------------------
 1 | [
 2 |   "complete -c forge -n "__fish_use_subcommand" -l completions -r -f -a "{sh'',bash'',fish'',zsh''}" -d 'Generate a completion script for a specific shell.'",
 3 |   "complete -c forge -n "__fish_use_subcommand" -l log-level -r -f -a "{all'',trace'',debug'',info'',warning'',error'',fatal'',none''}" -d 'Sets the minimum log level for a command.'",
 4 |   "complete -c forge -n "__fish_use_subcommand" -s h -l help -d 'Show the help documentation for a command.'",
 5 |   "complete -c forge -n "__fish_use_subcommand" -l wizard -d 'Start wizard mode for a command.'",
 6 |   "complete -c forge -n "__fish_use_subcommand" -l version -d 'Show the version of the application.'",
 7 |   "complete -c forge -n "__fish_use_subcommand" -f -a "cache" -d 'The cache command does cache things'",
 8 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and not __fish_seen_subcommand_from clean; and not __fish_seen_subcommand_from ls" -l completions -r -f -a "{sh'',bash'',fish'',zsh''}" -d 'Generate a completion script for a specific shell.'",
 9 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and not __fish_seen_subcommand_from clean; and not __fish_seen_subcommand_from ls" -l log-level -r -f -a "{all'',trace'',debug'',info'',warning'',error'',fatal'',none''}" -d 'Sets the minimum log level for a command.'",
10 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and not __fish_seen_subcommand_from clean; and not __fish_seen_subcommand_from ls" -s h -l help -d 'Show the help documentation for a command.'",
11 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and not __fish_seen_subcommand_from clean; and not __fish_seen_subcommand_from ls" -l wizard -d 'Start wizard mode for a command.'",
12 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and not __fish_seen_subcommand_from clean; and not __fish_seen_subcommand_from ls" -l version -d 'Show the version of the application.'",
13 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and not __fish_seen_subcommand_from clean; and not __fish_seen_subcommand_from ls" -l verbose -d 'Output in verbose mode'",
14 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and not __fish_seen_subcommand_from clean; and not __fish_seen_subcommand_from ls" -f -a "clean"",
15 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and not __fish_seen_subcommand_from clean; and not __fish_seen_subcommand_from ls" -f -a "ls"",
16 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and __fish_seen_subcommand_from clean" -l completions -r -f -a "{sh'',bash'',fish'',zsh''}" -d 'Generate a completion script for a specific shell.'",
17 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and __fish_seen_subcommand_from clean" -l log-level -r -f -a "{all'',trace'',debug'',info'',warning'',error'',fatal'',none''}" -d 'Sets the minimum log level for a command.'",
18 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and __fish_seen_subcommand_from clean" -s h -l help -d 'Show the help documentation for a command.'",
19 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and __fish_seen_subcommand_from clean" -l wizard -d 'Start wizard mode for a command.'",
20 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and __fish_seen_subcommand_from clean" -l version -d 'Show the version of the application.'",
21 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and __fish_seen_subcommand_from ls" -l completions -r -f -a "{sh'',bash'',fish'',zsh''}" -d 'Generate a completion script for a specific shell.'",
22 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and __fish_seen_subcommand_from ls" -l log-level -r -f -a "{all'',trace'',debug'',info'',warning'',error'',fatal'',none''}" -d 'Sets the minimum log level for a command.'",
23 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and __fish_seen_subcommand_from ls" -s h -l help -d 'Show the help documentation for a command.'",
24 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and __fish_seen_subcommand_from ls" -l wizard -d 'Start wizard mode for a command.'",
25 |   "complete -c forge -n "__fish_seen_subcommand_from cache; and __fish_seen_subcommand_from ls" -l version -d 'Show the version of the application.'",
26 | ]


--------------------------------------------------------------------------------
/packages/cli/test/snapshots/zsh-completions:
--------------------------------------------------------------------------------
  1 | [
  2 |   "#compdef forge",
  3 |   "",
  4 |   "autoload -U is-at-least",
  5 |   "",
  6 |   "function _forge_zsh_completions() {",
  7 |   "    typeset -A opt_args",
  8 |   "    typeset -a _arguments_options",
  9 |   "    local ret=1",
 10 |   "",
 11 |   "    if is-at-least 5.2; then",
 12 |   "        _arguments_options=(-s -S -C)",
 13 |   "    else",
 14 |   "        _arguments_options=(-s -C)",
 15 |   "    fi",
 16 |   "",
 17 |   "    local context curcontext="$curcontext" state line",
 18 |   "    _arguments "${_arguments_options[@]}" \",
 19 |   "        '--completions[Generate a completion script for a specific shell.]:CHOICE:(sh bash fish zsh)' \",
 20 |   "        '--log-level[Sets the minimum log level for a command.]:CHOICE:(all trace debug info warning error fatal none)' \",
 21 |   "        '-h[Show the help documentation for a command.]' \",
 22 |   "        '--help[Show the help documentation for a command.]' \",
 23 |   "        '--wizard[Start wizard mode for a command.]' \",
 24 |   "        '--version[Show the version of the application.]' \",
 25 |   "        ":: :_forge_commands" \",
 26 |   "        "*::: :->forge" \",
 27 |   "        && ret=0",
 28 |   "    case $state in",
 29 |   "        (forge)",
 30 |   "        words=($line[1] "${words[@]}")",
 31 |   "        (( CURRENT += 1 ))",
 32 |   "        curcontext="${curcontext%:*:*}:forge-command-$line[1]:"",
 33 |   "        case $line[1] in",
 34 |   "            (cache)",
 35 |   "            _arguments "${_arguments_options[@]}" \",
 36 |   "                '--completions[Generate a completion script for a specific shell.]:CHOICE:(sh bash fish zsh)' \",
 37 |   "                '--log-level[Sets the minimum log level for a command.]:CHOICE:(all trace debug info warning error fatal none)' \",
 38 |   "                '-h[Show the help documentation for a command.]' \",
 39 |   "                '--help[Show the help documentation for a command.]' \",
 40 |   "                '--wizard[Start wizard mode for a command.]' \",
 41 |   "                '--version[Show the version of the application.]' \",
 42 |   "                '--verbose[Output in verbose mode]' \",
 43 |   "                ":: :_forge__cache_commands" \",
 44 |   "                "*::: :->cache" \",
 45 |   "                && ret=0",
 46 |   "            case $state in",
 47 |   "                (cache)",
 48 |   "                words=($line[1] "${words[@]}")",
 49 |   "                (( CURRENT += 1 ))",
 50 |   "                curcontext="${curcontext%:*:*}:forge-cache-command-$line[1]:"",
 51 |   "                case $line[1] in",
 52 |   "                    (clean)",
 53 |   "                    _arguments "${_arguments_options[@]}" \",
 54 |   "                        '--completions[Generate a completion script for a specific shell.]:CHOICE:(sh bash fish zsh)' \",
 55 |   "                        '--log-level[Sets the minimum log level for a command.]:CHOICE:(all trace debug info warning error fatal none)' \",
 56 |   "                        '-h[Show the help documentation for a command.]' \",
 57 |   "                        '--help[Show the help documentation for a command.]' \",
 58 |   "                        '--wizard[Start wizard mode for a command.]' \",
 59 |   "                        '--version[Show the version of the application.]' \",
 60 |   "                        && ret=0",
 61 |   "                    ;;",
 62 |   "                    (ls)",
 63 |   "                    _arguments "${_arguments_options[@]}" \",
 64 |   "                        '--completions[Generate a completion script for a specific shell.]:CHOICE:(sh bash fish zsh)' \",
 65 |   "                        '--log-level[Sets the minimum log level for a command.]:CHOICE:(all trace debug info warning error fatal none)' \",
 66 |   "                        '-h[Show the help documentation for a command.]' \",
 67 |   "                        '--help[Show the help documentation for a command.]' \",
 68 |   "                        '--wizard[Start wizard mode for a command.]' \",
 69 |   "                        '--version[Show the version of the application.]' \",
 70 |   "                        && ret=0",
 71 |   "                    ;;",
 72 |   "                esac",
 73 |   "                ;;",
 74 |   "            esac",
 75 |   "            ;;",
 76 |   "        esac",
 77 |   "        ;;",
 78 |   "    esac",
 79 |   "}",
 80 |   "",
 81 |   "(( $+functions[_forge_commands] )) ||",
 82 |   "_forge_commands() {",
 83 |   "    local commands; commands=(
 84 |         'cache:The cache command does cache things' \
 85 |     )",
 86 |   "    _describe -t commands 'forge commands' commands "$@"",
 87 |   "}",
 88 |   "(( $+functions[_forge__cache_commands] )) ||",
 89 |   "_forge__cache_commands() {",
 90 |   "    local commands; commands=(
 91 |         'clean:' \
 92 |         'ls:' \
 93 |     )",
 94 |   "    _describe -t commands 'forge cache commands' commands "$@"",
 95 |   "}",
 96 |   "(( $+functions[_forge__cache__clean_commands] )) ||",
 97 |   "_forge__cache__clean_commands() {",
 98 |   "    local commands; commands=()",
 99 |   "    _describe -t commands 'forge cache clean commands' commands "$@"",
100 |   "}",
101 |   "(( $+functions[_forge__cache__ls_commands] )) ||",
102 |   "_forge__cache__ls_commands() {",
103 |   "    local commands; commands=()",
104 |   "    _describe -t commands 'forge cache ls commands' commands "$@"",
105 |   "}",
106 |   "",
107 |   "if [ "$funcstack[1]" = "_forge_zsh_completions" ]; then",
108 |   "    _forge_zsh_completions "$@"",
109 |   "else",
110 |   "    compdef _forge_zsh_completions forge",
111 |   "fi",
112 | ]


--------------------------------------------------------------------------------
/packages/cli/test/utils/grep.ts:
--------------------------------------------------------------------------------
 1 | import * as Args from "@effect/cli/Args"
 2 | import * as Descriptor from "@effect/cli/CommandDescriptor"
 3 | import * as Options from "@effect/cli/Options"
 4 | 
 5 | const afterFlag = Options.integer("after").pipe(Options.withAlias("A"))
 6 | const beforeFlag = Options.integer("before").pipe(Options.withAlias("B"))
 7 | export const options: Options.Options<[number, number]> = Options.all([
 8 |   afterFlag,
 9 |   beforeFlag
10 | ])
11 | 
12 | export const args: Args.Args<string> = Args.text()
13 | 
14 | export const command: Descriptor.Command<{
15 |   readonly name: "grep"
16 |   readonly options: [number, number]
17 |   readonly args: string
18 | }> = Descriptor.make("grep", options, args)
19 | 


--------------------------------------------------------------------------------
/packages/cli/test/utils/tail.ts:
--------------------------------------------------------------------------------
 1 | import * as Args from "@effect/cli/Args"
 2 | import * as Descriptor from "@effect/cli/CommandDescriptor"
 3 | import * as Options from "@effect/cli/Options"
 4 | 
 5 | export const options: Options.Options<number> = Options.integer("n").pipe(
 6 |   Options.withDefault(10)
 7 | )
 8 | 
 9 | export const args: Args.Args<string> = Args.file({ name: "file" })
10 | 
11 | export const command: Descriptor.Command<{
12 |   readonly name: "tail"
13 |   readonly options: number
14 |   readonly args: string
15 | }> = Descriptor.make("tail", options, args)
16 | 


--------------------------------------------------------------------------------
/packages/cli/test/utils/wc.ts:
--------------------------------------------------------------------------------
 1 | import * as Args from "@effect/cli/Args"
 2 | import * as Descriptor from "@effect/cli/CommandDescriptor"
 3 | import * as Options from "@effect/cli/Options"
 4 | 
 5 | const bytesFlag = Options.boolean("c")
 6 | const linesFlag = Options.boolean("l")
 7 | const wordsFlag = Options.boolean("w")
 8 | const charFlag = Options.boolean("m", { ifPresent: false })
 9 | export const options: Options.Options<[boolean, boolean, boolean, boolean]> = Options.all([
10 |   bytesFlag,
11 |   linesFlag,
12 |   wordsFlag,
13 |   charFlag
14 | ])
15 | 
16 | export const args: Args.Args<ReadonlyArray<string>> = Args.repeated(Args.file({ name: "files" }))
17 | 
18 | export const command: Descriptor.Command<{
19 |   readonly name: "wc"
20 |   readonly options: [boolean, boolean, boolean, boolean]
21 |   readonly args: ReadonlyArray<string>
22 | }> = Descriptor.make("wc", options, args)
23 | 


--------------------------------------------------------------------------------
/packages/cli/tsconfig.build.json:
--------------------------------------------------------------------------------
 1 | {
 2 |   "extends": "./tsconfig.src.json",
 3 |   "references": [
 4 |     { "path": "../effect/tsconfig.build.json" },
 5 |     { "path": "../printer/tsconfig.build.json" },
 6 |     { "path": "../printer-ansi/tsconfig.build.json" },
 7 |     { "path": "../platform/tsconfig.build.json" },
 8 |     { "path": "../platform-node/tsconfig.build.json" }
 9 |   ],
10 |   "compilerOptions": {
11 |     "types": ["node"],
12 |     "tsBuildInfoFile": ".tsbuildinfo/build.tsbuildinfo",
13 |     "outDir": "build/esm",
14 |     "declarationDir": "build/dts",
15 |     "stripInternal": true
16 |   }
17 | }
18 | 


--------------------------------------------------------------------------------
/packages/cli/tsconfig.examples.json:
--------------------------------------------------------------------------------
 1 | {
 2 |   "extends": "../../tsconfig.base.json",
 3 |   "include": ["examples"],
 4 |   "references": [
 5 |     { "path": "tsconfig.src.json" },
 6 |     { "path": "../effect" },
 7 |     { "path": "../printer" },
 8 |     { "path": "../printer-ansi" },
 9 |     { "path": "../platform" },
10 |     { "path": "../platform-node" }
11 |   ],
12 |   "compilerOptions": {
13 |     "types": ["node"],
14 |     "tsBuildInfoFile": ".tsbuildinfo/examples.tsbuildinfo",
15 |     "rootDir": "examples",
16 |     "noEmit": true
17 |   }
18 | }
19 | 


--------------------------------------------------------------------------------
/packages/cli/tsconfig.json:
--------------------------------------------------------------------------------
 1 | {
 2 |   "extends": "../../tsconfig.base.json",
 3 |   "include": [],
 4 |   "references": [
 5 |     { "path": "tsconfig.src.json" },
 6 |     { "path": "tsconfig.test.json" },
 7 |     { "path": "tsconfig.examples.json" }
 8 |   ]
 9 | }
10 | 


--------------------------------------------------------------------------------
/packages/cli/tsconfig.src.json:
--------------------------------------------------------------------------------
 1 | {
 2 |   "extends": "../../tsconfig.base.json",
 3 |   "include": ["src"],
 4 |   "references": [
 5 |     { "path": "../effect" },
 6 |     { "path": "../printer" },
 7 |     { "path": "../printer-ansi" },
 8 |     { "path": "../platform" },
 9 |     { "path": "../platform-node" }
10 |   ],
11 |   "compilerOptions": {
12 |     "types": ["node"],
13 |     "outDir": "build/src",
14 |     "tsBuildInfoFile": ".tsbuildinfo/src.tsbuildinfo",
15 |     "rootDir": "src"
16 |   }
17 | }
18 | 


--------------------------------------------------------------------------------
/packages/cli/tsconfig.test.json:
--------------------------------------------------------------------------------
 1 | {
 2 |   "extends": "../../tsconfig.base.json",
 3 |   "include": ["test"],
 4 |   "references": [
 5 |     { "path": "tsconfig.src.json" },
 6 |     { "path": "../effect" },
 7 |     { "path": "../printer" },
 8 |     { "path": "../printer-ansi" },
 9 |     { "path": "../platform" },
10 |     { "path": "../platform-node" }
11 |   ],
12 |   "compilerOptions": {
13 |     "types": ["node"],
14 |     "tsBuildInfoFile": ".tsbuildinfo/test.tsbuildinfo",
15 |     "rootDir": "test",
16 |     "noEmit": true
17 |   }
18 | }
19 | 


--------------------------------------------------------------------------------
/packages/cli/vitest.config.ts:
--------------------------------------------------------------------------------
1 | import { mergeConfig, type UserConfigExport } from "vitest/config"
2 | import shared from "../../vitest.shared.js"
3 | 
4 | const config: UserConfigExport = {}
5 | 
6 | export default mergeConfig(shared, config)
7 | 


---------------------------------------------------------