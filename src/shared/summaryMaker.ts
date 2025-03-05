import type { AppContext } from '../context/index.js'

export const summaryMaker = async (context: AppContext, summary: string[]) => {
  const { skip } = context.getGlobalOptions()
  if (!summary || !Array.isArray(summary) || !summary.length) {
    return false
  }

  for (const [index, element] of summary.entries()) {
    if (!index) {
      context.print.intro(element).pipe()

      continue
    }
    context.print.log(element, true)
  }

  if (!skip) {
    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      throw context.i18n('methods.aborted')
    }
  }

  return true
}
