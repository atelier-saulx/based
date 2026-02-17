import type { BundleResult } from '../../bundle/BundleResult.js'
import {
  bundle,
  type BasedBundleOptions,
  type BuildFailure,
} from '../../bundle/index.js'
import type { AppContext } from '../../context/index.js'
import { replaceBasedConfigPlugin } from './replaceBasedConfigPlugin.js'

export const filesBundle = async (
  context: AppContext,
  node: string[],
  browser: string[],
  plugins: BasedBundleOptions['plugins'],
  onChange: (err: BuildFailure | null, res: BundleResult) => void,
  environment: 'development' | 'production',
  staticURL: string,
  wsURL: string,
  connectToCloud: boolean = false,
) => {
  const isProduction: boolean = environment === 'production'

  context.print
    .line()
    .log(context.i18n('methods.bundling.project'), '<secondary>◆</secondary>')

  const [nodeBundles, browserBundles] = await Promise.all([
    await bundle(
      {
        publicPath: staticURL,
        entryPoints: node,
        sourcemap: 'external',
      },
      onChange,
    ),
    await bundle(
      {
        publicPath: staticURL,
        entryPoints: browser,
        sourcemap: true,
        platform: 'browser',
        minify: isProduction,
        bundle: true,
        plugins: [
          replaceBasedConfigPlugin(context)({
            cloud: connectToCloud,
            url: wsURL,
          }),
          ...plugins,
        ],
        define: {
          global: 'window',
          'process.env.NODE_ENV': `"${environment}"`,
        },
        loader: {
          '.node': 'empty',
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
