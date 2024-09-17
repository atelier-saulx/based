import { Command } from 'commander'
import { show } from './show/index.js'
import { clean } from './clean/index.js'

export const logs = async (program: Command) => {
  const cmd: Command = program
    .command('logs [command]')
    .description(
      'Visualize logs about your functions or the cloud infrastructure.',
    )
    .usage('[command]')

  cmd
    .command('show')
    .option('--before <DD/MM/YYYY>', 'Filter by date.')
    .option('--after <DD/MM/YYYY>', 'Filter by date.')
    .option('-fn, --functions <functions...>', 'Filter by function.')
    .option('-cs, --checksum <cheksum>', 'Filter by checksum.')
    .option('-l, --level <level>', 'Filter by level.')
    .option('-s --service <services...>', 'Filter by service.')
    .description('Display all logs')
    .action(show(program))

  cmd.command('clean').description('Clean the logs.').action(clean(program))
}
