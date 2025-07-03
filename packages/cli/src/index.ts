import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { devCmd } from './commands/dev/cmd.js'

export const program = new Command()

export const { version } = JSON.parse(
  readFileSync(
    join(fileURLToPath(dirname(import.meta.url)), '../package.json'),
    'utf8',
  ),
)
program.version(version)
program.configureHelp({ showGlobalOptions: true })

program.option(
  '--non-interactive',
  'Run non interactively. Defaults will be used where possible.',
  !process.stdout.isTTY,
)

devCmd(program)

program.parse()
