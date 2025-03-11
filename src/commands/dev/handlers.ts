import type { BuildFailure, BundleResult } from '@based/bundle'
import type { AppContext } from '../../context/index.js'

export const bundlingErrorHandling =
  (context: AppContext) =>
  (
    errors: BundleResult['error']['errors'] | BuildFailure['errors'],
  ): boolean => {
    if (!errors || !errors.length) {
      return false
    }

    if (errors.length) {
      context.print
        .line()
        .intro(`<red>${context.i18n('methods.bundling.errorDetected')}</red>`)

      for (const error of errors) {
        if (error.location) {
          context.print
            .pipe()
            .log(`<b>${error.text}</b>`, context.state.emojis.error)

          if (error.location.lineText) {
            context.print.pipe().pipe(`"${error.location.lineText}"`).pipe()
          }

          context.print.log(
            context.i18n('methods.bundling.error.file', error.location.file),
            context.state.emojis.error,
          )

          if (error.location.line && error.location.column) {
            context.print.log(
              context.i18n(
                'methods.bundling.error.location',
                error.location.line,
                error.location.column,
              ),
              context.state.emojis.error,
            )
          }

          if (error.pluginName) {
            context.print.log(
              context.i18n('methods.bundling.error.plugin', error.pluginName),
              context.state.emojis.error,
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

    context.print
      .line()
      .intro(context.i18n('methods.bundling.changeDetected'))
      .pipe()

    for (const [type, file] of updates) {
      context.print.log(
        context.i18n(`methods.bundling.types.${type}`, file),
        '<secondary>◆</secondary>',
      )
    }

    return true
  }
