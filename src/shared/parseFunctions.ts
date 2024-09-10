import { join } from 'node:path'
import { bundle, BundleResult } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'
import { isIndexFile } from './checkFileType.js'
import { getTargets } from './getTargets.js'
import pc from 'picocolors'
import { readdir } from 'node:fs/promises'
import { parseSchema } from './parseSchema.js'
import fg from 'fast-glob'
import { buildFunctions } from './buildFunctions.js'
import { invalidate } from './invalidate.js'
import { rel, abs } from './index.js'

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
    const err = `No ${functions ? 'matching ' : ''}function configs found`
    console.info(pc.yellow(err))
    throw new Error(err)
  }

  // handle schema
  if (schema) {
    const schemaPayload = parseSchema(configBundles, schema)
    console.info(
      `📖 ${pc.blue('schema')} ${schemaPayload.map(({ db = 'default' }) => db).join(', ')} ${pc.dim(rel(schema))}`,
    )
  }

  // log matching configs and find function indexes
  await Promise.all(
    configs.map(async (item) => {
      const { config, path } = item
      const access = config.public ? pc.cyan('public') : pc.red('private')
      const type = pc.magenta(config.type || 'function')
      const name = config.name
      const file = pc.dim(rel(path))
      console.info(`⚒️ ${type} ${name} ${pc.italic(access)} ${file}`)

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
        console.info(pc.red(`‼️ Found multiple configs for "${config.name}"`))
        return true
      }

      paths[config.name] = path

      if (!index) {
        console.info(
          pc.red(
            `‼️ Could not find "index.ts" or "index.js" for: "${config.name}"`,
          ),
        )
        return true
      }

      if (config.type === 'app') {
        if (!config.main) {
          console.info(
            pc.red(
              `‼️ No "main" field defined for "${config.name}" of type "app"`,
            ),
          )
          return true
        }

        // if (!('bundle' in config) || config.bundle) {
        configStore.app = abs(config.main, dir)
        browserEntryPoints.push(configStore.app)

        if (config.favicon) {
          configStore.favicon = abs(config.favicon, dir)
          browserEntryPoints.push(configStore.favicon)
          favicons.add(rel(configStore.favicon))
        }
        // }
      }

      if (config.files) {
        const matched = await glob(config.files, { cwd: dir })
        const outsideRootFile = matched.find((file) => file.startsWith('../'))

        if (outsideRootFile) {
          console.info(
            pc.red(
              `‼️ Invalid "fields" defined for "${config.name}" - ${outsideRootFile} is not in ${dir}`,
            ),
          )
          return true
        }

        if (!matched.length) {
          console.info(
            pc.red(
              `‼️ Invalid "fields" defined for "${config.name}" - no files matched`,
            ),
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
    throw new Error(`❌ Build failed`)
  }

  // build the functions
  const [nodeBundles, browserBundles] = await buildFunctions({
    publicPath,
    nodeEntryPoints,
    browserEntryPoints,
    cb: onChange,
  })

  return { schema, configs, favicons, nodeBundles, browserBundles, files }
}
