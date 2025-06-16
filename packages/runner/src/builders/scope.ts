import type { TaskTree, Scope } from "../types/types.js"
import { Option } from "effect"
// TODO: Do more here?
export const scope = <T extends TaskTree>(description: string, children: T) => {
  return {
    _tag: "scope",
    id: Symbol("scope"),
    tags: [],
    description,
    children,
  } satisfies Scope
}