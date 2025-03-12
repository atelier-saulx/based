import type { BasedBundleOptions, Plugin } from '@based/bundle'
import type { AppContext } from '../../context/index.js'
import { abs, rel } from '../../shared/index.js'
import { configsBundle } from './configsBundle.js'
import { getBasedFiles } from './getBasedFiles.js'

export const parseConfigs = async (
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
