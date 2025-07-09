import { dirname, join, relative } from 'node:path'
import { readFile, readdir } from 'node:fs/promises'
import { findUp } from 'find-up'
import parser from 'gitignore-parser'
import type { BasedFunctionConfig } from '@based/functions'

type ConfigsBase = BasedFunctionConfig &
  BasedFunctionConfig<'app'> & {
    type: 'authorize' & BasedFunctionConfig['type']
    main: string
    appParams?: {
      js?: string
      css?: string
      favicon?: string
      forceReload?: number
    }
    files?: string[]
    schema?: any
    finalPath?: string
  }
type Configs = {
  config: ConfigsBase
  type: 'config' | 'schema' | 'infra'
  path: string
  dir: string
  rel: string
  index?: string
  app?: string
  favicon?: string
  bundled: string
  checksum: number
  serverFunction?: string
}

export const getEntryPoints = async ({
  includeSchema = true,
  includeFunctions = true,
  includeInfra = true,
} = {}) => {
  const { ignore, ignoreDir } = await gitIgnore()

  const multipleSchemas: string[] = []
  const multipleInfras: string[] = []
  const entryPoints: string[] = []
  const mapping: Record<string, Configs> = {}

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

        if (includeFunctions && isConfigFile(file)) {
          entryPoints.push(path)
          mapping[path] = {} as Configs
        } else if (includeSchema && isSchemaFile(file)) {
          entryPoints.push(path)
          mapping[path] = {} as Configs
          multipleSchemas.push(file)
        } else if (includeInfra && isInfraFile(file)) {
          entryPoints.push(path)
          mapping[path] = {} as Configs
          multipleInfras.push(file)
        }

        return null
      }),
    )
  }

  if (multipleSchemas.length) {
    // context.print
    //   .intro(`<red>${context.i18n('methods.schema.multiple')}</red>`)
    //   .pipe(context.i18n('methods.schema.multipleDesc'))
    //
    // multipleSchemas.map((schema) => context.print.pipe(rel(schema)))
    //
    // context.print.outro(context.i18n('methods.schema.remove'))
    //
    // throw new Error(context.i18n('methods.aborted'))
    throw new Error('Multiple schema files found.')
  }

  if (multipleInfras.length) {
    // context.print
    //   .intro(`<red>${context.i18n('methods.infra.multiple')}</red>`)
    //   .pipe(context.i18n('methods.infra.multipleDesc'))
    //
    // multipleSchemas.map((schema) => context.print.pipe(rel(schema)))
    //
    // context.print.outro(context.i18n('methods.infra.remove'))
    //
    // throw new Error(context.i18n('methods.aborted'))
    throw new Error('Multiple infra files found.')
  }

  await walk()

  return entryPoints
}

const gitIgnore = async () => {
  const ignorePath = await findUp('.gitignore')
  let ignoreDir: string = ''

  let ignore: (path: string, _file: string) => boolean = (
    _path: string,
    file: string,
  ) => file === 'node_modules'

  if (ignorePath) {
    ignoreDir = dirname(ignorePath)

    const ignoreFile = ignorePath && (await readFile(ignorePath, 'utf8'))
    const { denies } = ignoreFile && parser.compile(ignoreFile)

    ignore = (path: string, _file: string) => denies(path)
  }

  return { ignore, ignoreDir }
}

export const isSchemaFile = (file: string) =>
  /^based\.schema\.(?:ts|js)$/.test(file)
export const isConfigFile = (file: string) =>
  /^based\.config\.(?:ts|js)$/.test(file)
export const isInfraFile = (file: string) =>
  /^based\.infra\.(?:ts|js)$/.test(file)
