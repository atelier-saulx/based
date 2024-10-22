import { parseMessage } from '../../shared/parseMessage.js'
import { spinner } from '../../shared/spinner.js'

const iconDecider = (icon: boolean | string, defaultValue: string): string => {
  if (icon === true) {
    return defaultValue
  } else if (icon !== '' && icon !== false) {
    return icon
  }

  return ''
}

export const contextPrint = (
  state: Based.Context.State,
): Based.Context.MessageHandler => ({
  loading: (message: string): Based.Context.MessageHandler => {
    if (
      state.display === 'verbose' ||
      state.display === 'info' ||
      state.display === 'success'
    ) {
      spinner.start(parseMessage(message))
    }

    return contextPrint(state)
  },
  stop: (): Based.Context.MessageHandler => {
    spinner.stop()

    return contextPrint(state)
  },
  info: (
    message: string,
    icon: boolean | string = false,
  ): Based.Context.MessageHandler => {
    if (state.display === 'verbose' || state.display === 'info') {
      if (!icon) {
        console.info(parseMessage(message))
        return contextPrint(state)
      }

      spinner.stopAndPersist({
        symbol: iconDecider(icon, state.emojis.info),
        text: parseMessage(message),
      })
    }

    return contextPrint(state)
  },
  success: (
    message?: string,
    icon: boolean | string = false,
  ): Based.Context.MessageHandler => {
    if (state.display === 'verbose' || state.display === 'success') {
      if (!icon) {
        console.info(parseMessage(message))
        return contextPrint(state)
      }

      spinner.stopAndPersist({
        symbol: iconDecider(icon, state.emojis.success),
        text: parseMessage(message),
      })
    }

    return contextPrint(state)
  },
  warning: (
    message: string,
    icon: boolean | string = false,
  ): Based.Context.MessageHandler => {
    if (state.display === 'verbose' || state.display === 'warning') {
      if (!icon) {
        console.info(parseMessage(message))
        return contextPrint(state)
      }

      spinner.stopAndPersist({
        symbol: iconDecider(icon, state.emojis.warning),
        text: parseMessage(message),
      })
    }

    return contextPrint(state)
  },
  fail: (
    message: string,
    icon: boolean | string = false,
    killCode: number = 1,
  ): void => {
    if (state.display === 'verbose' || state.display === 'error') {
      if (!icon) {
        console.info(parseMessage(message))
        process.exit(killCode)
      }

      spinner.stopAndPersist({
        symbol: iconDecider(icon, state.emojis.error),
        text: parseMessage(message),
      })
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

    console.info(parseMessage('<gray>─</gray>').repeat(width))

    return contextPrint(state)
  },
})
