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

  context.set('appName', 'Based CLI')
  context.set('appVersion', version)
  context.set('appTitle', `<b>Based CLI</b> <dim>${version}</dim>`)

  context.print.info(context.get('appTitle'))

  program.version(version, '-v, --version')
}
