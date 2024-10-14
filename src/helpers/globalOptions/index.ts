import { Command } from 'commander'

export const globalOptions = async (program: Command): Promise<void> => {
  program
    .option(
      '--display <level>',
      `Sets the logging level for the CLI output (available levels: verbose | info | success | warning | error | silent).`,
      'verbose',
    )
    .option(
      '-y, --yes',
      `You can use this to skip all the prompts and use a predefined preset in some commands.`,
      false,
    )
    .option(
      '-c, --cluster <cluster>',
      'Define the cluster to use.',
      'production',
    )
    .option('-o, --org <org>', 'Specify the organization.')
    .option('-p, --project <project>', 'Specify the project name.')
    .option(
      '-e, --env <env>',
      'Specify witch environment (can be a name or "#branch" if you want to Deploy by branch).',
    )
    .option(
      '--api-key <api-key>',
      'API Key generated on Based.io for Service Account.',
    )
    .option(
      '--file <file>',
      'If you want to use a specific Based configuration file. All other project options take precedence over this option.',
    )

  program.helpOption('-h, --help', 'Display the help for each command.')
  program.helpCommand(
    'help [command]',
    'Display the help related to the command.',
  )
}
