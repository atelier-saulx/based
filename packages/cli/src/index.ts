import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { devCmd } from './commands/dev/cmd.js'
import { getBasedConfig } from './basedConfig.js'
import { printError } from './tui.js'
import type { BasedOpts } from '@based/client'

export const program = new Command()

export const { version } = JSON.parse(
  readFileSync(
    join(fileURLToPath(dirname(import.meta.url)), '../package.json'),
    'utf8',
  ),
)
program.version(version)
program.configureHelp({ showGlobalOptions: true })

program.option('-c, --cluster <cluster>', 'Cluster name.')
program.option('-o, --org <org>', 'Organization name.')
program.option('-p, --project <project>', 'Organization name.')
program.option('-e, --env <env>', 'Environment name.')
program.option(
  '--non-interactive',
  'Run non interactively. Defaults will be used where possible.',
  !process.stdout.isTTY,
)

devCmd(program)

program.parse()

let basedConfig: BasedOpts
try {
  basedConfig = await getBasedConfig()
  console.log({ basedConfig })
} catch (error) {
  printError('Error parsing based config.', error)
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
