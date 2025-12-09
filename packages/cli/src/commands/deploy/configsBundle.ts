import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readJSON } from 'fs-extra/esm'
import type { AppContext } from '../../context/index.js'
import {
  isConfigFile,
  isIndexFile,
  isInfraFile,
  isSchemaFile,
} from '../../shared/index.js'
import { configsInvalidateCode } from './configsInvalidateCode.js'
import { bundle } from '../../bundle/index.js'

export const configsBundle = async (
  context: AppContext,
  filter: string[] = [],
  entryPoints: string[] = [],
  mapping: Record<string, Based.Deploy.Configs> = {},
): Promise<Based.Deploy.Configs[]> => {
  const bundled = await bundle({
    entryPoints,
  })

  const paths: Record<string, string> = {}

  let result = await Promise.all(
    Object.entries(bundled.result.metafile.outputs).map(
      async ([key, value]) => {
        let config = {} as Based.Deploy.ConfigsBase
        let type = '' as Based.Deploy.Configs['type']

        if (value.entryPoint.endsWith('.json')) {
          config = await readJSON(value.entryPoint)
        } else {
          const compiled = bundled.require(value.entryPoint)
          config = compiled.default || compiled
        }

        const path: string = join(process.cwd(), value.entryPoint)

        if (isConfigFile(path)) {
          config.name =
            config.type === ('authorize' as Based.Deploy.ConfigsBase['type'])
              ? 'authorize'
              : config.name

          type = 'config'
        } else if (isSchemaFile(path)) {
          type = 'schema'
        } else if (isInfraFile(path)) {
          type = 'infra'
        }

        return {
          config,
          type,
          dir: dirname(path),
          rel: value.entryPoint,
          path,
          bundled: key,
          checksum: 0,
        }
      },
    ),
  )

  if (filter.length) {
    result = await Promise.all(
      result.filter(({ config, path }) => {
        if (filter.length && filter.includes(config.name)) {
          return true
        }

        delete mapping[path]
        return false
      }),
    )
  }

  result = (await Promise.all(
    result
      .map(async ({ dir, path, config, rel, type, bundled }) => {
        let index: string = ''
        const files = await readdir(dir).catch(() => [])

        for (const file of files) {
          if (isIndexFile(file)) {
            index = join(dir, file)

            break
          }
        }

        if (type === 'config') {
          if (!index) {
            context.print.warning(
              context.i18n('methods.bundling.noIndex', config.name),
            )

            return false
          }

          const invalidate = await configsInvalidateCode(context, {
            index,
            config,
          } as Based.Deploy.Configs)

          if (!invalidate) {
            return invalidate
          }
        }

        if (config.name) {
          const existingPath = paths[config.name]

          if (existingPath) {
            context.print.warning(
              context.i18n('methods.bundling.multipleConfig', config.name, rel),
            )

            return false
          }

          paths[config.name] = path
        }

        if (config.type === 'app') {
          if (!config.main) {
            context.print.warning(
              context.i18n('methods.bundling.noMainTypeApp', config.name),
            )

            return false
          }
        }

        const result: any = {
          dir,
          type,
          path,
          index,
          config,
          rel,
          bundled,
          checksum: 0,
        }

        if (mapping[path]) {
          mapping[path] = result

          if (result.index) {
            mapping[result.index] = result
          }

          if (result.config.type === 'app') {
            mapping[join(result.dir, result.config.main)] = result
          }
        }

        return result
      })
      .filter(Boolean),
  )) as Based.Deploy.Configs[]

  return result
}
