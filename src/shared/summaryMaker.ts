import type { AppContext } from '../context/index.js'

export const summaryMaker = async (context: AppContext, summary: string[]) => {
  const { skip } = context.getGlobalOptions()
  if (!summary || !Array.isArray(summary) || !summary.length) {
    return false
  }

  for (const [index, element] of summary.entries()) {
    if (!index) {
      context.print.intro(element)

      continue
    }
    context.print.pipe(element)
  }

  if (!skip) {
    const doIt: boolean = await context.form.boolean()

    if (!doIt) {
      throw new Error(context.i18n('methods.aborted'))
    }
  }

  return true
}
