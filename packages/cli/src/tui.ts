import { program } from './index.js'

export const stripAnsi = (text: string) =>
  text.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  )

const formatter =
  (open: string, close: string, replace: string = open) =>
  (input: string) => {
    const string = `${input}`
    const index = string.indexOf(close, open.length)

    return ~index
      ? open + replaceClose(string, close, replace, index) + close
      : open + string + close
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

export const dim = formatter('\u001B[2m', '\u001B[22m')
export const bold = formatter('\u001B[1m', '\u001B[22m')
export const red = formatter('\u001B[31m', '\u001B[39m')
export const bgPrimary = formatter('\x1b[48;2;75;65;255m', '\x1b[49m')

export const printError = (message: string, error?: Error) => {
  console.error(red('! Error: ' + message))
  if (error) {
    console.error(red(error.message))
  }
}

export const printHeader = () => {
  console.info(`\n${bgPrimary(' Based CLI ')} ${program.version()}`)
  const globalOptions = program.optsWithGlobals()
  const envName =
    globalOptions.env === 'production'
      ? red(globalOptions.env)
      : globalOptions.env
  console.info(
    ` ${dim('Cluster:')} ${bold(globalOptions.cluster)} ${dim('Org:')} ${bold(globalOptions.org)} ${dim('Project:')} ${bold(globalOptions.project)} ${dim('Env:')} ${bold(envName)}\n`,
  )
}
