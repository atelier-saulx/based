import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { AppContext } from '../../context/index.js'
import { gitIgnore } from '../../shared/gitIgnore.js'
import { isConfigFile, isSchemaFile, rel } from '../../shared/pathAndFiles.js'

export const getBasedFiles = async (
  context: AppContext,
): Promise<{
  configs: Based.Deploy.FunctionsFiles[]
  entryPoints: string[]
}> => {
  const { ignore, ignoreDir } = await gitIgnore()

  const configs: Based.Deploy.FunctionsFiles[] = []
  const schemas: string[] = []
  let entryPoints: string[] = []

  const walk = async (dir = process.cwd()) => {
    const files = await readdir(dir).catch(() => [])

    await Promise.all(
      files.map((file: string) => {
        if (file[0] === '.') {
          return null
        }

        if (!file.includes('.')) {
          const path = join(dir, file)
          if (ignore(relative(ignoreDir, path), file)) {
            return null
          }

          return walk(join(dir, file))
        }

        if (isConfigFile(file)) {
          configs.push([dir, file, join(dir, file)])
        } else if (isSchemaFile(file)) {
          schemas.push(join(dir, file))
          configs.push([dir, file, join(dir, file)])
        }

        return null
      }),
    )
  }

  if (schemas.length) {
    context.print
      .intro(`<red>${context.i18n('methods.schema.multiple')}</red>`)
      .pipe()
      .pipe(context.i18n('methods.schema.multipleDesc'))

    schemas.map((schema) => context.print.pipe(rel(schema)))

    context.print.outro(context.i18n('methods.schema.remove'))

    throw new Error(context.i18n('methods.aborted'))
  }

  await walk()

  if (configs.length) {
    entryPoints = configs.map(([_, __, path]) => path)
  }

  return { configs, entryPoints }
}
