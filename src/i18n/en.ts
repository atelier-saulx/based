import { dateOnly } from '../shared/dateAndTimeFormats.js'

export default {
  appName: 'Based CLI',
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
      name: 'auth',
      description: 'Authorize your user in the Based Cloud.',
      options: [
        {
          parameter: '--email <email>',
          description: 'To speed up the login process.',
        },
      ],
    },
    backups: {
      name: 'backups',
      usage: '[command]',
      description: 'Backup and restore your databases.',
      subCommands: [
        {
          name: 'make',
          description: 'Backup current environment state.',
        },
        {
          name: 'list',
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
        {
          name: 'download',
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
        },
        {
          name: 'restore',
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
        {
          name: 'flush',
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
      ],
    },
  },
  errors: {
    401: 'It seems you are not logged in. One possible reason could be an expired or invalid token. Please log in again to continue.',
    408: 'Connection <b>timeout</b> while trying to reach the cloud. Please check your network connection and try again.',
    404: "Fatal error while trying to establish a <b>connection to the cloud</b>. Check your '<b>${file}</b>' file or <b>arguments</b> and try again.",
    499: "Could not connect. Check your '<b>${file}</b>' file or <b>your arguments</b> and try again.",
  },
}
