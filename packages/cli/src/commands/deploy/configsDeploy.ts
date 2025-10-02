import type { BundleResult } from '@based/bundle'
import { hash } from '@based/hash'
import type { AppContext } from '../../context/index.js'
import { queuedFnDeploy } from './queues.js'

export const configsDeploy = async (
  context: AppContext,
  found: Based.Deploy.Configs,
  checksumResult: Based.Deploy.FunctionsToDeploy[],
  configsMap: Record<string, number>,
): Promise<{ deploys: Based.Deploy.FunctionsToDeploy[] }> => {
  const { config } = found

  if (checksumResult?.length) {
    const basedClient = await context.getBasedClient()

    // let deploying = 0
    let url = basedClient
      .get('project')
      .connection?.ws.url.replace('ws://', 'http://')
      .replace('wss://', 'https://')

    url = url.substring(0, url.lastIndexOf('/'))

    // context.spinner.start(
    //   context.i18n('commands.deploy.methods.deploying') +
    //     context.i18n(
    //       'commands.deploy.methods.function',
    //       deploying.toString(),
    //       result.length,
    //     ),
    // )

    const logs = await Promise.all(
      checksumResult.map(async ({ checksum, config, js, sourcemap, path }) => {
        await queuedFnDeploy(
          context,
          basedClient.get('project'),
          checksum,
          config,
          js,
          sourcemap,
        )

        configsMap[path] = checksum

        // context.spinner.message =
        //   context.i18n('commands.deploy.methods.deploying') +
        //   context.i18n(
        //     'commands.deploy.methods.function',
        //     ++deploying,
        //     result.length,
        //   )

        const parsedPath =
          config.path?.length > 1
            ? config.path.slice(0, config.path.indexOf('/:'))
            : config.path

        const {
          finalPath = parsedPath || `/${config.name}`,
          public: isPublic,
        } = config

        if (isPublic) {
          return `<dim>${url}</dim>${finalPath}`
        }
      }),
    )

    context.print.success(
      context.i18n('commands.deploy.methods.deployed') +
        context.i18n(
          'commands.deploy.methods.function',
          checksumResult?.length || '0',
          `${config.name} | ${logs.join(' | ')}`,
        ),
    )

    return { deploys: checksumResult }
  }

  return { deploys: checksumResult }
}

export const configsChecksumCheck = (
  found: Based.Deploy.Configs,
  nodeBundles: BundleResult,
  browserBundles: BundleResult,
  outputs: BundleResult['result']['metafile']['outputs'],
  forceReload: number | boolean,
  assetsMap: Record<string, string>,
  configsMap: Record<string, number>,
): Based.Deploy.FunctionsToDeploy[] => {
  const result: Based.Deploy.FunctionsToDeploy[] = []

  const { index, config, app, favicon, path } = found

  const js = nodeBundles.js(index)
  const sourcemap = nodeBundles.map(index)
  let checksum: number

  if (app) {
    const appJs = browserBundles.js(app)
    const appCss = browserBundles.css(app)
    const appFavicon =
      favicon && outputs[browserBundles.find(favicon)]?.imports[0]

    config.appParams = {
      js: assetsMap[appJs?.path],
      css: assetsMap[appCss?.path],
      favicon: assetsMap[appFavicon?.path],
    }

    const checksumSeed: any[] = [js.text, config.appParams]

    if (forceReload) {
      // const uniqueId =
      //   Date.now().toString(36) + Math.random().toString(36).slice(2)

      checksumSeed.push(Date.now())
    }

    checksum = hash(checksumSeed)
  } else {
    checksum = hash([js.text])
  }

  if (forceReload && app) {
    const seconds = Number.isNaN(forceReload) ? 10e3 : Number(forceReload) * 1e3
    config.appParams.forceReload = Date.now() + seconds
  }

  found.checksum = checksum

  if (configsMap[found.config.name] !== checksum) {
    result.push({ checksum, config, js, sourcemap, path })
  }

  return result
}
