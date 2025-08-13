import { context } from 'esbuild'
import { join } from 'path'
import {
  BasedAuthorizeFunctionConfig,
  BasedFunctionConfig,
} from '@based/functions'
import { Schema } from '@based/schema'
import { find, FindResult } from './fsUtils.js'
import { configsFiles, schemaFiles } from './constants.js'
import { BuildCtx, rebuild, evalBuild, importFromBuild } from './buildUtils.js'
import { BasedOpts } from '@based/client'

export type ParseResult = {
  fnConfig: BasedFunctionConfig | BasedAuthorizeFunctionConfig
  configCtx: BuildCtx
  indexCtx: BuildCtx
  mainCtx?: BuildCtx
}

export type ParseResults = {
  cwd: string
  publicPath: string
  opts: BasedOpts
  configs: ParseResult[]
  schema: {
    schema: Schema
    schemaCtx: BuildCtx
  }
}

export const parseConfig = async (
  result: FindResult,
  publicPath: string,
  opts: BasedOpts,
): Promise<ParseResult> => {
  const configCtx = await context({
    entryPoints: [result.path],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    metafile: true,
  }).then(rebuild)

  const fnConfig: BasedFunctionConfig | BasedAuthorizeFunctionConfig =
    // await evalBuild(configCtx.build, result.path)
    importFromBuild(configCtx.build, result.path)

  // this has to change...
  // need to hash the file before if we wan this
  const checksum = 1 // fnConfig.checksum
  const name = fnConfig.type === 'authorize' ? 'based:authorize' : fnConfig.name
  const banner = `const {setInterval,setTimeout,clearInterval,clearTimeout,console,require} = new _FnGlobals('${name}',${checksum});`
  const indexCtx = await context({
    banner: {
      js: banner,
    },
    entryPoints: [join(result.dir, 'index.ts')],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    metafile: true,
    treeShaking: true,
  }).then(rebuild)

  if (fnConfig.type === 'app') {
    const mainCtx = await context({
      banner: {
        js: `globalThis.basedOpts=${JSON.stringify(opts)};`,
      },
      entryPoints: [join(result.dir, fnConfig.main)],
      entryNames: '[name]-[hash]',
      publicPath,
      bundle: true,
      write: false,
      outdir: '.',
      plugins: fnConfig.plugins,
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

    return { fnConfig, configCtx, indexCtx, mainCtx }
  }

  return { fnConfig, configCtx, indexCtx }
}

export const parseSchema = async (result: FindResult) => {
  const schemaCtx = await context({
    entryPoints: [result.path],
    bundle: true,
    write: false,
    platform: 'node',
    metafile: true,
    format: 'esm',
  }).then(rebuild)
  const schema = {
    // schema: await evalBuild(schemaCtx.build, result.path),
    schema: importFromBuild(schemaCtx.build, result.path),
    schemaCtx,
  }
  return schema
}

export const parse = async (
  result: FindResult,
  publicPath: string,
  opts: BasedOpts,
): Promise<
  | { config: ParseResult; schema?: never }
  | { schema: { schema: Schema; schemaCtx: BuildCtx }; config?: never }
> => {
  if (configsFiles.has(result.file)) {
    return { config: await parseConfig(result, publicPath, opts) }
  }

  if (schemaFiles.has(result.file)) {
    return { schema: await parseSchema(result) }
  }
}

export const parseFolder = async ({
  opts,
  cwd,
  publicPath,
}: {
  opts: BasedOpts
  cwd: string
  publicPath: string
}): Promise<ParseResults> => {
  const configs = []
  let schema = null
  await find(
    cwd,
    new Set([...configsFiles, ...schemaFiles]),
    async (result: FindResult) => {
      const res = await parse(result, publicPath, opts)
      if (res.schema) {
        schema = res.schema
      } else if (res.config) {
        configs.push(res.config)
      }
    },
  )
  return { configs, schema, publicPath, cwd, opts }
}
