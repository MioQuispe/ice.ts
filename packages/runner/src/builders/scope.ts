import type { TaskTree, Scope } from "src/types/types.js"
import { Option } from "effect"
// TODO: Do more here?
export const scope = <T extends TaskTree>(description: string, children: T) => {
  return {
    _tag: "scope",
    tags: [],
    description,
    children,
    defaultTask: Option.none(),
  } satisfies Scope
}