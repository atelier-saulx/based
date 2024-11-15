import { intro } from '@clack/prompts'
import type { AppContext } from '../../shared/AppContext.js'
import { colorize } from '../../shared/colorize.js'

const iconDecider = (icon: boolean | string, defaultValue: string): string => {
  if (icon === true) {
    return defaultValue
  }

  if (icon !== '' && icon !== false) {
    return icon
  }

  return ''
}

const logBase =
  (level: keyof Based.Context.State['emojis'], context: AppContext) =>
  (message: string, icon: boolean | string = false) => {
    if (
      context.state.display === 'verbose' ||
      context.state.display === level
    ) {
      if (icon === true) {
        icon = context.state.emojis[level]
      } else if (icon === false) {
        icon = ''
      }

      if (icon !== '') {
        icon = `${icon}  `
      }

      message = `\r${colorize(`${icon}${message}`)}`

      if (context.spinner.isActive) {
        context.spinner.stop(message)
      } else {
        console.info(message)
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
  step: logBase('info', context),
  pipe: (message?: string): Based.Context.Print =>
    logBase('info', context)(message ?? '', context.state.emojis.pipe),
  info: logBase('info', context),
  success: logBase('success', context),
  warning: logBase('warning', context),
  fail: (
    message: string,
    icon: boolean | string = false,
    killCode: number = 1,
  ): void => {
    if (!message) {
      process.exit(killCode ?? 0)
    }

    logBase('error', context)(message, icon)

    process.exit(killCode ?? 0)
  },
  line: (): Based.Context.Print => {
    if (context.state.display === 'silent') {
      return contextPrint(context)
    }

    console.info('')

    return contextPrint(context)
  },
  separator: (width: number = process.stdout.columns): Based.Context.Print => {
    if (context.state.display === 'silent') {
      return contextPrint(context)
    }

    console.info(colorize(`<gray>${'-'.repeat(width)}</gray>`))

    return contextPrint(context)
  },
})
