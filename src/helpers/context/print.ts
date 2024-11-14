import { spinner as clack, intro, log } from '@clack/prompts'
import { colorize } from '../../shared/colorize.js'

const spinner = clack()

const iconDecider = (icon: boolean | string, defaultValue: string): string => {
  if (icon === true) {
    return defaultValue
  }

  if (icon !== '' && icon !== false) {
    return icon
  }

  return ''
}

export const contextPrint = (
  state: Based.Context.State,
): Based.Context.MessageHandler => ({
  intro: (message: string): Based.Context.MessageHandler => {
    intro(colorize(message))

    return contextPrint(state)
  },
  loading: (message: string): Based.Context.MessageHandler => {
    if (
      state.display === 'verbose' ||
      state.display === 'info' ||
      state.display === 'success'
    ) {
      spinner.start(colorize(message))
    }

    return contextPrint(state)
  },
  stop: (): Based.Context.MessageHandler => {
    spinner.stop()

    return contextPrint(state)
  },
  step: (
    message: string,
    icon: boolean | string = false,
  ): Based.Context.MessageHandler => {
    if (state.display === 'verbose' || state.display === 'info') {
      icon = icon ? `${iconDecider(icon, state.emojis.info)}  ` : ''

      log.info(colorize(`\r${icon}${message}`))
    }

    return contextPrint(state)
  },
  info: (
    message: string,
    icon: boolean | string = false,
  ): Based.Context.MessageHandler => {
    if (state.display === 'verbose' || state.display === 'info') {
      icon = icon ? `${iconDecider(icon, state.emojis.info)}  ` : ''

      console.info(colorize(`${icon}${message}`))
    }

    return contextPrint(state)
  },
  success: (
    message?: string,
    icon: boolean | string = false,
  ): Based.Context.MessageHandler => {
    if (state.display === 'verbose' || state.display === 'success') {
      icon = icon ? `${iconDecider(icon, state.emojis.success)}  ` : ''

      spinner.stop(colorize(`\r${icon}${message}`))
    }

    return contextPrint(state)
  },
  warning: (
    message: string,
    icon: boolean | string = false,
  ): Based.Context.MessageHandler => {
    if (state.display === 'verbose' || state.display === 'warning') {
      icon = icon ? `${iconDecider(icon, state.emojis.warning)}  ` : ''

      console.info(colorize(`${icon}${message}`))
    }

    return contextPrint(state)
  },
  fail: (
    message: string,
    icon: boolean | string = false,
    killCode: number = 1,
  ): void => {
    if (state.display === 'verbose' || state.display === 'error') {
      icon = icon ? `${iconDecider(icon, state.emojis.error)} ` : ''

      log.error(`${icon}${colorize(message)}`)
    }

    process.exit(killCode)
  },
  line: (): Based.Context.MessageHandler => {
    if (state.display === 'silent') {
      return contextPrint(state)
    }

    console.info('')

    return contextPrint(state)
  },
  separator: (
    width: number = process.stdout.columns,
  ): Based.Context.MessageHandler => {
    if (state.display === 'silent') {
      return contextPrint(state)
    }

    console.info(colorize(`<gray>${'-'.repeat(width)}</gray>`))

    return contextPrint(state)
  },
})
