import { readdir } from 'fs/promises'
import { basename, join } from 'path'
import { BuildContext, BuildOptions, BuildResult, context } from 'esbuild'
import { BasedFunctionConfig } from '@based/functions'
import watcher, { type SubscribeCallback } from '@parcel/watcher'
import { Schema } from '@based/schema'

const cwd = process.cwd()
type FindResult = {
  path: string
  file: string
  dir: string
  ext: string
}

const find = async (
  targets: Set<string>,
  cb: (res: FindResult) => Promise<any>,
) => {
  const noop = () => {}
  const walk = async (dir: string): Promise<any> => {
    const files = await readdir(dir)
    const results = await Promise.all(
      files.map(async (file) => {
        if (targets.has(file)) {
          const path = join(dir, file)
          return cb({
            file,
            dir,
            path,
            ext: file.substring(file.lastIndexOf('.') + 1),
          })
        }
        return walk(join(dir, file)).catch(noop)
      }),
    )
    console.log({ results })
    return results.flat().filter(Boolean)
  }

  return walk(cwd)
}

type BuildCtx = {
  ctx: BuildContext
  build: BuildResult
}

const rebuild = async (ctx: BuildContext): Promise<BuildCtx> => {
  const build = await ctx.rebuild()
  return { ctx, build }
}

type ParseResult = {
  fnConfig: BasedFunctionConfig
  configCtx: BuildCtx
  indexCtx: BuildCtx
  mainCtx?: BuildCtx
}

type ParseResults = {
  configs: ParseResult[]
  schema: {
    schema: Schema
    schemaCtx: BuildCtx
  }
}

// const evalBuild = (build: BuildResult) =>
//   eval(build.outputFiles[0].text).default
const evalBuild = async (build: BuildResult) =>
  (
    await import(
      `data:text/javascript;base64,${Buffer.from(build.outputFiles[0].text).toString('base64')}`
    )
  ).default

const configsFiles = new Set([
  'based.config.json',
  'based.config.ts',
  'based.config.js',
])
const schemaFiles = new Set([
  'based.schema.json',
  'based.schema.ts',
  'based.schema.js',
])

const parse = async (result: FindResult) => {
  let schema: {
    schema: Schema
    schemaCtx: BuildCtx
  }
  if (configsFiles.has(result.file)) {
    const [configCtx, indexCtx] = await Promise.all([
      context({
        entryPoints: [result.path],
        bundle: true,
        write: false,
        platform: 'node',
        format: 'esm',
        metafile: true,
      }).then(rebuild),
      context({
        entryPoints: [join(result.dir, 'index.ts')],
        bundle: true,
        write: false,
        platform: 'node',
        format: 'esm',
        metafile: true,
      }).then(rebuild),
    ])

    const fnConfig: BasedFunctionConfig = await evalBuild(configCtx.build)

    if (fnConfig.type === 'app') {
      const mainCtx = await context({
        entryPoints: [join(result.dir, fnConfig.main)],
        bundle: true,
        write: false,
        outdir: '.',
        loader: {
          '.ico': 'file',
          '.eot': 'file',
          '.gif': 'file',
          '.jpeg': 'file',
          '.jpg': 'file',
          '.png': 'file',
          '.svg': 'file',
          '.ttf': 'file',
          '.woff': 'file',
          '.woff2': 'file',
          '.wasm': 'file',
        },
        // plugins: fnConfig.plugins,
        metafile: true,
      }).then(rebuild)

      return { config: { fnConfig, configCtx, indexCtx, mainCtx } }
    }

    return { config: { fnConfig, configCtx, indexCtx } }
  }

  if (schemaFiles.has(result.file)) {
    const schemaCtx = await context({
      entryPoints: [result.path],
      bundle: true,
      write: false,
      platform: 'node',
      metafile: true,
    }).then(rebuild)
    schema = {
      schema: await evalBuild(schemaCtx.build),
      schemaCtx,
    }
    console.log({ schema })
    return { schema }
  }
}

export const parseFolder = async (): Promise<ParseResults> => {
  const { configs, schema } = await find(
    new Set([...configsFiles, ...schemaFiles]),
    async (result: FindResult) => {
      // console.log(await parse(result))
      return parse(result)
    },
  )

  return { configs, schema }
}

export const watch = async ({ configs, schema }: ParseResults) => {
  // const outputs = new Map<string, Map<BuildCtx, ParseResult>>()
  const inputs = new Map<string, Map<BuildCtx, ParseResult>>()
  const buildInputs = (result: ParseResult, buildCtx: BuildCtx) => {
    for (const file in buildCtx.build.metafile.inputs) {
      const path = join(cwd, file)
      let map = inputs.get(path)
      if (!map) {
        map = new Map()
        inputs.set(path, map)
      }
      map.set(buildCtx, result)
    }
  }

  const buildSchemaInputs = (schemaBuild: BuildResult) =>
    schema
      ? new Set<string>(
          Object.keys(schemaBuild.metafile.inputs).map((file) =>
            join(cwd, file),
          ),
        )
      : new Set()

  for (const result of configs) {
    const { indexCtx, configCtx, mainCtx } = result
    buildInputs(result, configCtx)
    buildInputs(result, indexCtx)
    if (mainCtx) {
      buildInputs(result, mainCtx)
    }
  }

  let schemaInputs
  if (schema) {
    schemaInputs = buildSchemaInputs(schema.schemaCtx.build)
  }

  const sub = await watcher.subscribe(cwd, async (err, events) => {
    // A) rebuild relevant stuff √
    // B) check for new functions
    // C) check for removed functions

    // TODO: Put in Promise.all()
    for (const event of events) {
      if (configsFiles.has(basename(event.path))) {
        if (event.type === 'delete') {
          // remove fn
        } else if (event.type === 'create') {
          // add fn
        }
      }

      const fnInputs = inputs.get(event.path)
      if (fnInputs) {
        for (const [buildCtx, result] of fnInputs) {
          const prevInputs = buildCtx.build.metafile.inputs
          buildCtx.build = await buildCtx.ctx.rebuild()
          const currInputs = buildCtx.build.metafile.inputs
          for (const file in currInputs) {
            if (!(file in prevInputs)) {
              fnInputs.set(buildCtx, result)
            }
          }
          for (const file in prevInputs) {
            if (!(file in currInputs)) {
              fnInputs.delete(buildCtx)
            }
          }
          if (buildCtx === result.configCtx) {
            result.fnConfig = await evalBuild(buildCtx.build)
          }
        }
      }

      if (schema && schemaInputs.has(event.path)) {
        schema.schemaCtx.build = await schema.schemaCtx.ctx.rebuild()
        schema.schema = await evalBuild(schema.schemaCtx.build)
        schemaInputs = buildSchemaInputs(schema.schemaCtx.build)
      }
    }
  })
}

// const init = async () => {
//   const results = await parse()
//   watch(results)
// }
//
// init()
