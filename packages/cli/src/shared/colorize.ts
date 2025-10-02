import pc from 'picocolors'

const tagRegex = /<(\w+?)>(.*?)<\/\1>/gs
const { isColorSupported, createColors, ...pico } = pc

const formatter =
  (open: string, close: string, replace: string = open) =>
  (input: string) => {
    const string = `${input}`
    const index = string.indexOf(close, open.length)

    return ~index
      ? open + replaceClose(string, close, replace, index) + close
      : open + string + close
  }

const tagFunctions: { [key: string]: (text: string) => string } = {
  ...pico,
  b: pc.bold,
  i: pc.italic,
  grey: pc.gray,
  primary: formatter('\x1b[38;2;75;65;255m', '\x1b[39m'),
  bgPrimary: formatter('\x1b[48;2;75;65;255m', '\x1b[49m'),
  secondary: formatter('\x1b[38;2;255;31;133m', '\x1b[39m'),
  bgSecondary: formatter('\x1b[48;2;255;31;133m', '\x1b[49m'),
  reset: (text: string) => `\u001b[0m${text}`,
}

export function colorizerLength(text: string): number {
  return text.replace(tagRegex, (_, __, content) => content).length
}

export function colorize(content: string): string
export function colorize(content: string[]): string[]
export function colorize(content: string | string[]): string | string[] {
  if (!content) return ''

  if (Array.isArray(content)) {
    return content.map(processText).join('')
  }

  return processText(content)
}

function processText(text: string): string {
  const result: string[] = []
  const stack: { tag: string; acc: string[] }[] = []
  let i = 0
  let acc: string[] = []

  while (i < text.length) {
    if (text[i] === '<') {
      const closeBracket = text.indexOf('>', i)
      if (closeBracket === -1) {
        acc.push(text.substring(i))
        break
      }
      const tagContent = text.substring(i + 1, closeBracket)

      if (tagContent[0] === '/') {
        const tagName = tagContent.slice(1)
        const last = stack.pop()

        if (last && last.tag === tagName) {
          const innerText = acc.join('')
          const transformed = transformTag(tagName, innerText)
          acc = last.acc
          acc.push(transformed)
          i = closeBracket + 1

          continue
        }

        acc.push(text.substring(i, closeBracket + 1))
        i = closeBracket + 1

        continue
      }

      if (!tagFunctions[tagContent]) {
        acc.push(text.substring(i, closeBracket + 1))
        i = closeBracket + 1

        continue
      }

      stack.push({ tag: tagContent, acc })
      acc = []
      i = closeBracket + 1

      continue
    }

    acc.push(text[i])
    i++
  }

  result.push(acc.join(''))

  return result.join('')
}

const replaceClose = (
  string: string,
  close: string,
  replace: string,
  index: number,
) => {
  let result = ''
  let cursor = 0

  do {
    result += string.substring(cursor, index) + replace
    cursor = index + close.length
    index = string.indexOf(close, cursor)
  } while (~index)

  return result + string.substring(cursor)
}

function transformTag(tagName: string, content: string): string {
  return tagFunctions[tagName] ? tagFunctions[tagName](content) : content
}
