import type { BasedBundleOptions, Plugin } from '@based/bundle'
import type { AppContext } from '../../context/index.js'
import { abs, isSchemaFile, rel, stringMaxLength } from '../../shared/index.js'
import { configsBundle } from './configsBundle.js'
import { getBasedFiles } from './getBasedFiles.js'

export const configsParse = async (
  context: AppContext,
  functions: string[],
): Promise<Based.Deploy.ParsedFunction> => {
  context.print.intro(context.i18n('methods.bundling.loadingFunctions')).pipe()

  const basedFiles = await getBasedFiles(context)
  let configs = await configsBundle(
    context,
    functions,
    basedFiles.configs,
    basedFiles.entryPoints,
  )

  if (!configs.length) {
    context.print.error(context.i18n('methods.bundling.noFunctions'))

    throw new Error(context.i18n('methods.aborted'))
  }

  const functionsNames: string[] = configs
    .map(({ config }) => config.name)
    .filter(Boolean)

  await Promise.all(
    configs.map(async ({ config, path }) => {
      if (isSchemaFile(path)) {
        return
      }

      const accessLabel: string = config.public
        ? `<secondary>${'public'.padEnd(7)}</secondary>`
        : `<secondary>${'private'.padEnd(7)}</secondary>`
      const type: string = config.type || 'function'
      const name: string = config.name
      const file: string = rel(path)
      const functionLabel: string = `<b>${name.padEnd(stringMaxLength(functionsNames))}</b>`
      const typeLabel: string = `<dim><secondary>${type.padEnd(9)}</secondary></dim>`
      const pipe: string = '<dim>|</dim>'
      const fileLabel: string = `<dim>${file}</dim>`

      context.print.log(
        `${functionLabel} ${pipe} ${accessLabel} ${pipe} ${typeLabel} ${pipe} ${fileLabel}`,
        '<secondary>◆</secondary>',
      )
    }),
  )

  const nodeEntryPoints: string[] = basedFiles.entryPoints
  const browserEntryPoints: string[] = []
  const browserEsbuildPlugins: BasedBundleOptions['plugins'] = []
  const favicons = new Set<string>()

  configs = await Promise.all(
    configs.map(async ({ config, path, dir, index, app, favicon }) => {
      if (config.type === 'app') {
        if (config?.plugins) {
          browserEsbuildPlugins.push(...(config.plugins as Plugin[]))
        }

        app = abs(config.main, dir)
        browserEntryPoints.push(app)

        if (config.favicon) {
          favicon = abs(config.favicon, dir)

          browserEntryPoints.push(favicon)
          favicons.add(rel(favicon))
        }
      }

      if (index) {
        nodeEntryPoints.push(index)
      }

      return { config, path, dir, index, app, favicon }
    }),
  )

  return {
    configs,
    favicons,
    nodeEntryPoints,
    browserEntryPoints,
    browserEsbuildPlugins,
  }
}
