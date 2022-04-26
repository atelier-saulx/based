import { Option, Command } from 'commander'

export type GlobalOptions = {
  org?: string
  project?: string
  env?: string
  cluster?: string
  basedFile?: string
  output: 'fancy' | 'json' | 'none'
  debug?: boolean
  nonInteractive: boolean
  apiKey?: string
  header: boolean
}

export const command = (command: Command) => {
  command
    .option('--org <org>', 'Org')
    .option('-p, --project <project>', 'Project')
    .option('-e, --env <env>', 'Env')
    .option('--cluster <cluster>', 'Cluster')
    .option('-b, --based-file <basedFile>', 'Path to based config file')
    .option('-d, --debug', 'Enable debug output')
    .option('--non-interactive', 'Non interactive mode', !process.stdout.isTTY)
    .option(
      '-k, --api-key [apiKey]',
      'Use apiKey from file or env variable if value is empty.'
    )
    .option('-H, --no-header', "Don't show header so you can chain commands.")
    .addOption(
      new Option('-o, --output <output>', 'Output type')
        .choices(['fancy', 'json', 'none'])
        .default('fancy')
    )

  return command
}

// shared auth if not authenticated
