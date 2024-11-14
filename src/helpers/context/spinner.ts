import { spinner as clack } from '@clack/prompts'
import type { AppContext } from '../../shared/index.js'

const spinner = clack()

export function contextSpinner(context: AppContext): Based.Context.Spinner {
  return {
    isActive: false,
    start: (message = ''): Based.Context.Spinner => {
      if (context.spinner.isActive) {
        spinner.stop()
        context.spinner.isActive = false
      }

      spinner.start(message)
      context.spinner.isActive = true

      return contextSpinner(context)
    },
    stop: (message = ''): Based.Context.Spinner => {
      if (!context.spinner.isActive) {
        return contextSpinner(context)
      }

      spinner.stop(message)
      context.spinner.isActive = false

      return contextSpinner(context)
    },
  }
}
