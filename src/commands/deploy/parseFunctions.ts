import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type BasedBundleOptions,
  type BuildFailure,
  type BundleResult,
  type Plugin,
  bundle,
} from '@based/bundle'
import fg from 'fast-glob'
import { readJSON } from 'fs-extra/esm'
import type { AppContext } from '../../context/index.js'
import {
  abs,
  getTargets,
  isIndexFile,
  rel,
  stringMaxLength,
} from '../../shared/index.js'
import { invalidateFunctionCode } from './invalidateFunctionCode.js'
import { parseSchema } from './parseSchema.js'
import { replaceBasedConfigPlugin } from './replaceBasedConfigPlugin.js'

const { glob } = fg

export const parseFunctions = async (
  context: AppContext,
  functions: string[],
  onChange: (err: BuildFailure | null, res: BundleResult) => void,
  publicPath: string,
  staticPath: string,
  environment: 'development' | 'production',
  connectToCloud: boolean = false,
): Promise<Based.Deploy.ParsedFunction> => {
  const isProduction: boolean = environment === 'production'
  let { targets, schema: schemaPath } = await getTargets()
  const configPaths = targets.map(([dir, file]) => join(dir, file))
  const { display } = context.getGlobalOptions()

  if (functions) {
    schemaPath = null
  }

  context.print.intro('Loading your functions').pipe()

  let debug: boolean = false

  switch (display) {
    case 'silent':
    case 'log':
      debug = false
      break
    default:
      debug = true
  }

  const configBundles = await bundle({
    entryPoints: schemaPath ? [schemaPath, ...configPaths] : configPaths,
    debug,
  })

  let configs: Based.Deploy.Functions[] = await Promise.all(
    configPaths.map(async (path, index) => {
      const dir = targets[index][0]

      if (path.endsWith('.json')) {
        return { dir, path, config: await readJSON(path) }
      }

      const compiled = configBundles.require(path)

      return { dir, path, config: compiled.default || compiled }
    }),
  )

  if (functions) {
    const filter = new Set(functions)
    configs = configs.filter(({ config }) => filter.has(config.name))
  }

  if (!configs.length) {
    const err = `No ${functions ? 'matching ' : ''}function configs found`
    context.print.warning(err)
    throw new Error(err)
  }

  const functionsNames = configs.map((name) =>
    name.config.type === ('authorize' as Based.Deploy.Function['type'])
      ? 'authorize'
      : name.config.name,
  )

  await Promise.all(
    configs.map(async (item) => {
      const { config, path } = item
      const accessLabel: string = config.public
        ? `<secondary>${'public'.padEnd(7)}</secondary>`
        : `<secondary>${'private'.padEnd(7)}</secondary>`
      const type: string = config.type || 'function'
      const name: string =
        config.type === 'authorize' ? 'authorize' : config.name
      const file: string = rel(path)
      const functionLabel: string = `<b>${name.padEnd(stringMaxLength(functionsNames))}</b>`
      const typeLabel: string = `<dim><secondary>${type.padEnd(9)}</secondary></dim>`
      const pipe: string = '<dim>|</dim>'
      const fileLabel: string = `<dim>${file}</dim>`

      context.print.log(
        `${functionLabel} ${pipe} ${accessLabel} ${pipe} ${typeLabel} ${pipe} ${fileLabel}`,
        '<secondary>◆</secondary>',
      )

      const files = await readdir(item.dir)
      for (const file of files) {
        if (isIndexFile(file)) {
          item.index = join(item.dir, file)
          break
        }
      }
    }),
  )

  let schemaParsed: any
  if (schemaPath) {
    context.print.line().intro('Loading your schema').pipe()

    schemaParsed = parseSchema(configBundles, schemaPath)
    const dbNames = schemaParsed.map(({ db = 'default' }) => db)

    for (const { schema } of schemaParsed) {
      const schemaLabel: string = '<b>schema</b>'
      const pipe: string = '<dim>|</dim>'
      const dbName: string = `<blueBright>${(schema.db || 'default').padEnd(stringMaxLength(dbNames))}</blueBright>`
      const fileLabel: string = `<dim>${rel(schemaPath)}</dim>`

      context.print.log(
        `${schemaLabel} ${pipe} ${dbName} ${pipe} ${fileLabel}`,
        '<blueBright>◆</blueBright>',
      )
    }
  }

  const paths: Record<string, string> = {}
  const nodeEntryPoints: string[] = schemaPath ? [schemaPath] : []
  const functionsEntryPoints: string[] = []
  const browserEntryPoints: string[] = []
  const browserEsbuildPlugins: BasedBundleOptions['plugins'] = []
  const favicons = new Set<string>()
  const files: Record<string, string> = {}
  const invalids = await Promise.all(
    configs.map(async (configStore) => {
      const { config, path, index, dir } = configStore

      const existingPath = paths[config.name]
      if (existingPath) {
        context.print.warning(
          `<red>Found multiple configs for "${config.name}"</red>`,
        )

        return true
      }

      paths[config.name] = path

      if (!index) {
        context.print.warning(
          `<red>Could not find index.ts or index.js for "${config.name}"</red>`,
        )

        return true
      }

      if (config.type === 'app') {
        if (!config.main) {
          context.print.warning(
            `<red>No "main" field defined for "${config.name}" of type "app"</red>`,
          )

          return true
        }

        if (config?.plugins) {
          browserEsbuildPlugins.push(...(config.plugins as Plugin[]))
        }

        configStore.app = abs(config.main, dir)
        browserEntryPoints.push(configStore.app)

        if (config.favicon) {
          configStore.favicon = abs(config.favicon, dir)
          browserEntryPoints.push(configStore.favicon)
          favicons.add(rel(configStore.favicon))
        }
      }

      if (config.files) {
        const matched = await glob(config.files, { cwd: dir })
        const outsideRootFile = matched.find((file) => file.startsWith('../'))

        if (outsideRootFile) {
          context.print.warning(
            `<red>invalid "fields" defined for "${config.name}" - ${outsideRootFile} is not in ${dir}</red>`,
          )

          return true
        }

        if (!matched.length) {
          context.print.log(
            `<red>invalid "fields" defined for "${config.name}" - no files matched</red>`,
          )

          return true
        }

        for (const file of matched) {
          files[`${config.name}/${file}`] = file
        }
      }

      functionsEntryPoints.push(path)
      nodeEntryPoints.push(index)

      return invalidateFunctionCode(context, index, config, path)
    }),
  )

  const cancelled = invalids.find(Boolean)

  if (cancelled) {
    throw context.print.error(context.i18n('methods.aborted'))
  }

  context.print.line().intro(context.i18n('methods.bundling.project')).pipe()

  const introFunctions = async () =>
    context.print.log(
      context.i18n('methods.bundling.functionsLabel', nodeEntryPoints.length),
      '<secondary>◆</secondary>',
    )

  const introAssets = async () => {
    context.print.log(
      context.i18n('methods.bundling.assetsLabel', browserEntryPoints.length),
      '<secondary>◆</secondary>',
    )

    if (browserEsbuildPlugins.length) {
      context.print.log(
        context.i18n(
          'methods.bundling.pluginLabel',
          browserEsbuildPlugins.length,
        ),
        '<secondary>◆</secondary>',
      )
    }
  }

  const [
    _logFunctions,
    _functionsWatcher,
    nodeBundles,
    _logAssets,
    browserBundles,
  ] = await Promise.all([
    await introFunctions(),
    await bundle(
      {
        entryPoints: functionsEntryPoints,
        sourcemap: false,
        bundle: true,
        minify: false,
        debug: false,
      },
      onChange,
    ),
    await bundle(
      {
        entryPoints: nodeEntryPoints,
        sourcemap: 'external',
        debug,
      },
      onChange,
    ),
    await introAssets(),
    await bundle(
      {
        debug,
        publicPath,
        entryPoints: browserEntryPoints,
        sourcemap: true,
        platform: 'browser',
        minify: isProduction,
        bundle: true,
        plugins: [
          replaceBasedConfigPlugin(context)({
            cloud: connectToCloud,
            url: staticPath,
          }),
          ...browserEsbuildPlugins,
        ],
        define: {
          global: 'window',
          'process.env.NODE_ENV': `"${environment}"`,
        },
      },
      onChange,
    ),
  ])

  return {
    schemaPath,
    schemaParsed,
    configs,
    favicons,
    nodeBundles,
    browserBundles,
    files,
  }
}
