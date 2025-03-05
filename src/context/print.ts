import { colorize } from '../shared/colorize.js'
import {
  LINE_CLEAR,
  LINE_NEW,
  SPACER,
  isValidChar,
} from '../shared/constants.js'
import type { AppContext } from './AppContext.js'

export const contextPrint = (context: AppContext): Based.Context.Print => {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)
  const originalStderrWrite = process.stderr.write.bind(process.stderr)
  const originalConsoleLog = console.log
  const originalConsoleWarn = console.warn
  const originalConsoleError = console.error
  const global = context.get('globalOptions')
  const isBasicLog = global?.display !== 'silent' || global?.display !== 'debug'

  function stdlog(
    chunk: any,
    encoding?: BufferEncoding,
    callback?: (error?: Error | null) => void,
  ): any[] {
    const str: string =
      typeof chunk === 'string' ? chunk : JSON.stringify(chunk, null, 2)
    const formatted = colorize(str)

    return [formatted, encoding, callback]
  }

  process.stdout.write = ((
    chunk: any,
    encoding?: BufferEncoding,
    callback?: (error?: Error | null) => void,
  ): boolean =>
    originalStdoutWrite(
      ...stdlog(chunk, encoding, callback),
    )) as typeof process.stdout.write

  process.stderr.write = ((
    chunk: any,
    encoding?: BufferEncoding,
    callback?: (error?: Error | null) => void,
  ): boolean =>
    originalStderrWrite(
      ...stdlog(chunk, encoding, callback),
    )) as typeof process.stderr.write

  const logger =
    (icon: string) =>
    (...args: any[]): string => {
      let log: string = args
        .map((arg) => {
          if (typeof arg !== 'string') {
            return JSON.stringify(arg, null, 2)
          }

          return arg
        })
        .join('')

      if (!log.length) {
        return ''
      }

      if (isValidChar(log.charCodeAt(0))) {
        log = `${icon || context.state.emojis.log}  ${log}`
      }

      return LINE_CLEAR + log.trimStart().trim()
    }

  console.log = (...args: any[]): void =>
    originalConsoleLog(logger(context.state.emojis.log)(...args))
  console.warn = (...args: any[]): void =>
    originalConsoleWarn(
      `<yellow>${logger(context.state.emojis.warning)(...args)}</yellow>`,
    )
  console.error = (...args: any[]): void =>
    originalConsoleError(
      `<red>${logger(context.state.emojis.error)(...args)}</red>`,
    )

  return {
    intro: (message) => {
      context.spinner.stop()
      if (isBasicLog) {
        console.log(
          context.state.emojis.intro,
          context.state.emojis.line,
          message,
        )
      }
      return contextPrint(context)
    },
    outro: (message) => {
      context.spinner.stop()
      if (isBasicLog) {
        console.log(
          context.state.emojis.outro,
          context.state.emojis.line,
          message,
        )
      }
      return contextPrint(context)
    },
    step: (message) => {
      context.spinner.stop()
      if (isBasicLog) {
        console.log(context.state.emojis.step, SPACER, message)
      }
      return contextPrint(context)
    },
    pipe: (message) => {
      context.spinner.stop()
      if (isBasicLog) {
        console.log(context.state.emojis.pipe, SPACER, message)
      }
      return contextPrint(context)
    },
    log: (message, icon) => {
      context.spinner.stop()
      if (isBasicLog) {
        if (icon === false) {
          console.log(context.state.emojis.pipe, SPACER, message)
        } else if (icon && typeof icon === 'string') {
          console.log(icon, SPACER, message)
        } else {
          console.log(context.state.emojis.log, SPACER, message)
        }
      }
      return contextPrint(context)
    },
    success: (message) => {
      context.spinner.stop()
      if (isBasicLog) {
        console.log(context.state.emojis.success, SPACER, message)
      }
      return contextPrint(context)
    },
    error: (message) => {
      context.spinner.stop()
      if (isBasicLog) {
        console.error(context.state.emojis.error, SPACER, message)
      }
      return contextPrint(context)
    },
    warning: (message) => {
      context.spinner.stop()
      if (isBasicLog) {
        console.warn(context.state.emojis.error, SPACER, message)
      }
      return contextPrint(context)
    },
    line: () => {
      context.spinner.stop()
      if (isBasicLog) {
        console.log(LINE_NEW)
      }
      return contextPrint(context)
    },
    separator: (width = process.stdout.columns) => {
      context.spinner.stop()
      if (isBasicLog) {
        console.log(`<gray>${'─'.repeat(width)}</gray>`)
      }
      return contextPrint(context)
    },
  }
}
