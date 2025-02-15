import type { TaskTree, Scope } from "src/types/types.js"

// TODO: Do more here?
export const scope = <T extends TaskTree>(description: string, children: T) => {
  return {
    _tag: "scope",
    tags: [],
    description,
    children,
  } satisfies Scope
}