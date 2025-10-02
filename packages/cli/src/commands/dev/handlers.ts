import type { BuildFailure, BundleResult } from '@based/bundle'
import type { AppContext } from '../../context/index.js'
import { rel } from '../../shared/index.js'

export const bundlingErrorHandling =
  (context: AppContext) =>
  (
    errors: BundleResult['error']['errors'] | BuildFailure['errors'],
  ): boolean => {
    if (!errors || !errors.length) {
      return false
    }

    if (errors.length) {
      context.print.intro(
        `<red>${context.i18n('methods.bundling.errorDetected')}</red>`,
      )

      for (const error of errors) {
        if (error.location) {
          context.print.log(`<b>${error.text}</b>`, context.state.emojis.error)

          if (error.location.lineText) {
            context.print.pipe().pipe(`"${error.location.lineText}"`).pipe()
          }

          context.print.pipe(
            context.i18n('methods.bundling.error.file', error.location.file),
          )

          if (error.location.line && error.location.column) {
            context.print.pipe(
              context.i18n(
                'methods.bundling.error.location',
                error.location.line,
                error.location.column,
              ),
            )
          }

          if (error.pluginName) {
            context.print.pipe(
              context.i18n('methods.bundling.error.plugin', error.pluginName),
            )
          }
        }
      }
    }

    return true
  }

export const bundlingUpdateHandling =
  (context: AppContext) =>
  (updates: BundleResult['updates']): boolean => {
    if (!updates || !updates.length) {
      return false
    }

    let intro: boolean = false

    for (const [type, file] of updates) {
      if (type === 'bundled' || file.endsWith('4913') || file.endsWith('~')) {
        continue
      }

      if (!intro) {
        context.print.intro(context.i18n('methods.bundling.changeDetected'))
        intro = true
      }

      context.print.log(
        context.i18n(`methods.bundling.types.${type}`, rel(file)),
        '<secondary>◆</secondary>',
      )
    }

    return true
  }
