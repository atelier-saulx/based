import pc from 'picocolors'

const formatter =
  (open, close, replace = open) =>
  (input) => {
    const string = `${input}`
    const index = string.indexOf(close, open.length)
    return ~index
      ? open + replaceClose(string, close, replace, index) + close
      : open + string + close
  }

const replaceClose = (string, close, replace, index) => {
  let result = ''
  let cursor = 0
  do {
    result += string.substring(cursor, index) + replace
    cursor = index + close.length
    index = string.indexOf(close, cursor)
  } while (~index)
  return result + string.substring(cursor)
}

export function colorize(content: string): string
export function colorize(content: string[]): string[]
export function colorize(content: string | string[]): string | string[] {
  if (!content) {
    return ''
  }

  const { isColorSupported, createColors, ...pico } = pc

  const tagFunctions: { [key: string]: (text: string) => string } = {
    ...pico,
    b: pc.bold,
    i: pc.italic,
    grey: pc.gray,
    primary: formatter('\x1b[38;2;75;65;255m', '\x1b[39m'),
    bgPrimary: formatter('\x1b[48;2;75;65;255m', '\x1b[49m'),
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
