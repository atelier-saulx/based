import { Command } from 'commander'
import { filter } from './filter/index.js'
import { clean } from './clean/index.js'
import { AppContext } from '../../shared/index.js'

export const logs = async (program: Command, context: AppContext) => {
  const cmd: Command = program
    .command('logs [command]')
    .description(
      'Visualize the logs stream about your functions or the cloud infrastructure.',
    )
    .usage('[command]')

  cmd
    .command('filter')
    .option(
      '--collapsed',
      'To display the content of the logs collapsed.',
      false,
    )
    .option(
      '--app',
      'To display the content only about your app and your functions.',
    )
    .option(
      '--infra',
      'To display the content only about the infrastructure of your environment.',
    )
    .option(
      '-l, --level <level>',
      'Filter by level (default: all)(available levels: all | info | error).',
      'all',
    )
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
