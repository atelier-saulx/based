export type LogStack = {
  message: string
  functionName?: string
  path?: string
  line?: number
  column?: number
  parseFail?: boolean
}

export const parseStack = (error: Error | string): LogStack => {
  const re = /(.*?)\s{3,}at (.*?) \((.*?):(\d+):(\d+)\)/s
  const match = re.exec(String(error))
  if (!match) {
    return {
      message: String(error),
      parseFail: true,
    }
  }
  return {
    message: match[1],
    functionName: match[2],
    path: match[3],
    line: Number(match[4]),
    column: Number(match[5]),
  }
}
