import React, { useState, useMemo } from "react";
import { Box, useInput, useStdout } from "ink";
import { TaskList, TaskListItem } from "./Task.js";
import type { Task, TaskTree, Scope } from "../../../types/types.js";
import { useICE } from "../index.js"; // import runTask from context
import type { StateOthers } from "./Task.js";

/**
 * A flattened representation of a task tree item.
 */
export interface FlattenedTask {
  key: string;
  label: string;
  depth: number;
  node: Task | Scope | TaskTree;
}

/**
 * Flattens a nested task tree into a single array.
 *
 * @param taskTree - The task tree or scope to flatten.
 * @param path - The current key path (used internally for recursion).
 * @param depth - The current depth level (used for indentation).
 * @returns An array of flattened task items.
 */
export const flattenTaskTree = (
  taskTree: TaskTree | Scope | Task,
  path: string[] = [],
  depth = 0
): FlattenedTask[] => {
  let flattened: FlattenedTask[] = [];
  
  // If the taskTree has a _tag property of "scope" and has children,
  // iterate over its children.
  if (
    typeof taskTree === "object" &&
    "_tag" in taskTree &&
    taskTree._tag === "scope" &&
    "children" in taskTree &&
    taskTree.children
  ) {
    for (const key of Object.keys(taskTree.children)) {
      const node = taskTree.children[key];
      const fullPath = [...path, key];
      flattened.push({
        key: fullPath.join(":"),
        label: key,
        depth,
        node,
      });
      // Recursively flatten if the child is a scope.
      if (
        typeof node === "object" &&
        "_tag" in node &&
        node._tag === "scope" &&
        "children" in node &&
        node.children
      ) {
        flattened = flattened.concat(flattenTaskTree(node, fullPath, depth + 1));
      }
    }
  } else {
    // Otherwise, iterate over keys if the tree structure is a plain object.
    for (const key of Object.keys(taskTree)) {
      const node = (taskTree as Record<string, any>)[key];
      const fullPath = [...path, key];
      flattened.push({
        key: fullPath.join(":"),
        label: key,
        depth,
        node,
      });
      // If this node is a scope, flatten its children.
      if (
        typeof node === "object" &&
        "_tag" in node &&
        node._tag === "scope" &&
        "children" in node &&
        node.children
      ) {
        flattened = flattened.concat(flattenTaskTree(node, fullPath, depth + 1));
      }
    }
  }
  return flattened;
};

/**
 * FlatScrollableTaskTreeList renders the entire task tree (flattened)
 * as a unified scrollable list. The component computes the available
 * viewport height based on terminal rows and displays only the slice of
 * the flattened tasks that fits. It also tracks the currently selected
 * task and adjusts the scroll offset so that the selected task remains visible.
 *
 * @param props.taskTree - The task tree structure.
 * @param props.title - A title for the list (reserved for future use).
 * @param props.path - An optional array representing the current key path.
 * @returns A scrollable list of tasks with proper indentation.
 */
export const FlatScrollableTaskTreeList: React.FC<{
  taskTree: TaskTree | Scope | Task;
  title: string;
  path?: string[];
}> = ({ taskTree, title, path = [] }) => {
  const { stdout } = useStdout();
  const { runTask } = useICE();
  const [taskStates, setTaskStates] = useState<Record<string, StateOthers>>({});
  const margin = 10;
  // Calculate the view height (with a minimum height for usability).
  const viewHeight = stdout ? Math.max(stdout.rows - margin, 5) : 10;
  const [scrollOffset, setScrollOffset] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Flatten the entire task tree.
  const flattenedTasks = useMemo(
    () => flattenTaskTree(taskTree, path, 0),
    [taskTree, path]
  );

  // Handle arrow key input to update the selected index and adjust scrolling.
  useInput((_, key) => {
    if (key.downArrow) {
      if (selectedIndex < flattenedTasks.length - 1) {
        const newIndex = selectedIndex + 1;
        setSelectedIndex(newIndex);
        if (newIndex >= scrollOffset + viewHeight) {
          setScrollOffset(newIndex - viewHeight + 1);
        }
      }
    }
    if (key.upArrow) {
      if (selectedIndex > 0) {
        const newIndex = selectedIndex - 1;
        setSelectedIndex(newIndex);
        if (newIndex < scrollOffset) {
          setScrollOffset(newIndex);
        }
      }
    }
  });

  // Handle key inputs for navigation and running tasks.
  useInput((input, key) => {
    // When the user presses Enter or space, check if the selected item is a task.
    if (key.return || input === " ") {
      const selectedItem = flattenedTasks[selectedIndex];
      const isTask =
        typeof selectedItem.node === "object" &&
        selectedItem.node !== null &&
        "_tag" in selectedItem.node &&
        selectedItem.node._tag === "task";
      if (isTask) {
        const taskKey = selectedItem.key;
        // Avoid re-running if already loading.
        if (taskStates[taskKey] === "loading") return;
        setTaskStates((prevStates) => ({ ...prevStates, [taskKey]: "loading" }));
        (async () => {
          try {
            await runTask(taskKey.split(":"));
            setTaskStates((prevStates) => ({ ...prevStates, [taskKey]: "success" }));
          } catch (e) {
            console.error(e);
            setTaskStates((prevStates) => ({ ...prevStates, [taskKey]: "error" }));
          }
        })();
      }
    }
  });

  // Render each flattened task with indentation according to its depth.
  const renderedTasks = flattenedTasks.map((item, index) => {
    const isTask =
      typeof item.node === "object" &&
      item.node !== null &&
      "_tag" in item.node &&
      item.node._tag === "task";
    const fallbackState = index === selectedIndex ? "selected" : "pending";
    const itemState = isTask ? (taskStates[item.key] ?? fallbackState) : fallbackState;
    return (
      <Box key={item.key} marginLeft={item.depth * 2}>
        <TaskListItem label={item.label} state={itemState} />
      </Box>
    );
  });

  // Only render the visible slice of tasks.
  const visibleElements = renderedTasks.slice(
    scrollOffset,
    scrollOffset + viewHeight
  );
  return <TaskList>{visibleElements}</TaskList>;
};

/**
 * ScrollableTaskTreeList renders a hierarchical task list with scrolling and selection support.
 * Only the top-level tasks are rendered inside a scrollable container.
 *
 * The component computes the available viewport height (using terminal rows)
 * and displays a sliced portion of the task list based on a scroll offset.
 * Arrow up/down keys are used to change the selected task and adjust the scroll offset.
 *
 * @param props.taskTree - The task tree structure (which can contain tasks, scopes, or builders)
 * @param props.title - A title for the task list (for potential use in headers)
 * @param props.path - An optional array representing the current path within the task tree
 * @returns A scrollable list of tasks wrapped in a TaskList container with one selected task.
 */
export const ScrollableTaskTreeList: React.FC<{
  taskTree: TaskTree | Scope | Task;
  title: string;
  path?: string[];
}> = ({ taskTree, title, path = [] }) => {
  const { stdout } = useStdout();
  const margin = 5;
  // Calculate the available view height for tasks
  const viewHeight = stdout ? Math.max(stdout.rows - margin, 5) : 10;
  const [scrollOffset, setScrollOffset] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Build task elements and mark the one at selectedIndex as "selected".
  const taskElements = useMemo(() => {
    const keys =
      taskTree._tag === "scope"
        ? Object.keys(taskTree.children)
        : Object.keys(taskTree);
    return keys
      .map((key, index) => {
        const node =
          taskTree._tag === "scope"
            ? (taskTree as Scope).children[key]
            : (taskTree as TaskTree)[key];
        const fullPath = [...path, key];
        // If this element is the selected one, set a "selected" state.
        const state = index === selectedIndex ? "selected" : "pending";
        if (node._tag === "task") {
          return (
            <TaskListItem
              key={fullPath.join(":")}
              label={fullPath[fullPath.length - 1]}
              state={state}
            />
          );
        }
        if (node._tag === "scope") {
          return (
            <Box key={fullPath.join(":")} flexDirection="column">
              <TaskListItem isExpanded label={fullPath[fullPath.length - 1]} state={state} />
              {/* Render nested tasks as non-scrollable */}
              <Box marginLeft={2}>
                <TaskTreeList
                  taskTree={node.children}
                  title={fullPath.join(":")}
                  path={fullPath}
                />
              </Box>
            </Box>
          );
        }
        return null;
      })
      .filter((element) => element !== null);
  }, [taskTree, path, selectedIndex]);

  // Handle up/down arrow inputs to change selected index and adjust scroll offset.
  useInput((_, key) => {
    if (key.downArrow) {
      if (selectedIndex < taskElements.length - 1) {
        const newSelectedIndex = selectedIndex + 1;
        setSelectedIndex(newSelectedIndex);
        if (newSelectedIndex >= scrollOffset + viewHeight) {
          setScrollOffset(newSelectedIndex - viewHeight + 1);
        }
      }
    }
    if (key.upArrow) {
      if (selectedIndex > 0) {
        const newSelectedIndex = selectedIndex - 1;
        setSelectedIndex(newSelectedIndex);
        if (newSelectedIndex < scrollOffset) {
          setScrollOffset(newSelectedIndex);
        }
      }
    }
  });

  // Only render the portion of the task list that fits in the viewport.
  const visibleElements = taskElements.slice(
    scrollOffset,
    scrollOffset + viewHeight,
  );

  return <TaskList>{visibleElements}</TaskList>;
};

/**
 * TaskTreeList provides a non-scrollable rendering of a task tree.
 * This component is used for nested task rendering inside ScrollableTaskTreeList.
 *
 * @param props.taskTree - The task tree structure
 * @param props.title - A title for the task list
 * @param props.path - An optional array representing the current path within the task tree
 * @returns A list of tasks wrapped in a TaskList container
 */
export const TaskTreeList: React.FC<{
  taskTree: TaskTree | Scope | Task;
  title: string;
  path?: string[];
}> = ({ taskTree, title, path = [] }) => {
  const keys =
    taskTree._tag === "scope" ? Object.keys(taskTree.children) : Object.keys(taskTree);
  return (
    <TaskList>
      {keys.map((key) => {
        const node =
          taskTree._tag === "scope"
            ? (taskTree as Scope).children[key]
            : (taskTree as TaskTree)[key];
        const fullPath = [...path, key];
        if (node._tag === "task") {
          return (
            <TaskListItem
              key={fullPath.join(":")}
              label={fullPath[fullPath.length - 1]}
              state="pending"
            />
          );
        }
        if (node._tag === "scope") {
          return (
            <Box key={fullPath.join(":")} flexDirection="column">
              <TaskListItem isExpanded label={fullPath[fullPath.length - 1]} state="pending" />
              <Box marginLeft={2}>
                <TaskTreeList
                  taskTree={node.children}
                  title={fullPath.join(":")}
                  path={fullPath}
                />
              </Box>
            </Box>
          );
        }
        return null;
      })}
    </TaskList>
  );
};