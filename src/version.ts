import { Command } from 'commander'
import { readJSON } from 'fs-extra/esm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const version = async (program: Command) => {
  const { version } = await readJSON(
    join(fileURLToPath(dirname(import.meta.url)), '../package.json'),
  )
  program.version(version)
}
