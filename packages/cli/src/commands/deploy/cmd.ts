import type { Command } from 'commander'
import { deploy } from './index.js'
import { printHeader } from '../../tui.js'
import { getBasedClient } from '../../getBasedClient.js'

export const deployCmd = (program: Command) => {
  program
    .command('deploy')
    .description('deploy functions and schema to the cloud env')
    // .option('-f, --function <functions...>', 'only deploy this function(s) (variadic)')
    // .option('--no-schema', 'don\'t deploy the schema'         )
    // .option('--schema', 'include the schema (default. Use if needed with --function args')
    // .option('--force', 'deploy force deploying the functions even if they don\' appear to have changed')
    .action(async (_options, cmd) => {
      printHeader()
      // const basedClient = await getBasedClient()
      // basedClient.destroy()
      await deploy()
    })
}
