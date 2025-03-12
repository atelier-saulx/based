import {
  type BasedBundleOptions,
  type BuildFailure,
  type BundleResult,
  bundle,
} from '@based/bundle'
import type { AppContext } from '../../context/index.js'
import { replaceBasedConfigPlugin } from './replaceBasedConfigPlugin.js'

export const bundleProject = async (
  context: AppContext,
  nodeEntryPoints: string[],
  browserEntryPoints: string[],
  browserEsbuildPlugins: BasedBundleOptions['plugins'],
  onChange: (err: BuildFailure | null, res: BundleResult) => void,
  environment: 'development' | 'production',
  publicPath: string,
  staticPath: string,
  connectToCloud: boolean = false,
) => {
  const isProduction: boolean = environment === 'production'

  context.print
    .line()
    .log(context.i18n('methods.bundling.project'), '<secondary>◆</secondary>')

  const [nodeBundles, browserBundles] = await Promise.all([
    await bundle(
      {
        entryPoints: nodeEntryPoints,
        sourcemap: 'external',
      },
      onChange,
    ),
    await bundle(
      {
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
    nodeBundles,
    browserBundles,
  }
}
