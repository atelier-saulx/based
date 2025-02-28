import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Command } from 'commander'
import { readJSON } from 'fs-extra/esm'
import { AppContext } from '../../context/index.js'

export const version = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const { version } = await readJSON(
    join(fileURLToPath(dirname(import.meta.url)), '../../../package.json'),
  )

  const appName = context.i18n('appName')
  const appCommand = context.i18n('appCommand')
  const appTitle = `<reset><b>${appName}</b> <dim>${version}</dim></reset>`

  context.set('appName', appName)
  context.set('appVersion', version)
  context.set('appTitle', appTitle)

  program.name(appCommand).version(version, context.i18n('version.parameter'))
}
