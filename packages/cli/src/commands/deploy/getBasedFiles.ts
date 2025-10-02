import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { AppContext } from '../../context/index.js'
import { gitIgnore } from '../../shared/gitIgnore.js'
import {
  isConfigFile,
  isInfraFile,
  isSchemaFile,
  rel,
} from '../../shared/pathAndFiles.js'

export const getBasedFiles = async (
  context: AppContext,
  options?: {
    schemaOnly?: boolean
    functionsOnly?: boolean
  },
): Promise<Based.Deploy.BasedFiles> => {
  const { ignore, ignoreDir } = await gitIgnore()

  const multipleSchemas: string[] = []
  const multipleInfras: string[] = []
  const entryPoints: string[] = []
  const mapping: Record<string, Based.Deploy.Configs> = {}

  const walk = async (dir = process.cwd()) => {
    const files = await readdir(dir).catch(() => [])

    await Promise.all(
      files.map((file: string) => {
        if (file[0] === '.') {
          return null
        }

        const path = join(dir, file)

        if (!file.includes('.')) {
          if (ignore(relative(ignoreDir, path), file)) {
            return null
          }

          return walk(path)
        }

        if (!options?.schemaOnly && isConfigFile(file)) {
          entryPoints.push(path)
          mapping[path] = {} as Based.Deploy.Configs
        } else if (!options?.functionsOnly && isSchemaFile(file)) {
          entryPoints.push(path)
          mapping[path] = {} as Based.Deploy.Configs
          multipleSchemas.push(file)
        } else if (isInfraFile(file)) {
          entryPoints.push(path)
          mapping[path] = {} as Based.Deploy.Configs
          multipleInfras.push(file)
        }

        return null
      }),
    )
  }

  if (multipleSchemas.length) {
    context.print
      .intro(`<red>${context.i18n('methods.schema.multiple')}</red>`)
      .pipe(context.i18n('methods.schema.multipleDesc'))

    multipleSchemas.map((schema) => context.print.pipe(rel(schema)))

    context.print.outro(context.i18n('methods.schema.remove'))

    throw new Error(context.i18n('methods.aborted'))
  }

  if (multipleInfras.length) {
    context.print
      .intro(`<red>${context.i18n('methods.infra.multiple')}</red>`)
      .pipe(context.i18n('methods.infra.multipleDesc'))

    multipleSchemas.map((schema) => context.print.pipe(rel(schema)))

    context.print.outro(context.i18n('methods.infra.remove'))

    throw new Error(context.i18n('methods.aborted'))
  }

  await walk()

  return { entryPoints, mapping }
}
