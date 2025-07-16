import { context } from 'esbuild'
import { join } from 'path'
import { BasedFunctionConfig } from '@based/functions'
import { Schema } from '@based/schema'
import { find, FindResult } from './fsUtils.js'
import { configsFiles, schemaFiles } from './constants.js'
import { BuildCtx, rebuild, evalBuild } from './buildUtils.js'

export type ParseResult = {
  fnConfig: BasedFunctionConfig
  configCtx: BuildCtx
  indexCtx: BuildCtx
  mainCtx?: BuildCtx
}

export type ParseResults = {
  publicPath: string
  configs: ParseResult[]
  schema: {
    schema: Schema
    schemaCtx: BuildCtx
  }
}

export const parseConfig = async (
  result: FindResult,
  publicPath: string,
): Promise<ParseResult> => {
  const configCtx = await context({
    entryPoints: [result.path],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    metafile: true,
  }).then(rebuild)
  const fnConfig: BasedFunctionConfig = await evalBuild(configCtx.build)

  // this has to change...
  // need to hash the file before if we wan this
  const checksum = 1 // fnConfig.checksum

  const banner = `import { createRequire } from "module";const require = createRequire(process.cwd());
    const { setInterval, setTimeout, clearInterval, clearTimeout, console } = new _FnGlobals('${fnConfig.name}',${checksum});
        `

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
  }).then(rebuild)

  if (fnConfig.type === 'app') {
    const mainCtx = await context({
      entryPoints: [join(result.dir, fnConfig.main)],
      entryNames: '[name]-[hash]',
      publicPath,
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
    schema: await evalBuild(schemaCtx.build),
    schemaCtx,
  }
  return schema
}

export const parse = async (
  result: FindResult,
  publicPath: string,
): Promise<
  | { config: ParseResult; schema?: never }
  | { schema: { schema: Schema; schemaCtx: BuildCtx }; config?: never }
> => {
  if (configsFiles.has(result.file)) {
    return { config: await parseConfig(result, publicPath) }
  }

  if (schemaFiles.has(result.file)) {
    return { schema: await parseSchema(result) }
  }
}

export const parseFolder = async ({
  cwd,
  publicPath,
}: {
  cwd: string
  publicPath: string
}): Promise<ParseResults> => {
  const configs = []
  let schema = null
  await find(
    cwd,
    new Set([...configsFiles, ...schemaFiles]),
    async (result: FindResult) => {
      const res = await parse(result, publicPath)
      if (res.schema) {
        schema = res.schema
      } else if (res.config) {
        configs.push(res.config)
      }
    },
  )
  return { configs, schema, publicPath }
}
