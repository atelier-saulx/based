import { dateOnly, externalDateAndTime } from '../shared/dateAndTimeFormats.js'

export default {
  appName: 'Based CLI',
  appCommand: 'based',
  version: {
    parameter: '-v, --version',
  },
  help: {
    option: {
      parameter: '-h, --help',
      description: 'Display the help for each command.',
    },
    command: {
      parameter: 'help [command]',
      description: 'Display the help related to the command.',
    },
  },
  commands: {
    globalOptions: {
      longDescription:
        "The CLI has some global options that can be used from any command. These options, when used on the command line, have precedence over any other option related to your project. For example, after configuring your 'based.(json|ts|js)' file to use the project `'my-first-project'`, and you use the option `--project my-second-project` on the command line, that option will be used instead. Therefore, if you want to configure your project for CI/CD, you can pass all the parameters you need on the command line.",
      options: [
        {
          parameter: '--display <level>',
          description:
            'Sets the logging level for the CLI output (available levels: verbose | info | success | warning | error | silent).',
          default: 'verbose',
        },
        {
          parameter: '-y, --yes',
          description:
            'You can use this to skip all the prompts and use a predefined preset in some commands.',
          default: false,
        },
        {
          parameter: '-c, --cluster <cluster>',
          description: 'Define the cluster to use.',
          default: 'production',
        },
        {
          parameter: '-o, --org <org>',
          description: 'Specify the organization.',
        },
        {
          parameter: '-p, --project <project>',
          description: 'Specify the project name.',
        },
        {
          parameter: '-e, --env <env>',
          description:
            'Specify which environment (can be a name or "#branch" if you want to deploy by branch).',
        },
        {
          parameter: '--api-key <api-key>',
          description: 'API Key generated on Based.io for Service Account.',
        },
        {
          parameter: '--file <file>',
          description:
            'If you want to use a specific Based configuration file. All other project options take precedence over this option.',
        },
      ],
    },
    auth: {
      description: 'Authorize your user in the Based Cloud.',
      example: 'npx @based/cli auth',
      options: [
        {
          parameter: '--email <email>',
          description: 'To speed up the login process.',
        },
      ],
    },
    backups: {
      usage: '[command]',
      description: 'Backup and restore your databases.',
      example: 'npx @based/cli backup [sub-command][options]',
      subCommands: {
        make: {
          description: 'Backup current environment state.',
        },
        list: {
          description: 'List available backups.',
          options: [
            {
              parameter: '-l, --limit <limit>',
              description: 'Limit the number of displayed backups (all: 0).',
              default: '10',
            },
            {
              parameter: '-s, --sort <sort>',
              description: 'Sort the order of the backups asc/desc.',
              default: 'desc',
            },
          ],
        },
        download: {
          description: 'Download previous backups.',
          options: [
            {
              parameter: '--db <db>',
              description: 'DB instance name.',
            },
            {
              parameter: '--file <file>',
              description:
                "The '.rdb' backup file to be downloaded. This option takes precedence over the '--date' option.",
            },
            {
              parameter: `-d, --date <${dateOnly.toLowerCase()}>`,
              description: 'Select a date to get the latest available backup.',
            },
            {
              parameter: '--path <path>',
              description:
                "The path to save the file. This option takes precedence over the '--date' option.",
            },
          ],
          methods: {
            getDownload: {
              isExternalPath: '<b>Selected path:</b> <cyan>${path}</cyan>',
            },
          },
        },
        restore: {
          description:
            'Upload a backup file or restore a previous version as the current one.',
          options: [
            {
              parameter: '--db <db>',
              description: 'DB instance name.',
            },
            {
              parameter: '--file <file>',
              description:
                "The '.rdb' backup file to be used. You can specify a file path or a file name from a backup previously uploaded to the cloud. This option takes precedence over the '--date' option.",
            },
            {
              parameter: `-d, --date <${dateOnly.toLowerCase()}>`,
              description:
                'Select a date to restore the latest available backup.',
            },
          ],
        },
        flush: {
          description: 'Flush the current database.',
          options: [
            {
              parameter: '--db <db>',
              description: 'DB instance name.',
            },
            {
              parameter: '--force',
              description:
                'Flush without confirmation. Warning! This action cannot be undone.',
            },
          ],
        },
      },
    },
    logs: {
      usage: '[command]',
      description:
        'Visualize the logs stream about your functions or the cloud infrastructure.',
      example: 'npx @based/cli logs [sub-command][options]',
      subCommands: {
        filter: {
          description: 'List and filter your logs.',
          options: [
            {
              parameter: '--monitor',
              description: 'To display the logs in an interactive UI.',
            },
            {
              parameter: '--stream',
              description:
                'To display the logs in real time. This option takes precedence over "limit", "before", "after", and "sort" options.',
            },
            {
              parameter: '--collapsed',
              description: 'To display the content of the logs collapsed.',
              default: false,
            },
            {
              parameter: '--app',
              description:
                'To display the content only about your app and your functions.',
            },
            {
              parameter: '--infra',
              description:
                'To display the content only about the infrastructure of your environment.',
            },
            {
              parameter: '--level <level>',
              description:
                'Filter by level (available levels: all | info | error).',
              default: 'all',
            },
            {
              parameter: '-l, --limit <limit>',
              description:
                'Limit the number of displayed logs (all: 0, max: 1000)(Limit has no effect when logs are being displayed as a live stream in real-time).',
              default: '100',
            },
            {
              parameter: '-s, --sort <sort>',
              description:
                'Sort the order of the logs asc/desc (Sorting has no effect when logs are being displayed as a live stream in real-time).',
              default: 'desc',
            },
            {
              parameter: `-sD, --start-date <${externalDateAndTime.toLowerCase()}>`,
              description: 'The start date and time for filtering logs.',
            },
            {
              parameter: `-eD, --end-date <${externalDateAndTime.toLowerCase()}>`,
              description: 'The end date and time for filtering logs.',
            },
            {
              parameter: '-cs, --checksum <cheksum>',
              description: 'Filter by checksum.',
            },
            {
              parameter: '-f, --function <functions...>',
              description: 'Filter by function.',
            },
            {
              parameter: '-m, --machine <machines...>',
              description: 'Filter by machine ID.',
            },
          ],
        },
        clear: {
          description: 'Clear the logs.',
        },
      },
    },
    test: {
      description: "Run your application's tests using your environment data.",
      example: 'npx @based/cli test [options]',
      options: [
        {
          parameter: '-co, --command <command>',
          description: "To run a specific command in your 'package.json'.",
          default: 'test',
        },
        {
          parameter: '-nb, --no-backup',
          description: 'To not make a new backup before running the tests.',
        },
        {
          parameter: '-nr, --no-restore',
          description: 'To not restore the backup after running the tests.',
        },
        {
          parameter: '--db <db>',
          description:
            'The DB instance name to be used to create/restore your backups.',
          default: 'default',
        },
        {
          parameter: '--file <file>',
          description:
            "Use an '.rdb' backup file to restore your data to the current version before running the tests. You can specify a file path or a file name from a backup previously uploaded to the cloud. This option also sets '--no-backup' to 'false'. This option takes precedence over the '--date' option.",
        },
        {
          parameter: `--date <${dateOnly.toLowerCase()}>`,
          description:
            'You can provide a date to use the most recent backup created on that date.',
        },
      ],
    },
    infra: {
      description: 'Manage your services running, create and destroy machines.',
      usage: '[command]',
      example: 'npx @based/cli infra [sub-command][options]',
      subCommands: {
        init: {
          description:
            'To create a very basic infra file in your repo to be used as your infra.',
          options: [
            {
              parameter: '--path <path>',
              description: 'The path to save the file.',
            },
            {
              parameter: '-n, --name <name>',
              description: 'The name of your machine.',
            },
            {
              parameter: '-d, --description <description>',
              description: 'Give a description to your machine.',
            },
            {
              parameter: '-do, --domains <domains...>',
              description: 'Your domains to be assigned to the machine.',
            },
            {
              parameter: '-m, --machine <machine>',
              description: 'The size of your machine.',
              default: 't3.micro',
            },
            {
              parameter: '--min <min>',
              description:
                'The minimum number of machines that will run your app.',
              default: '1',
            },
            {
              parameter: '--max <max>',
              description:
                'The maximum number of machines that you want to scale your app.',
              default: '1',
            },
          ],
        },
        overview: {},
      },
    },
    deploy: {
      description: 'Push your app to Based Cloud super fast as hell.',
      example: 'npx @based/cli deploy [options]',
      options: [
        {
          parameter: '-w, --watch',
          description: 'watch mode',
        },
        {
          parameter: '-f, --functions <functions...>',
          description: 'function names to deploy (variadic)',
        },
      ],
    },
    dev: {
      description: 'Develop your app running the Based Cloud locally.',
      example: 'npx @based/cli dev [options]',
      options: [
        {
          parameter: '--port <port>',
          description: 'To set manually the Based Dev Server port.',
        },
        {
          parameter: '-f, --function <functions...>',
          description: 'The function names to be served (variadic).',
        },
      ],
    },
  },
  errors: {
    401: 'It seems you are not logged in. One possible reason could be an expired or invalid token. Please log in again to continue.',
    408: 'Connection <b>timeout</b> while trying to reach the cloud. Please check your network connection and try again.',
    404: 'Fatal error while trying to establish a <b>connection to the cloud</b>. Check your <b>${file}</b> file or <b>arguments</b> and try again.',
    499: 'Could not connect. Check your <b>${file}</b> file or <b>your arguments</b> and try again.',
  },
  alias: {
    isExternalPath:
      '@commands.backups.subCommands.download.methods.getDownload.isExternalPath',
  },
  context: {
    configurationFileNotFound:
      'No <b>Based</b> configuration file found or is empty. <b>It is recommended to create one.</b>',
    file: '<dim>Project file:</dim> <b>${file}</b>',
    org: '<dim>Org:</dim> <b>${org}</b>',
    project: '<dim>Project:</dim> <b>${project}</b>',
    env: '<dim>Env:</dim> <b>${env}</b>',
    input: {
      skip: '<dim>(S to skip)</dim>',
      today: '<dim>(T for today)</dim>',
      now: '<dim>(N for now)</dim>',
      continue: 'Continue?',
    },
  },
  methods: {
    login: {
      otherUser: 'Other user',
      selectUser: 'Select user',
      email: 'Enter your email address:',
      success: 'User: <b>${email}</b> logged in successfully!',
    },
    hubConnection: {
      cloud: 'Based Cloud',
      environmentManager: 'the environment manager',
      environment: 'the environment',
      connecting: 'Connecting to ${target}...',
      connected: '${emoji} Connected to ${target}.',
    },
    authenticateUser: {
      loading:
        'Please check your inbox at <b>${email}</b>, your login code is: <b>${code}</b>.',
      sucess: "<b>Email verified. Welcome, let's rock!</b> 🔥",
    },
  },
}
