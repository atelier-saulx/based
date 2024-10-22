import { Command } from 'commander'
import { init } from './init/index.js'

export const infra = async (program: Command) => {
  const cmd: Command = program
    .command('infra [command]')
    .description('Manage your services running, create and destroy machines.')
    .usage('[command]')

  cmd
    .command('init')
    .option('--path <path>', 'The path to save the file.')
    .option('-n, --name <name>', 'The name of your machine.')
    .option(
      '-d, --description <description>',
      'Give a description to your machine.',
    )
    .option(
      '-do, --domains <domains...>',
      'Your domains to be assigned to the machine.',
    )
    .option('-m, --machine <machine>', 'The size of your machine.', 't3.micro')
    .option(
      '--min <min>',
      'The minimum number of machines that will run your app.',
      '1',
    )
    .option(
      '--max <max>',
      'The maximum number of machines that you want to scale your app.',
      '1',
    )
    .description(
      'To create a very basic infra file in your repo to be used as your infra.',
    )
    .action(init(program))
}
