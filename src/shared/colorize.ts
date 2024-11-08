import pc from 'picocolors'

export function colorize(content: string): string
export function colorize(content: string[]): string[]
export function colorize(content: string | string[]): string | string[] {
  if (!content) {
    return ''
  }

  const tagFunctions: { [key: string]: (text: string) => string } = {
    b: pc.bold,
    bold: pc.bold,
    i: pc.italic,
    italic: pc.italic,
    red: pc.red,
    yellow: pc.yellow,
    white: pc.white,
    green: pc.green,
    blue: pc.blue,
    magenta: pc.magenta,
    cyan: pc.cyan,
    gray: pc.gray,
    grey: pc.gray,
    dim: pc.dim,
    reset: (text: string) => `\u001b[0m${text}`,
  }

  const tagRegex = /<(\w+?)>(.*?)<\/\1>/gs

  const processTags = (text: string): string => {
    return text.replace(tagRegex, (_, tagName, content) => {
      const transform = tagFunctions[tagName]

      if (transform) {
        return transform(processTags(content))
      }

      return content
    })
  }

  if (Array.isArray(content)) {
    return content.map(processTags) as string[] // Processa cada elemento do array
  }

  return processTags(content) as string // Processa uma string individual
}
