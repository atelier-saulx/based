import { join } from 'node:path'
import type { AppContext } from '../../context/index.js'
import { abs, rel as relative, stringMaxLength } from '../../shared/index.js'
import type { BasedBundleOptions } from '../../bundle/index.js'

export const configsParse = async (
  context: AppContext,
  configs: Based.Deploy.Configs[] = [],
  entryPoints: string[] = [],
  mapping: Record<string, Based.Deploy.Configs> = {},
): Promise<Based.Deploy.EsbuildEntrypoints> => {
  context.print.intro(context.i18n('methods.bundling.loadingConfigs'))

  if (!configs.length) {
    context.print.error(context.i18n('methods.bundling.noConfigs'))

    throw new Error(context.i18n('methods.aborted'))
  }

  const configsNames: string[] = configs
    .map(({ config }) => config?.name)
    .filter(Boolean)

  const configsNamesLength = stringMaxLength(configsNames)

  await Promise.all(
    configs.map(async ({ config, type, rel }) => {
      let icon: string = ''
      let layout: string = ''
      const pipe: string = '<dim>|</dim>'
      const fileLabel: string = `<dim>${rel}</dim>`

      if (type === 'config') {
        const accessLabel: string = config.public
          ? `<secondary>${'public'.padEnd(7)}</secondary>`
          : `<secondary>${'private'.padEnd(7)}</secondary>`
        const type: string = config.type || 'function'
        const name: string = config.name
        const nameLabel: string = `<b>${name.padEnd(configsNamesLength)}</b>`
        const typeLabel: string = `<dim><secondary>${type.padEnd(9)}</secondary></dim>`

        layout = `${nameLabel} ${pipe} ${accessLabel} ${pipe} ${typeLabel} ${pipe} ${fileLabel}`
        icon = '<secondary>◆</secondary>'
      } else if (type === 'schema') {
        layout = `<b>schema</b> ${pipe} <blueBright>default</blueBright> ${pipe} ${fileLabel}`
        icon = '<blueBright>◆</blueBright>'
      } else if (type === 'infra') {
        layout = `<b>infra</b> ${pipe} <red>unavailable</red> ${pipe} ${fileLabel}`
        icon = '<cyan>◆</cyan>'
      }

      context.print.log(layout, icon)
    }),
  )

  const node: string[] = entryPoints
  const browser: string[] = []
  const plugins: BasedBundleOptions['plugins'] = []
  const favicons = new Set<string>()

  configs = await Promise.all(
    configs.map(
      async ({
        config,
        dir,
        index,
        app,
        favicon,
        bundled,
        path,
        rel,
        type,
        checksum,
      }) => {
        if (config?.type === 'app') {
          if (config?.plugins) {
            plugins.push(...(config.plugins as any[]))
          }

          if (config?.main) {
            app = abs(config.main, dir)
            browser.push(app)
          }

          if (config?.favicon) {
            favicon = abs(config.favicon, dir)

            browser.push(favicon)
            favicons.add(relative(favicon))
          }
        }

        if (index) {
          node.push(index)
        }

        const result = {
          dir,
          type,
          path,
          index,
          config,
          rel,
          bundled,
          checksum,
          app,
          favicon,
        }

        if (mapping[path]) {
          mapping[path] = result
          if (result.index) {
            mapping[result.index] = result
          }

          if (result?.config?.type === 'app') {
            mapping[join(result.dir, result.config.main)] = result
          }
        }

        return result
      },
    ),
  )

  return {
    configs,
    favicons,
    node,
    browser,
    plugins,
  }
}
