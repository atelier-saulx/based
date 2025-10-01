import { context } from 'esbuild'
import { join } from 'path'
import {
  BasedAuthorizeFunctionConfig,
  BasedFunctionConfig,
  BasedAppFunctionConfig,
} from '@based/functions'
import { Schema } from '@based/schema'
import { find, FindResult } from './fsUtils.js'
import { configsFiles, schemaFiles } from './constants.js'
import { BuildCtx, rebuild, importFromBuild } from './buildUtils.js'
import { BasedOpts } from '@based/client'
import { resolvePlugin } from './plugins.js'

type FnConfig = BasedFunctionConfig | BasedAuthorizeFunctionConfig

export type ParseResult = FindResult & {
  fnConfig: FnConfig
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

const createFunctionContext = (result: FindResult, fnConfig: FnConfig) => {
  // this has to change...
  // need to hash the file before if we wan this
  const checksum = 1 // fnConfig.checksum
  const name = fnConfig.type === 'authorize' ? 'based:authorize' : fnConfig.name
  const banner = `const {setInterval,setTimeout,clearInterval,clearTimeout,console,require}=new _FnGlobals('${name}',${checksum});`
  return context({
    mainFields: ['source', 'module', 'main'],
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
}

const createBrowserContext = (
  result: FindResult,
  fnConfig: BasedAppFunctionConfig,
  publicPath: string,
  opts: BasedOpts,
) => {
  const mainEntry = join(result.dir, fnConfig.main)
  return context({
    mainFields: ['browser', 'source', 'module', 'main'],
    banner: {
      js: `globalThis.basedOpts=${JSON.stringify(opts)};`,
    },
    entryPoints: fnConfig.favicon
      ? [mainEntry, join(result.dir, fnConfig.favicon)]
      : [mainEntry],
    entryNames: '[name]-[hash]',
    publicPath,
    bundle: true,
    write: false,
    outdir: '.',
    plugins: fnConfig.plugins
      ? fnConfig.plugins.concat(resolvePlugin)
      : [resolvePlugin],
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
    metafile: true,
  }).then(rebuild)
}

const createObjectContext = (result: FindResult) => {
  return context({
    entryPoints: [result.path],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    metafile: true,
  }).then(rebuild)
}

export const parseConfig = async (
  result: FindResult,
  publicPath: string,
  opts: BasedOpts,
): Promise<ParseResult> => {
  const configCtx = await createObjectContext(result)
  const fnConfig: FnConfig = importFromBuild(configCtx.build, result.path)
  const indexCtx = await createFunctionContext(result, fnConfig)
  if (fnConfig.type === 'app') {
    const mainCtx = await createBrowserContext(
      result,
      fnConfig,
      publicPath,
      opts,
    )
    return { ...result, fnConfig, configCtx, indexCtx, mainCtx }
  }
  return { ...result, fnConfig, configCtx, indexCtx }
}

export const parseSchema = async (result: FindResult) => {
  const schemaCtx = await createObjectContext(result)
  const schema = {
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
