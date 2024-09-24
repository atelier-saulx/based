import { Command } from 'commander'
import { filter } from './filter/index.js'
import { clean } from './clean/index.js'
import AppContext from '../../shared/AppContext.js'

export const logs = async (program: Command, context: AppContext) => {
  const cmd: Command = program
    .command('logs [command]')
    .description(
      'Visualize logs about your functions or the cloud infrastructure.',
    )
    .usage('[command]')

  cmd
    .command('filter')
    .option(
      '--expanded',
      'To display the full content of the logs (verbose).',
      false,
    )
    .option(
      '-g, --group <group>',
      'Group similar logs (default: name)(available types: name/function/time)',
      'name',
    )
    .option('-l, --level <level>', 'Filter by level.', 'all')
    .option('-b, --before <DD/MM/YYYY>', 'Filter by date.')
    .option('-a, --after <DD/MM/YYYY>', 'Filter by date.')
    .option('-cs, --checksum <cheksum>', 'Filter by checksum.')
    .option('-f, --function <functions...>', 'Filter by function.')
    .option('-s --service <services...>', 'Filter by service.')
    .description('Display all logs')
    .action(filter(program, context))

  cmd
    .command('clean')
    .description('Clean the logs.')
    .action(clean(program, context))
}
