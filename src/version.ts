import { Command } from 'commander'
import { readJSON } from 'fs-extra/esm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { AppContext } from './shared/index.js'

export const version = async (
  program: Command,
  context: AppContext,
): Promise<void> => {
  const { version } = await readJSON(
    join(fileURLToPath(dirname(import.meta.url)), '../package.json'),
  )

  context.print.info(`<b>Based CLI</b> <dim>${version}</dim>`)

  program.version(version, '-v, --version')
}
