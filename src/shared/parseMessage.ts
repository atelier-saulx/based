import pc from 'picocolors'

export const parseMessage = (message: string): string => {
  const tagFunctions: { [key: string]: (text: string) => string } = {
    b: pc.bold,
    i: pc.italic,
    red: pc.red,
    yellow: pc.yellow,
    blue: pc.blue,
    magenta: pc.magenta,
    cyan: pc.cyan,
    dim: (text: string) => pc.reset(pc.dim(text)),
    reset: pc.reset,
  }

  const tagRegex = /<(\w+?)>(.*?)<\/\1>/s

  const processTags = (text: string): string => {
    let match: RegExpMatchArray | null

    while ((match = tagRegex.exec(text)) !== null) {
      const [, tagName, content] = match
      const transform = tagFunctions[tagName]

      if (transform) {
        text = text.replace(match[0], transform(processTags(content)))
      }
    }

    return text
  }

  return processTags(message)
}
