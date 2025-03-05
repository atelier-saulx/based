import type { AppContext } from '../context/index.js'
import {
  CONNECTION_TIMEOUT,
  LINE_CLEAR,
  LINE_NEW,
  LINE_START,
  LINE_UP,
  SPACER,
} from '../shared/constants.js'

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

      context.print.pipe()
      context.spinner.isActive = true
      context.spinner.message = ''
      context.spinner.message = message || context.i18n('context.loading')

      let spinnerIndex: number = 0
      context.spinner.intervalID = setInterval(() => {
        console.log(
          LINE_UP,
          LINE_START,
          LINE_CLEAR,
          context.state.emojis.spinner[spinnerIndex],
          SPACER,
          context.spinner.message,
        )

        spinnerIndex = (spinnerIndex + 1) % context.state.emojis.spinner.length
      }, 1e3 / 4)

      context.spinner.timeoutID = setTimeout(() => {
        context.spinner.isActive = false
        return clearInterval(context.spinner.intervalID)
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
      console.log(
        LINE_UP,
        LINE_CLEAR,
        LINE_UP,
        context.spinner.message,
        LINE_NEW,
      )
    },
  }
}
