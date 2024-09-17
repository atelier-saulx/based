import { Command } from 'commander'
import { readJSON } from 'fs-extra/esm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pc from 'picocolors'

type VersionFunction = (program: Command) => Promise<void>

export const version: VersionFunction = async (
  program: Command,
): Promise<void> => {
  const { version } = await readJSON(
    join(fileURLToPath(dirname(import.meta.url)), '../package.json'),
  )

  console.info(`${pc.bold('Based CLI')} ${version}`)

  program.version(version, '-v, --version')
}
