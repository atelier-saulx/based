import { spinner as clack } from '@clack/prompts'
import { LINE_NEW, LINE_START, LINE_UP } from '../../shared/constants.js'
import { type AppContext, colorize } from '../../shared/index.js'

const spinner = clack()

export function contextSpinner(context: AppContext): Based.Context.Spinner {
  return {
    isActive: false,
    text: (message = ''): Based.Context.Spinner => {
      if (!context.spinner.isActive) {
        spinner.start()
        context.spinner.isActive = true
      }

      spinner.message(colorize(message))
      context.spinner.isActive = true

      return contextSpinner(context)
    },
    start: (message = ''): Based.Context.Spinner => {
      if (context.spinner.isActive) {
        spinner.stop()
        context.spinner.isActive = false
      }

      spinner.start(colorize(message))
      context.spinner.isActive = true

      return contextSpinner(context)
    },
    stop: (message = ''): Based.Context.Spinner => {
      if (!context.spinner.isActive) {
        return contextSpinner(context)
      }

      message = message || '<dim>│</dim>'

      spinner.stop(`${LINE_START}${colorize(message)}`)
      context.spinner.isActive = false

      return contextSpinner(context)
    },
  }
}
