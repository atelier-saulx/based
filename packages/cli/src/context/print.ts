import { colorize } from '../shared/colorize.js'
import { LINE_NEW, SPACER } from '../shared/constants.js'
import type { AppContext } from './AppContext.js'

export const contextPrint = (context: AppContext): Based.Context.Print => {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)
  const originalStderrWrite = process.stderr.write.bind(process.stderr)
  // const originalConsoleLog = console.log
  // const originalConsoleWarn = console.warn
  // const originalConsoleError = console.error
  const global = context.program?.opts()
  const isBasicLog = global?.display !== 'silent' || global?.display !== 'debug'
  // const isDebug = global?.display === 'debug'

  function stdlog(
    chunk: any,
    encoding?: BufferEncoding,
    callback?: (error?: Error | null) => void,
  ): any[] {
    // `colorize` breaks when the message contains html tags :(
    // const str: string = typeof chunk === 'string' ? colorize(chunk) : chunk
    const str: string = chunk

    return [str, encoding, callback]
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

  // const logger =
  //   (icon: string) =>
  //   (...args: any[]): string => {
  //     let log: string = args
  //       .map((arg) => {
  //         if (typeof arg !== 'string' && typeof arg !== 'number' && arg) {
  //           const log = JSON.stringify(arg, null, 2)

  //           // if (log) {
  //           //   return log
  //           //     .split(LINE_NEW)
  //           //     .map((line, index) => {
  //           //       let startLine: string = ''

  //           //       if (!index) {
  //           //         startLine = LINE_START
  //           //       }

  //           //       return startLine + context.state.emojis.pipe + SPACER + line
  //           //     })
  //           //     .join(LINE_NEW)
  //           // }

  //           return log
  //         }

  //         return arg
  //       })
  //       .join('')

  //     if (!log.length) {
  //       return ''
  //     }

  //     if (IS_VALID_CHAR(log.charCodeAt(0)) || log[0] === '[') {
  //       log = `${icon || context.state.emojis.log}  ${log}`
  //     }

  //     if (isDebug) {
  //       const debug = isDebug ? `${LINE_CLEAR}${LINE_START}[debug] ` : ''
  //       log = debug + log
  //     }

  //     return LINE_CLEAR + LINE_START + log
  //   }

  // console.log = (...args: any[]): void =>
  //   originalConsoleLog(logger(context.state.emojis.log)(...args))
  // console.warn = (...args: any[]): void =>
  //   originalConsoleWarn(
  //     `<yellow>${logger(context.state.emojis.warning)(...args)}</yellow>`,
  //   )
  // console.error = (...args: any[]): void =>
  //   originalConsoleError(
  //     `<red>${logger(context.state.emojis.error)(...args)}</red>`,
  //   )

  return {
    intro: (message) => {
      context.spinner.stop()
      if (isBasicLog && message) {
        console.log()
        console.log(
          colorize([
            context.state.emojis.intro,
            context.state.emojis.line,
            message,
            LINE_NEW,
            context.state.emojis.pipe,
          ]),
        )
      }
      return contextPrint(context)
    },
    outro: (message) => {
      context.spinner.stop()
      if (isBasicLog && message) {
        console.log(
          colorize([
            context.state.emojis.pipe,
            LINE_NEW,
            context.state.emojis.outro,
            context.state.emojis.line,
            message,
          ]),
        )
      }
      return contextPrint(context)
    },
    step: (message) => {
      context.spinner.stop()
      if (isBasicLog && message) {
        console.log(colorize([context.state.emojis.step, SPACER, message]))
      }
      return contextPrint(context)
    },
    pipe: (message) => {
      context.spinner.stop()
      if (isBasicLog) {
        if (message) {
          console.log(colorize([context.state.emojis.pipe, SPACER, message]))
        } else {
          console.log(colorize(context.state.emojis.pipe))
        }
      }
      return contextPrint(context)
    },
    log: (message, icon) => {
      context.spinner.stop()
      if (isBasicLog && message) {
        if (icon === false) {
          console.log(colorize([context.state.emojis.pipe, SPACER, message]))
        } else if (icon && typeof icon === 'string') {
          console.log(colorize([icon, SPACER, message]))
        } else if (icon === null) {
          console.log(colorize(message))
        } else {
          console.log(colorize([context.state.emojis.log, SPACER, message]))
        }
      }
      return contextPrint(context)
    },
    success: (message) => {
      context.spinner.stop()
      if (isBasicLog && message) {
        console.log(colorize([context.state.emojis.success, SPACER, message]))
      }
      return contextPrint(context)
    },
    error: (message) => {
      context.spinner.stop()
      if (isBasicLog && message) {
        console.error(colorize([context.state.emojis.error, SPACER, message]))
      }
      return contextPrint(context)
    },
    warning: (message) => {
      context.spinner.stop()
      if (isBasicLog && message) {
        console.warn(colorize([context.state.emojis.warning, SPACER, message]))
      }
      return contextPrint(context)
    },
    line: () => {
      context.spinner.stop()
      if (isBasicLog) {
        console.log('')
      }
      return contextPrint(context)
    },
    separator: (width = process.stdout.columns) => {
      context.spinner.stop()
      if (isBasicLog) {
        console.log(colorize(`<gray>${'─'.repeat(width)}</gray>`))
      }
      return contextPrint(context)
    },
  }
}
