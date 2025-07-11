import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { devCmd } from './commands/dev/cmd.js'
import { deployCmd } from './commands/deploy/cmd.js'
import { logoutCmd } from './commands/logout/cmd.js'
import { getBasedConfig } from './basedConfig.js'
import { printError } from './tui.js'
import type { BasedOpts } from '@based/client'
import { homedir } from 'node:os'

export const PERSISTENT_STORAGE = resolve(join(homedir(), '.based/cli'))
export const program = new Command()

export const { version } = JSON.parse(
  readFileSync(
    join(fileURLToPath(dirname(import.meta.url)), '../package.json'),
    'utf8',
  ),
)
program.version(version)
program.configureHelp({ showGlobalOptions: true })

program.option('-c, --cluster <cluster>', 'cluster name.')
program.option('-o, --org <org>', 'organization name.')
program.option('-p, --project <project>', 'organization name.')
program.option('-e, --env <env>', 'environment name.')
program.option(
  '--envDiscoveryUrl <envDiscoveryUrl >',
  'url for the env dicovery service',
)
program.option(
  '--platformDiscoveryUrl <platformDiscoveryUrl>',
  'url for the platform dicovery service',
)
program.option(
  '--non-interactive',
  'Run non interactively. Defaults will be used where possible.',
  !process.stdout.isTTY,
)

devCmd(program)
deployCmd(program)
logoutCmd(program)

let basedConfig: BasedOpts
try {
  basedConfig = await getBasedConfig()
} catch (error) {
  printError('Error parsing based config.', error as Error)
  process.exit(1)
}
if (basedConfig) {
  if (!program.getOptionValue('cluster') && basedConfig.cluster) {
    program.setOptionValue('cluster', basedConfig.cluster)
  }
  if (!program.getOptionValue('org') && basedConfig.org) {
    program.setOptionValue('org', basedConfig.org)
  }
  if (!program.getOptionValue('project') && basedConfig.project) {
    program.setOptionValue('project', basedConfig.project)
  }
  if (!program.getOptionValue('env') && basedConfig.env) {
    program.setOptionValue('env', basedConfig.env)
  }
}

program.parse()
