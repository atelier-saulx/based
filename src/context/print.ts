import { intro, outro } from '@clack/prompts'
import { colorize } from '../shared/colorize.js'
import { LINE_NEW, LINE_START, LINE_UP } from '../shared/constants.js'
import type { AppContext } from './AppContext.js'

// const originalStdoutWrite = process.stdout.write.bind(process.stdout)
// const originalStderrWrite = process.stderr.write.bind(process.stderr)

// function formatMessage(message: string): string {
//   const cleanMessage = message.replaceAll(/\r/g, '')
//   return `${cleanMessage}`
// }

// process.stdout.write = ((
//   chunk: any,
//   encoding?: BufferEncoding,
//   callback?: (error?: Error | null) => void,
// ): boolean => {
//   const str: string = typeof chunk === 'string' ? chunk : chunk.toString()
//   const formatted = formatMessage(str)
//   return originalStdoutWrite(formatted, encoding, callback)
// }) as typeof process.stdout.write

// process.stderr.write = ((
//   chunk: any,
//   encoding?: BufferEncoding,
//   callback?: (error?: Error | null) => void,
// ): boolean => {
//   const str: string = typeof chunk === 'string' ? chunk : chunk.toString()
//   const formatted = formatMessage(str)
//   return originalStderrWrite(formatted, encoding, callback)
// }) as typeof process.stderr.write

const logBase =
  (level: keyof Based.Context.State['emojis'], context: AppContext) =>
  (message: string, icon: boolean | string = false) => {
    const { display } = context.getGlobalOptions()

    if (display === 'verbose' || display === level) {
      if (icon === true) {
        icon = context.state.emojis[level]
      } else if (icon === false) {
        icon = ''
      }

      if (icon !== '') {
        icon = `${icon}  `
      }

      message = `${colorize(`${icon}${message}`)}`

      if (context.spinner.isActive) {
        context.spinner.stop(`${message}`)
      } else {
        console.log(message)
      }
    }

    return contextPrint(context)
  }

export const contextPrint = (context: AppContext): Based.Context.Print => ({
  intro: (message: string): Based.Context.Print => {
    if (!message) {
      return contextPrint(context)
    }

    intro(colorize(message))

    return contextPrint(context)
  },
  outro: (message: string): Based.Context.Print => {
    if (!message) {
      return contextPrint(context)
    }

    outro(colorize(message))

    return contextPrint(context)
  },
  step: logBase('info', context),
  pipe: (message?: string): Based.Context.Print =>
    logBase('info', context)(message ?? '', context.state.emojis.pipe),
  info: logBase('info', context),
  success: logBase('info', context),
  warning: logBase('info', context),
  fail: (
    message: string,
    icon: boolean | string = false,
    killCode: number | false = 1,
  ): void => {
    if (message) {
      logBase('info', context)(message, icon)
    }

    if (typeof killCode === 'number') {
      process.exit(killCode ?? 0)
    }
  },
  line: (): Based.Context.Print => {
    const { display } = context.getGlobalOptions()

    if (display === 'silent') {
      return contextPrint(context)
    }

    if (context.spinner.isActive) {
      context.spinner.stop(`${context.state.emojis.pipe}`)

      return contextPrint(context)
    }

    console.info(`${LINE_NEW} `)

    return contextPrint(context)
  },
  separator: (width: number = process.stdout.columns): Based.Context.Print => {
    const { display } = context.getGlobalOptions()

    if (display === 'silent') {
      return contextPrint(context)
    }

    console.info(colorize(`<gray>${'-'.repeat(width)}</gray>`))

    return contextPrint(context)
  },
})
