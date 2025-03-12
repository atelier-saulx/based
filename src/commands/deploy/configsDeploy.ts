import type { BundleResult } from '@based/bundle'
import { hash } from '@saulx/hash'
import type { AppContext } from '../../context/index.js'
import { isConfigFile } from '../../shared/pathAndFiles.js'
import { queuedFnDeploy } from './queues.js'

export const configsDeploy = async (
  context: AppContext,
  functions: Based.Deploy.Functions[],
  nodeBundles: BundleResult,
  browserBundles: BundleResult,
  outputs: BundleResult['result']['metafile']['outputs'],
  forceReload: number | boolean,
  assetsMap: Record<string, string>,
  configsMap: Record<string, number>,
): Promise<{ deploys: Based.Deploy.FunctionsToDeploy[]; logs: string[] }> => {
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

    if (configsMap[path] !== checksum) {
      result.push({ checksum, config, js, sourcemap, path })
    }
  }

  if (result.length) {
    const basedClient = await context.getBasedClient()

    let deploying = 0
    let url = basedClient
      .get('project')
      .connection?.ws.url.replace('ws://', 'http://')
      .replace('wss://', 'https://')

    url = url.substring(0, url.lastIndexOf('/'))

    context.spinner.start(
      context.i18n('commands.deploy.methods.deploying') +
        context.i18n(
          'commands.deploy.methods.function',
          deploying.toString(),
          result.length,
        ),
    )

    const logs = await Promise.all(
      result.map(async ({ checksum, config, js, sourcemap, path }) => {
        await queuedFnDeploy(
          context,
          basedClient.get('project'),
          checksum,
          config,
          js,
          sourcemap,
        )

        configsMap[path] = checksum

        context.spinner.message =
          context.i18n('commands.deploy.methods.deploying') +
          context.i18n(
            'commands.deploy.methods.function',
            ++deploying,
            result.length,
          )

        const { finalPath = `/${config.name}`, public: isPublic } = config

        if (isPublic) {
          return `<dim>${url}</dim>${finalPath}`
        }
      }),
    )

    context.print.success(
      context.i18n('commands.deploy.methods.deployed') +
        context.i18n(
          'commands.deploy.methods.function',
          result.length,
          result.length,
        ),
    )

    return { deploys: result, logs }
  }
}
