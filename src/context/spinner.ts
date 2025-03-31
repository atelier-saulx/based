import type { AppContext } from '../context/index.js'
import {
  CONNECTION_TIMEOUT,
  LINE_CLEAR,
  LINE_START,
  LINE_UP,
  SPACER,
} from '../shared/constants.js'
import { colorize, colorizerLength } from '../shared/index.js'

export function contextSpinner(context: AppContext): Based.Context.Spinner {
  return {
    isActive: false,
    timeoutID: null,
    intervalID: null,
    message: '',
    start: (message, timeout = CONNECTION_TIMEOUT) => {
      if (context.spinner.isActive) {
        context.spinner.isActive = false
        clearInterval(context.spinner.intervalID)
        clearTimeout(context.spinner.timeoutID)
      }

      console.log('')
      context.spinner.isActive = true
      context.spinner.message = ''
      context.spinner.message = message || context.i18n('context.loading')

      let spinnerIndex: number = 0
      context.spinner.intervalID = setInterval(() => {
        const message =
          context.state.emojis.spinner[spinnerIndex] +
          SPACER +
          context.spinner.message
        const messageLength = colorizerLength(message)
        const terminalLength = process.stdout.columns
        const LINES_UP: string = new Array(
          Math.ceil(messageLength / terminalLength),
        )
          .fill(LINE_UP)
          .join('')

        console.log(colorize([LINES_UP, LINE_CLEAR, LINE_START, message]))

        spinnerIndex = (spinnerIndex + 1) % context.state.emojis.spinner.length
      }, 1e3 / 4)

      context.spinner.timeoutID = setTimeout(() => {
        context.print.error(context.i18n('errors.408'))
        process.exit(408)
      }, timeout)
    },
    stop: (message = '') => {
      if (!context.spinner.isActive) {
        return
      }

      clearInterval(context.spinner.intervalID)
      clearTimeout(context.spinner.timeoutID)

      context.spinner.isActive = false
      context.spinner.message = message
      const messageLength = colorizerLength(context.spinner.message)
      const terminalLength = process.stdout.columns
      const LINES_UP: string[] = new Array(
        Math.ceil(messageLength / terminalLength),
      ).fill(LINE_UP)

      if (message) {
        console.log(
          colorize([
            ...LINES_UP,
            LINE_CLEAR,
            LINE_START,
            context.state.emojis.step,
            SPACER,
            message,
          ]),
        )
      } else {
        console.log(...LINES_UP, LINE_CLEAR, LINE_START)
      }
    },
  }
}
