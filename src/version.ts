import { Command } from 'commander'
import { readJSON } from 'fs-extra/esm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pc from 'picocolors'

export const version = async (program: Command) => {
  const { version } = await readJSON(
    join(fileURLToPath(dirname(import.meta.url)), '../package.json'),
  )

  console.info(`${pc.bold('Based CLI')} ${version}`)

  program.version(version, '-v, --version')
}
