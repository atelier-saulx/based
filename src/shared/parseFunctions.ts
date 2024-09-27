import { join } from 'node:path'
import { bundle, BundleResult } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'
import { readdir } from 'node:fs/promises'
import fg from 'fast-glob'
import {
  rel,
  abs,
  invalidate,
  buildFunctions,
  parseSchema,
  getTargets,
  isIndexFile,
  AppContext,
} from './index.js'

const { glob } = fg

type ParseFunctionsResult = {
  schema: string
  configs: BasedCli.ConfigStore[]
  favicons: Set<string>
  nodeBundles: BundleResult
  browserBundles: BundleResult
  files: Record<string, string>
}

export const parseFunctions = async (
  context: AppContext,
  functions: string[],
  onChange: (err: Error | null, res: BundleResult) => void,
  publicPath: string,
): Promise<ParseFunctionsResult> => {
  let { targets, schema } = await getTargets()

  const configPaths = targets.map(([dir, file]) => join(dir, file))

  // if (!functions) {
  //   schema = null
  // }

  // bundle the configs and schema (if necessary)
  const configBundles = await bundle({
    entryPoints: schema ? [schema, ...configPaths] : configPaths,
  })

  // read configs
  let configs: BasedCli.ConfigStore[] = await Promise.all(
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
    // only include selected functions
    const filter = new Set(functions)
    configs = configs.filter(({ config }) => filter.has(config.name))
  }

  if (!configs.length) {
    throw new Error(
      `<yellow>No ${functions ? 'matching ' : ''}function configs found.</yellow>`,
    )
  }

  // handle schema
  if (schema) {
    const schemaPayload = parseSchema(configBundles, schema)
    context.print.info(
      `<blue>schema</blue> ${schemaPayload.map(({ db = 'default' }) => db).join(', ')} <dim>${rel(schema)}</dim>`,
    )
  }

  // log matching configs and find function indexes
  await Promise.all(
    configs.map(async (item) => {
      const { config, path } = item
      const access = config.public
        ? '<cyan>public</cyan>'
        : '<red>private</red>'
      const type = config.type || 'function'
      const name = config.name
      const file = rel(path)
      context.print.info(
        `⚒️ <magenta>${type}</magenta> ${name} <i>${access}</i> <dim>${file}</dim>`,
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

  // validate and create bundle entryPoints
  const paths: Record<string, string> = {}
  const nodeEntryPoints: string[] = schema ? [schema] : []
  const browserEntryPoints: string[] = []
  const favicons = new Set<string>()
  const files: Record<string, string> = {}
  const invalids = await Promise.all(
    configs.map(async (configStore) => {
      const { config, path, index, dir } = configStore
      const existingPath = paths[config.name]
      if (existingPath) {
        context.print.warning(`Found multiple configs for "${config.name}"`)
        return true
      }

      paths[config.name] = path

      if (!index) {
        context.print.warning(
          `Could not find "index.ts" or "index.js" for: "${config.name}"`,
        )
        return true
      }

      if (config.type === 'app') {
        if (!config.main) {
          context.print.warning(
            `No "main" field defined for "${config.name}" of type "app"`,
          )
          return true
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
            `Invalid "fields" defined for "${config.name}" - ${outsideRootFile} is not in ${dir}`,
          )
          return true
        }

        if (!matched.length) {
          context.print.warning(
            `Invalid "fields" defined for "${config.name}" - no files matched`,
          )
          return true
        }

        for (const file of matched) {
          files[`${config.name}/${file}`] = file
        }
      }

      nodeEntryPoints.push(index)

      return invalidate(index, config)
    }),
  )

  const cancelled = invalids.find(Boolean)

  if (cancelled) {
    throw new Error('<b><red>Build failed.</red></b>')
  }

  try {
    const [nodeBundles, browserBundles] = await buildFunctions({
      publicPath,
      nodeEntryPoints,
      browserEntryPoints,
      cb: onChange,
    })

    return { schema, configs, favicons, nodeBundles, browserBundles, files }
  } catch (error) {
    throw new Error(error)
  }
}
