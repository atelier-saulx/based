import { Command } from 'commander'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import parser from 'gitignore-parser'
import { findUp } from 'find-up'
import { OutputFile, bundle } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'
import pc from 'picocolors'

const isSchemaFile = (file) =>
  file === 'based.schema.js' ||
  file === 'based.schema.json' ||
  file === 'based.schema.ts'

const isConfigFile = (file) =>
  file === 'based.config.js' ||
  file === 'based.config.json' ||
  file === 'based.config.ts'

const isIndexFile = (file) => file === 'index.ts' || file === 'index.js'

const getTargets = async () => {
  const ignorePath = await findUp('.gitignore')
  const ignoreFile = ignorePath && (await readFile(ignorePath, 'utf8'))
  const ignore = ignoreFile && parser.compile(ignoreFile)
  const targets: [dir: string, file: string][] = []
  const deny = ignore
    ? (path: string, _file: string) => ignore.denies(path)
    : (_path: string, file: string) => file === 'node_modules'
  let schema: string

  const walk = async (dir = process.cwd()) => {
    const files = await readdir(dir).catch(() => [])
    await Promise.all(
      files.map((file: string) => {
        if (file[0] === '.') {
          return null
        }
        if (!file.includes('.')) {
          const path = join(dir, file)
          if (deny(relative(dirname(ignorePath), path), file)) {
            return null
          }
          return walk(join(dir, file))
        }
        if (isConfigFile(file)) {
          targets.push([dir, file])
        } else if (isSchemaFile(file)) {
          if (schema) {
            throw new Error(`multiple schema's found, at ${schema} and ${file}`)
          }
          schema = join(dir, file)
        }
        return null
      }),
    )
  }

  await walk()

  return { targets, schema }
}

export const deploy = async (program: Command) => {
  const cmd = program.command('deploy')

  cmd
    .option(
      '-f, --functions <functions...>',
      'function names to deploy (variadic)',
    )
    .action(async ({ functions }: { functions: string[] }) => {
      try {
        const { targets, schema } = await getTargets()
        const configPaths = targets.map(([dir, file]) => join(dir, file))

        // bundle the configs (if necessary)
        const configBundles = await bundle({
          entryPoints: configPaths,
        })

        // read configs
        let configs: {
          config: {
            type: string
            name: string
            public: boolean
            main?: string
          }
          path: string
          dir: string
          index?: string
        }[] = await Promise.all(
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
          console.info(
            pc.yellow(
              `No ${functions ? 'matching ' : ''}function configs found`,
            ),
          )
          return
        }

        // log matching configs and find function indexes
        console.info(pc.green('Function configs:'))
        await Promise.all(
          configs.map(async (item) => {
            const { config, path } = item
            const access = config.public ? pc.cyan('public') + ' ' : ''
            const type = pc.magenta(config.type || 'function')
            const name = config.name
            const file = pc.dim(path)
            console.info(`${type} ${name} ${access}${file}`)

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
        const entryPoints = []

        for (const { config, path, index } of configs) {
          const existingPath = paths[config.name]
          if (existingPath) {
            console.info(
              pc.yellow(
                `Found multiple configs for "${config.name}". Cancelling deploy...`,
              ),
            )
            return
          }
          paths[config.name] = path
          if (!index) {
            console.info(
              pc.yellow(
                `Could not find index.ts or index.js for "${config.name}". Cancelling deploy...`,
              ),
            )
            return
          }

          if (config.type === 'app') {
            if (!config.main) {
              console.info(
                pc.yellow(
                  `No "main" field defined for "${config.name}" of type "app". Cancelling deploy...`,
                ),
              )
              return
            }
            entryPoints.push(config.main)
          }

          entryPoints.push(index)
        }

        // build the functions
        const bundles = await bundle({
          entryPoints,
        })

        const handled = new Set<OutputFile>()
        for (const { index } of configs) {
          const outputFile = bundles.js(index)
        }

        // console.log(result.metafile.outputs)

        // for (const outputFile of result.outputFiles) {

        // }
      } catch (e) {
        console.error(pc.red(e.message))
      }
    })
}
