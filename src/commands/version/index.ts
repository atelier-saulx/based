import { Command } from 'commander'
import { AppContext } from '../../shared/index.js'
import { readJSON } from 'fs-extra/esm'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const version = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const { version } = await readJSON(
    join(fileURLToPath(dirname(import.meta.url)), '../../../package.json'),
  )

  const appName = context.i18n('appName')
  const appCommand = context.i18n('appCommand')
  const appTitle = `<b>${appName}</b> <dim>${version}</dim>`

  context.set('appName', appName)
  context.set('appVersion', version)
  context.set('appTitle', appTitle)
  context.print.info(appName)

  program.name(appCommand).version(version, context.i18n('version.parameter'))
}
