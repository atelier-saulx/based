import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'
import { BundleResult } from './BundleResult.js'
import { fileLoaders } from './fileLoaders.js'
import { htmlPlugin } from './htmlPlugin.js'
import { importMetaURLPlugin } from './importMetaURLPlugin.js'
import { resolvePlugin } from './resolvePlugin.js'
import { ssrPlugin } from './ssrPlugin.js'
import { wasmPlugin } from './wasmPlugin.js'
import {
  build,
  type BuildFailure,
  type BuildOptions,
  type OutputFile,
  type Plugin,
} from 'esbuild'

type BasedBundleOptions = BuildOptions & {
  entryPoints: string[]
  debug?: boolean
}

const MAINFIELDS = ['source', 'module', 'main']

export const bundle = async (
  opts: BasedBundleOptions,
  cb?: (err: BuildFailure | null, res: BundleResult) => void,
): Promise<BundleResult> => {
  const platformBrowser = opts.platform === 'browser'
  const optsPlugins = opts.plugins || []

  if (platformBrowser) {
    optsPlugins.push(nodeModulesPolyfillPlugin())
  }

  const plugins = [
    resolvePlugin,
    importMetaURLPlugin,
    ssrPlugin,
    htmlPlugin,
    wasmPlugin,
    ...optsPlugins,
  ]

  const mainFields = platformBrowser ? ['browser', ...MAINFIELDS] : MAINFIELDS
  const entryPoints: BuildOptions['entryPoints'] = opts.entryPoints as string[]

  const settings: BuildOptions = {
    mainFields,
    entryNames: '[name]-[hash]',
    outdir: '.',
    bundle: true,
    platform: 'node',
    treeShaking: true,
    minify: true,
    ignoreAnnotations: true,
    logLevel: 'silent',
    ...opts,
    loader: {
      ...fileLoaders,
      ...opts.loader,
    },
    plugins,
    metafile: true,
    write: false,
    entryPoints,
  } as const

  const bundleResult = new BundleResult()

  if (cb) {
    await bundleResult.watch(settings, cb)
  } else {
    bundleResult.result = await build(settings)
  }

  return bundleResult
}

export { OutputFile, type BuildFailure, type Plugin, type BasedBundleOptions }
