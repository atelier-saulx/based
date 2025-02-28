import { intro } from '@clack/prompts'
import type { AppContext } from '../context/index.js'
import { colorize } from './index.js'

export const summaryMaker = async (context: AppContext, summary: string[]) => {
  const { skip } = context.getGlobalOptions()
  if (!summary || !Array.isArray(summary) || !summary.length) {
    return false
  }

  for (const [index, element] of summary.entries()) {
    if (!index) {
      intro(colorize(element))
      context.print.pipe()

      continue
    }
    context.print.info(element, true)
  }

  if (!skip) {
    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      throw context.i18n('methods.aborted')
    }
  }

  return true
}
