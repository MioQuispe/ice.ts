import React, { isValidElement, Children, useState, useEffect } from "react"
import type { FC, ReactElement, ReactNode } from "react"
import isUnicodeSupported from "is-unicode-supported"
import { Text, Box } from "ink"
import spinners from "cli-spinners"

const symbols = {
  arrowRight: "→",
  tick: "✔",
  info: "ℹ",
  warning: "⚠",
  cross: "✖",
  squareSmallFilled: "◼",
  pointer: "❯",
}

const fallbackSymbols = {
  arrowRight: "→",
  tick: "√",
  info: "i",
  warning: "‼",
  cross: "×",
  squareSmallFilled: "■",
  pointer: ">",
}

// Fork of https://github.com/sindresorhus/figures
const figures = isUnicodeSupported() ? symbols : fallbackSymbols

export type Spinner = {
  interval: number
  frames: string[]
}

// Fork of https://github.com/vadimdemedes/ink-spinner
const RenderSpinner: FC<{
  spinner: Spinner
}> = ({ spinner }) => {
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((currentFrameIndex) => {
        const isLastFrame = currentFrameIndex === spinner.frames.length - 1
        return isLastFrame ? 0 : currentFrameIndex + 1
      })
    }, spinner.interval)

    return () => {
      clearInterval(timer)
    }
  }, [spinner])

  return <Text>{spinner.frames[frameIndex]}</Text>
}

// export default RenderSpinner;

export type StateOthers =
  | "loading"
  | "pending"
  | "success"
  | "warning"
  | "error"
  | "selected"

const getSymbol = (state: StateOthers) => {
  if (state === "warning") {
    return <Text color="yellow">{figures.warning}</Text>
  }

  if (state === "error") {
    return <Text color="red">{figures.cross}</Text>
  }

  if (state === "success") {
    return <Text color="green">{figures.tick}</Text>
  }

  if (state === "pending") {
    return <Text color="gray">{figures.squareSmallFilled}</Text>
  }

  if (state === "selected") {
    return <Text color="blue">{figures.pointer}</Text>
  }

  return " "
}

const getPointer = (state: StateOthers) => (
  <Text color={state === "error" ? "red" : "yellow"}>{figures.pointer}</Text>
)

type BaseProps = {
  label: string
  status?: string
  output?: string
  isExpanded?: boolean
  children?: ReactElement | ReactElement[]
}

export const Task: FC<
  BaseProps & {
    state?: StateOthers
  }
> = ({ label, state = "pending", status, output, isExpanded, children }) => {
  const childrenArray = Children.toArray(children)
  const listChildren = childrenArray.filter((node) => isValidElement(node))
  let icon =
    state === "loading" ? (
      <Text color="yellow">
        <RenderSpinner spinner={spinners.dots} />
      </Text>
    ) : (
      getSymbol(state)
    )

  if (isExpanded) {
    icon = getPointer(state)
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Box marginRight={1}>
          <Text>{icon}</Text>
        </Box>
        <Text>{label}</Text>
        {status ? (
          <Box marginLeft={1}>
            <Text dimColor>[{status}]</Text>
          </Box>
        ) : undefined}
      </Box>
      {output ? (
        <Box marginLeft={2}>
          <Text color="gray">{`${figures.arrowRight} ${output}`}</Text>
        </Box>
      ) : undefined}
      {isExpanded && listChildren.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {listChildren}
        </Box>
      )}
    </Box>
  )
}

export const TaskList: FC<{
  children: ReactNode | ReactNode[]
}> = ({ children }) => <Box flexDirection="column">{children}</Box>
