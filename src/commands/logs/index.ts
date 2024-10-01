import { Command } from 'commander'
import { filter } from './filter/index.js'
import { clear } from './clear/index.js'
import { AppContext, externalDateAndTime } from '../../shared/index.js'

export const logs = async (program: Command, context: AppContext) => {
  const cmd: Command = program
    .command('logs [command]')
    .description(
      'Visualize the logs stream about your functions or the cloud infrastructure.',
    )
    .usage('[command]')

  cmd
    .command('filter')
    .option('--monitor', 'To display the logs in a interactive UI.')
    .option(
      '--stream',
      'To display the logs in real time. This option takes precedence over "limit", "before", "after", and "sort" options.',
    )
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
      '--level <level>',
      'Filter by level (available levels: all | info | error).',
      'all',
    )
    .option(
      '-l, --limit <limit>',
      'Limit the number of displayed logs (all: 0, max: 1000)(Limit has no effect when logs are being displayed as a live stream in real-time).',
      '100',
    )
    .option(
      '-s, --sort <sort>',
      'Sort the order of the logs asc/desc (Sorting has no effect when logs are being displayed as a live stream in real-time).',
      'desc',
    )
    .option(
      `-sD, --start-date <${externalDateAndTime.toLowerCase()}>`,
      'The start date and time for filtering logs.',
    )
    .option(
      `-eD, --end-date <${externalDateAndTime.toLowerCase()}>`,
      'The end date and time for filtering logs.',
    )
    .option('-cs, --checksum <cheksum>', 'Filter by checksum.')
    .option('-f, --function <functions...>', 'Filter by function.')
    .option('--service <services...>', 'Filter by service.')
    .option('-m, --machine <machines...>', 'Filter by machine ID.')
    .description('Display all logs')
    .action(filter(program, context))

  cmd
    .command('clear')
    .description('Clear the logs.')
    .action(clear(program, context))
}
