import chalk from 'chalk'
import { GenericOutput } from '../types'
import { stripAnsi } from './stripAnsi'

export * from './header'
export * from './config'

export const spaces = (amount: number = 2) => ' '.repeat(amount)

export const prefix = chalk.gray('┃ ')
export const prefixNotice = chalk.blue('┃ ')
export const prefixWarn = chalk.yellow('┃ ')
export const prefixError = chalk.red('┃ ')
export const prefixSuccess = chalk.green('┃ ')
export const prefixDanger = chalk.red.bold('! ')
export const prefixInput = chalk.blue('?')
export const prefixDebug = chalk.yellow('¦ ')

export const printEmptyLine = (usePrefix = true, amount: number = 1) => {
  for (let index = 0; index < amount; index++) {
    console.info(usePrefix ? prefix : '')
  }
}

export const printAction = (message: string) => {
  printEmptyLine()
  console.info(prefix + chalk.bold(message))
  printEmptyLine()
}

export const padded = (text: string, size: number, transform?: Function) => {
  if (!text) text = ''
  const transformed = typeof transform === 'function' ? transform(text) : text
  return transformed + ' '.repeat(size - stripAnsi(transformed).length)
}

export const inquirerConfig = {
  transformer: (value: string) => chalk.blue(value),
  prefix: prefixInput,
}

export const printError = (err: Error | string) => {
  let text: string = 'Error:'
  if (typeof err === 'string') {
    text += '\n' + err
  } else {
    text += err.message ? '\n' + err.message : ''
    text += err.stack ? '\n' + err.stack : ''
  }
  const lines = text.split('\n')
  lines.forEach((line) => console.info(prefixDebug + chalk.red(line)))
}

export const printDebug = (value: any) => {
  let lines: string[]

  if (typeof value === 'string') {
    lines = value.split('\n')
  } else {
    lines = JSON.stringify(value, null, 2).split('\n')
  }
  lines.forEach((line: string) => console.info(prefixDebug + line))
}

export const fail = (message: string, output: GenericOutput, options: any) => {
  output.errors = output.errors || []
  output.errors.push({ message })
  if (options.output === 'json') {
    console.info(JSON.stringify(output, null, 2))
  }
  if (options.output === 'fancy') {
    printEmptyLine()
    console.info(prefixError + message)
  }
  process.exit(1)
}
