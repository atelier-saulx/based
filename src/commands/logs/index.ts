import { Command } from 'commander'
import { filter } from './filter/index.js'
import { clean } from './clean/index.js'

export const logs = async (program: Command) => {
  const cmd: Command = program
    .command('logs [command]')
    .description(
      'Visualize logs about your functions or the cloud infrastructure.',
    )
    .usage('[command]')

  cmd
    .command('filter')
    .option('--expanded', 'To show all the the logs expanded.')
    .option('--before <DD/MM/YYYY>', 'Filter by date.')
    .option('--after <DD/MM/YYYY>', 'Filter by date.')
    .option('-f, --functions <functions...>', 'Filter by function.')
    .option('-c, --checksum <cheksum>', 'Filter by checksum.')
    .option('-l, --level <level>', 'Filter by level.')
    .option('-s --service <services...>', 'Filter by service.')
    .description('Display all logs')
    .action(filter(program))

  cmd.command('clean').description('Clean the logs.').action(clean(program))
}
