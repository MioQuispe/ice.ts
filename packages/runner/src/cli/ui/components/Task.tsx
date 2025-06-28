import spinners from "cli-spinners"
import figures from "figures"
import { Box, Text } from "ink"
import type { FC, ReactElement, ReactNode } from "react"
import { Children, isValidElement, useEffect, useState } from "react"

// const symbols = {
//   arrowRight: "→",
//   tick: "✔",
//   info: "ℹ",
//   warning: "⚠",
//   cross: "✖",
//   squareSmallFilled: "◼",
//   pointer: "❯",
// }

// const fallbackSymbols = {
//   arrowRight: "→",
//   tick: "√",
//   info: "i",
//   warning: "‼",
//   cross: "×",
//   squareSmallFilled: "■",
//   pointer: ">",
// }

// Fork of https://github.com/sindresorhus/figures
// const figures = isUnicodeSupported() ? symbols : fallbackSymbols

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

const Icon = ({
  state,
  isExpanded,
}: {
  state: StateOthers
  isExpanded: boolean
}) => {
  if (isExpanded) {
    return (
      <Text color={state === "error" ? "red" : "yellow"}>
        {figures.pointer}
      </Text>
    )
  }
  if (state === "loading") {
    return (
      <Text color="yellow">
        <RenderSpinner spinner={spinners.dots} />
      </Text>
    )
  }
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
    return <Text color="gray">{figures.circle}</Text>
  }

  if (state === "selected") {
    return <Text color="blue">{figures.circleFilled}</Text>
  }

  return " "
}

type BaseProps = {
  label: string
  status?: string
  output?: string
  isExpanded?: boolean
  children?: ReactElement | ReactElement[]
}

export const TaskListItem: FC<
  BaseProps & {
    state?: StateOthers
  }
> = ({ label, state = "pending", status, output, isExpanded = false, children }) => {
  const childrenArray = Children.toArray(children)
  const listChildren = childrenArray.filter((node) => isValidElement(node))

  return (
    <Box flexDirection="column">
      <Box>
        <Box marginRight={1}>
          <Text>
            <Icon state={state} isExpanded={isExpanded} />
          </Text>
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
