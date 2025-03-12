import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { bundle } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'
import type { AppContext } from '../../context/index.js'
import { isConfigFile, isIndexFile } from '../../shared/index.js'
import { configsInvalidateCode } from './configsInvalidateCode.js'

export const configsBundle = async (
  context: AppContext,
  filter: string[],
  configs: Based.Deploy.FunctionsFiles[],
  entryPoints: string[],
): Promise<Based.Deploy.Functions[]> => {
  const bundled = await bundle({
    entryPoints,
    debug: false,
  })

  let configsResolved: Based.Deploy.Functions[] = await Promise.all(
    configs.map(async ([dir, _, path]) => {
      let config: Based.Deploy.FunctionBase = {}

      if (path.endsWith('.json')) {
        config = await readJSON(path)
      } else {
        const compiled = bundled.require(path)

        config = compiled.default || compiled
      }

      config.name =
        config.type === ('authorize' as Based.Deploy.FunctionBase['type'])
          ? 'authorize'
          : config.name

      return {
        dir,
        path,
        config,
      }
    }),
  )

  if (filter) {
    const filterFunctions = new Set(filter)
    configsResolved = configsResolved.filter(({ config }) =>
      filterFunctions.has(config.name),
    )
  }

  const paths: Record<string, string> = {}

  configsResolved = (await Promise.all(
    configsResolved
      .map(async ({ dir, path, config }) => {
        let index: string = ''
        const files = await readdir(dir)

        for (const file of files) {
          if (isIndexFile(file)) {
            index = join(dir, file)

            break
          }
        }

        if (isConfigFile(path)) {
          if (!index) {
            context.print.warning(
              context.i18n('methods.bundling.noIndex', config.name),
            )

            return false
          }

          const invalidate = await configsInvalidateCode(
            context,
            index,
            config,
            path,
          )

          if (invalidate) {
            return invalidate
          }
        }

        const existingPath = paths[config.name]

        if (existingPath) {
          context.print.warning(
            context.i18n('methods.bundling.multipleConfig', config.name),
          )

          return false
        }

        paths[config.name] = path

        if (config.type === 'app') {
          if (!config.main) {
            context.print.warning(
              context.i18n('methods.bundling.noMainTypeApp', config.name),
            )

            return false
          }
        }

        return {
          dir,
          path,
          index,
          config,
        }
      })
      .filter(Boolean),
  )) as Based.Deploy.Functions[]

  return configsResolved
}
