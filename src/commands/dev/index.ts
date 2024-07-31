import { Command } from 'commander'

export const deploy = async (program: Command) => {
  const cmd = program
    .command('dev')
    .option(
      '-f, --functions <functions...>',
      'function names to deploy (variadic)',
    )
}
