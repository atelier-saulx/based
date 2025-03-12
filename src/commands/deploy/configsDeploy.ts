import type { BundleResult } from '@based/bundle'
import { hash } from '@saulx/hash'
import { isConfigFile } from '../../shared/pathAndFiles.js'

export const configsDeploy = (
  functions: Based.Deploy.Functions[],
  nodeBundles: BundleResult,
  browserBundles: BundleResult,
  outputs: BundleResult['result']['metafile']['outputs'],
  forceReload: number | boolean,
  assetsMap: Record<string, string>,
  functionsMap: Record<string, number>,
): Based.Deploy.FunctionsToDeploy[] => {
  const result: Based.Deploy.FunctionsToDeploy[] = []

  for (const { index, config, app, favicon, path } of functions) {
    if (!isConfigFile(path)) {
      continue
    }

    const js = nodeBundles.js(index)
    const sourcemap = nodeBundles.map(index)
    const appJs = app && browserBundles.js(app)
    let checksum: number

    if (app) {
      const appCss = browserBundles.css(app)
      const appFavicon =
        favicon && outputs[browserBundles.find(favicon)]?.imports[0]

      config.appParams = {
        js: assetsMap[appJs?.path],
        css: assetsMap[appCss?.path],
        favicon: assetsMap[appFavicon?.path],
      }

      const checksumSeed = [
        appJs?.hash,
        appCss?.hash,
        appFavicon?.path,
        js.hash,
        config,
      ]

      if (forceReload) {
        const num = Number(forceReload)
        const seconds = Number.isNaN(num) ? 10e3 : num * 1e3
        config.appParams.forceReload = Date.now() + seconds

        checksumSeed.push(Date.now())
      }

      checksum = hash(checksumSeed)
    } else {
      checksum = hash([js.hash, config])
    }

    if (functionsMap[path] !== checksum) {
      result.push({ checksum, config, js, sourcemap, path })
    }
  }

  return result
}
