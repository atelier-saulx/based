import { dateOnly, externalDateAndTime } from '../shared/dateAndTimeFormats.js'
import { fileExtensions, installableTools } from '../shared/index.js'

export default {
  appName: 'Based.io CLI',
  appCommand: 'based',
  version: {
    parameter: '-v, --version',
  },
  currency: '$${value}',
  monthlySubscription: 'month',
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
  prompts: {
    auth: {
      org: 'Chose the organization you want to connect:',
    },
  },
  commands: {
    globalOptions: {
      longDescription:
        "The CLI has some global options that can be used from any command. These options, when used on the command line, have precedence over any other option related to your project. For example, after configuring your 'based.(ts|js|json)' file to use the project `'my-first-project'`, and you use the option `--project my-second-project` on the command line, that option will be used instead. Therefore, if you want to configure your project for CI/CD, you can pass all the parameters you need on the command line.",
      options: [
        {
          parameter: '--display <level>',
          description:
            'Sets the logging level for the CLI output (available levels: log / verbose / debug / silent).',
          default: 'log',
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
        {
          parameter: '--path <path>',
          description: 'The path to save the Based Project File.',
          hidden: true,
        },
        {
          parameter: '-ed, --envDiscoveryUrl <url...>',
          description:
            'If you want to define a specific URL from a different environment to connect to.',
        },
        {
          parameter: '-pd, --platformDiscoveryUrl <url...>',
          description:
            'If you want to define a specific URL from a different platform to connect to.',
        },
      ],
    },
    disconnect: {
      description: 'Disconnect your user locally.',
      example: 'npx @based/cli disconnect',
      options: [],
      methods: {
        connectedUser: 'The user <b>${email}</b> is currently connected.',
        success: 'You are now disconnected. See you soon!',
        error:
          "I couldn't find any user to disconnect. Please log in first to start using <b>Based</b>.",
      },
      prompts: {
        confirmation: 'Do you want to disconnect the account?',
      },
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
      methods: {
        selectUser: 'Some users were found, which one would you like to use?',
        email: 'Enter your email address:',
        emailNotValid: 'This is not a valid email. Try again.',
        newUser: {
          value: '<new_user>',
          label: "It's not me.",
        },
        authByEmail:
          'Please check your inbox at <b>${email}</b>, your login code is: <b>${code}</b>...',
        authByState: 'Authorizing your email <b>${email}</b>...',
        success: "Email verified. Welcome, <b>${user}</b>. Let's rock!",
        welcomeBack: "Welcome back, <b>${user}</b>! Let's rock!",
        error: 'Was not possible to autenticate your user. ${error}',
      },
    },
    init: {
      descripion: 'The start point to create your Based project.',
      example: 'npx @based/cli init [options]',
      validations: {
        name: 'name',
        path: 'path',
        format: 'format',
        dependencies: 'dependencies',
        queries: 'queries',
        functions: 'functions',
      },
      options: [
        {
          parameter: '-n, --name <name>',
          description: 'Give a name to your project.',
        },
        {
          parameter: '-d, --description <description>',
          description: 'Give a description to your project.',
        },
        {
          parameter: '--path <path>',
          description: 'The path to save the Based Project File.',
        },
        {
          parameter: '--format <format>',
          description: `The extension of file you prefer (available formats: ${Object.values(fileExtensions).join(', ')}).`,
        },
        {
          parameter: '-dp, --dependencies <packages...>',
          description: `Choose the dependencies you want to be added to your project (available tools:  ${Object.values(installableTools).join(', ')}).`,
        },
        {
          parameter: '--queries <queries...>',
          description: 'You can pre-create your Based Query Functions.',
        },
        {
          parameter: '-f, --functions <functions...>',
          description: 'You can pre-create your Based Cloud Functions.',
        },
      ],
      methods: {
        letsCreate: "<b>Let's create your project!</b>",
        name: "Give a name to your project: <dim>(this will also be used in your 'package.json')</dim>",
        description: 'What is the best way to describe it?',
        format: 'Which extension would you like to use for your project file?',
        path: 'Path to save the project file: <dim>(If the file already exists it will be overwritten)</dim>',
        cannotInit:
          'It is not possible to create a project without the necessary information. Please try again.',
        queries:
          'Do you want to create a query function? <dim>(You can name as many as you want; just separate them with commas)</dim>',
        functions:
          'Do you want to create a cloud function? <dim>(You can name as many as you want; just separate them with commas)</dim>',
        cluster: 'Which cluster do you want to connect to?',
        org: {
          select: 'Which organization owns this project?',
          input: 'What is the name of your new organization?',
          notFound:
            'The organization <b>${org}</b> was not found in your account.',
          found:
            'The organization <b>${org}</b> already exists in your account.',
          new: {
            label: 'Add a new organization to your account',
            value: '<new_org>',
          },
        },
        project: {
          select: 'Which project in <b>${org}</b> do you want to use?',
          input:
            'What is the name of the project that will be included in the organization <b>${org}</b>?',
          notFound:
            "The project <b>${org}</b> you're looking for was not found in your account.",
          found:
            'The project <b>${project}</b> already exists in your account.',
          new: { label: 'Create a new project', value: '<new_project>' },
        },
        env: {
          select:
            'Which environment in <b>${project}</b> will your project run in?',
          input:
            "What is the name of the environment in <b>${project}</b>? <dim>(this env will be created if it doesn't exists in your account).</dim>",
          notFound: "The env <b>${env}</b> doesn't exist.",
          branchNotFound:
            "It looks like you're working in a directory that isn't under Git version control, as no branch was found.",
          found:
            'The environment <b>${env}</b> already exists in your account.',
          new: [
            // { label: 'Deploy a new environment', value: '<new_env>' },
            { label: '#branch', value: '#branch', hint: 'Recommended' },
          ],
        },
        apiKey:
          'Do you have any API Key that you want to use for this project?',
        dependencies:
          'Select the dependencies you want to be installed in your project:',
        devDependencies:
          'Select the development dependencies you want to be installed in your project:',
        summary: {
          header: '<b>Project summary:</b>',
          name: 'Name: <b>${name}</b>',
          description: 'Description: <b>${description}</b>',
          cloud:
            '<reset>Cloud information: [Cluster: <b>${cluster}</b> | Org: <b>${org}</b> | Project: <b>${project}</b> | Env: <b>${env}</b>]</reset>',
          apiKey: 'API Key: <b>${apiKey}</b>',
          functions: 'Functions to be created: <b>${queries}</b>',
          dependencies: 'Dependencies to be added: <b>${dependencies}</b>',
          saveIn: 'Saving the project file in: <b>${path}</b>',
        },
      },
    },
    backups: {
      usage: '[command]',
      description: 'Backup and restore your databases.',
      example: 'npx @based/cli backup [sub-command][options]',
      subCommands: {
        make: {
          description: 'Backup current environment state.',
          methods: {
            confirmation: 'Would you like to proceed and make a new backup?',
            success: 'Backup created successfully!',
            making: 'Making a new backup...',
          },
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
          methods: {
            downloadConfirmation:
              'Would you like to download any of this backups?',
            restoreConfirmation:
              'Would you like to restore one of these backups and make it the current version of the database?',
            flushConfirmation:
              'Would you like to flush the current database? (This action cannot be undone)',
            searching: 'Searching for databases and backups...',
            noBackups: 'There were no backups found.',
          },
          validations: {
            sort: 'sort',
            limit: 'limit',
          },
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
            getPath:
              'Path to save the backup to: <dim>(If the file already exists it will be overwritten)</dim>',
            getDownload: {
              isExternalPath: '<b>Selected path:</b> <cyan>${path}</cyan>',
            },
            summary: {
              header: '<b>Download summary:</b>',
              database: '<b>Database:</b> <reset><cyan>${db}</cyan></reset>',
              file: '<b>Backup file:</b> <reset><cyan>${file}</cyan></reset>',
              path: '<b>Saving backup file in:</b> <reset><cyan>${path}</cyan></reset>',
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
          methods: {
            confirmation: 'Do you want to proceed with the backup restoration?',
            restoring: 'Restoring your backup...',
            success: 'Backup <cyan>${file}</cyan> restored successfully!',
            summary: {
              header: '<b>Restore summary:</b>',
              database: '<b>Database:</b> <cyan>${db}</cyan>',
              file: '<b>File to be restored:</b> <cyan>${file}</cyan>',
            },
          },
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
          methods: {
            success: 'Current database flushed successfully!',
            flushing: 'Flushing the current database...',
            summary: {
              header: '<b>Flush summary:</b>',
              projectInfo:
                '<b>Cluster:</b> <cyan>${cluster}</cyan> | <b>Org:</b> <cyan>${org}</cyan> | <b>Project:</b> <cyan>${project}</cyan> | <b>Env:</b> <cyan>${env}</cyan>',
              config: '<b>Config:</b> <cyan>${dbInfo}</cyan>',
              service: '<b>Service:</b> <cyan>@based/env-db</cyan>',
              database: '<b>Database:</b> <cyan>${db}</cyan>',
              instance: '<b>Instance:</b> <cyan>${instance}</cyan>',
            },
          },
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
                'Filter by level (available levels: all / info / error).',
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
          validations: {
            sort: 'sort',
            startDate: 'start date',
            endDate: 'end date',
            checksum: 'checksum',
            logLevel: 'log level',
            interval: 'date interval',
          },
          methods: {
            filterByDate: 'Would you like to filter the logs by date and time?',
            startDate:
              'Please enter the start date and time for filtering logs:',
            endDate: 'Please enter the end date and time for filtering logs:',
            function: 'Do you want to filter by function?',
            functions: 'Please select the functions: <dim>(A-Z)</dim>',
            startAndEndDates: 'Start date: ${startDate} | End date: ${endDate}',
            endDateWrong:
              'The end date cannot be before the start date. ${message}',
            startDateWrong: 'The start date cannot be after now. ${message}',
          },
        },
        clear: {
          description: 'Clear the logs.',
          cleaning: 'Cleaning your logs...',
          success: 'Logs cleaned successfully!',
        },
      },
    },
    test: {
      description: "Run your application's tests using your environment data.",
      example: 'npx @based/cli test [options]',
      options: [
        {
          parameter: '-co, --command <command>',
          description:
            "Execute a specific NPM script defined in your 'package.json'.",
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
      validations: {
        machine: 'machine',
        min: 'min',
        max: 'max',
        path: 'path',
        format: 'format',
      },
      subCommands: {
        init: {
          description:
            'To create a very basic infra file in your repo to be used as your infra.',
          options: [
            {
              parameter: '-s, --standby',
              description: 'Set the standby mode of your machines.',
              default: true,
            },
            {
              parameter: '-n, --name <name>',
              description: 'Give a name to your machine.',
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
            },
            {
              parameter: '--min <min>',
              description:
                'The minimum number of machines that will run your app.',
            },
            {
              parameter: '--max <max>',
              description:
                'The maximum number of machines that you want to scale your app.',
            },
            {
              parameter: '--path <path>',
              description: 'The path to save the file.',
            },
            {
              parameter: '--format <format>',
              description: `The extension of file you prefer (available formats: ${Object.values(fileExtensions).join(', ')}).`,
            },
          ],
          methods: {
            inputPath:
              'Path to save the infra file: <dim>(If the file already exists it will be overwritten)</dim>',
            warning:
              '<b>Warning!</b> Only manipulate the infra information if you really know what you’re doing. <b>Those actions cannot be undone.</b>',
            name: 'Give a name to your machine: <dim>(name has to be unique)</dim>',
            description: 'Give a description to your machine:',
            domains:
              'The domains to be assigned to the machine: <dim>(separated by commas)</dim>',
            machine: 'Select the size of your machine',
            min: 'The minimum number of machines that will run your app:',
            max: 'The maximum number of machines that you want to scale your app:',
            cannotInit:
              'It is not possible to create an infrastructure without the necessary information. Please try again.',
            fileExtension: 'What file format would you like to use',
            summary: {
              header: '<b>Infra summary:</b>',
              name: '<b>Name:</b> <reset><cyan>${name}</cyan></reset>',
              description:
                '<b>Description:</b> <reset><cyan>${description}</cyan></reset>',
              domains: '<b>Domains:</b> <reset><cyan>${domains}</cyan></reset>',
              machine: '<b>Machine:</b> <reset><cyan>${machine}</cyan></reset>',
              scale:
                '<b>Scale:</b> [Min: <reset><cyan>${min}</cyan></reset> / Max: <reset><cyan>${max}</cyan></reset>]',
              services:
                '<b>Services included:</b> <reset><cyan>${services}</cyan></reset>',
              saveIn:
                '<b>Saving infra file in:</b> <reset><cyan>${path}</cyan></reset>',
            },
          },
        },
        get: {
          description: 'To download your infra file in your repo.',
          options: [
            {
              parameter: '-m, --machine <machine>',
              description:
                'If you want to filter and get only a specific machine.',
            },
            {
              parameter: '--path <path>',
              description: 'The path to save the file.',
            },
            {
              parameter: '--format <format>',
              description: `The extension of file you prefer (available formats: ${Object.values(fileExtensions).join(', ')}).`,
            },
          ],
          methods: {
            inputPath: '@commands.infra.subCommands.init.methods.inputPath',
            cannotInit: '@commands.infra.subCommands.init.methods.cannotInit',
            fileExtension:
              '@commands.infra.subCommands.init.methods.fileExtension',
            summary: {
              header: '<b>Infra summary:</b>',
              currentEnv: 'Current env: <dim>${env}</dim>',
              saving_one:
                'Saving data from: <dim>${number} machine</dim> | <b>Machine:</b> <dim>${name}</dim>',
              saving_many:
                'Saving data from: <dim>${number} machines</dim> | <b>Machines:</b> <dim>${name}</dim>',
              saveIn: 'Saving infra file in: <dim>${path}</dim>',
            },
          },
        },
        overview: {
          description:
            'Check the status from your infra, live connections, machines and services.',
          options: [
            {
              parameter: '--monitor',
              description: 'To display the overview in an interactive UI.',
            },
            {
              parameter: '--stream',
              description: 'To display the overview in real time.',
            },
          ],
        },
      },
    },
    deploy: {
      description: 'Push your app to Based Cloud super fast as hell.',
      example: 'npx @based/cli deploy [options]',
      options: [
        {
          parameter: '-w, --watch',
          description: 'To deploy in watch mode.',
        },
        {
          parameter: '-fr, --force-reload [value]',
          description:
            'Enable or disable this function in the cloud, or set the update time window (in seconds) to ensure users stay in sync with your cache.',
        },
        {
          parameter: '--functionsOnly',
          description: 'Only deploy functions, no schema',
        },
        {
          parameter: '--schemaOnly',
          description: 'Only deploy schema, no functions',
        },
        {
          parameter: '-f, --functions <functions...>',
          description: 'The function names to be served (variadic).',
        },
      ],
      methods: {
        uploaded: '<b>Uploaded</b>: ',
        uploading: '<b>Uploading</b>: ',
        deployed: '<b>Deployed</b>: ',
        deploying: '<b>Deploying</b>: ',
        asset_one: '${item} asset',
        asset_many: '${item} assets',
        function_one: '${item} function <dim>${name}</dim>',
        function_many: '${item} functions',
        schema_one: '${item} schema',
        schema_many: '${item} schemas',
        deployComplete: 'Deployment completed successfully.',
        deployLive: 'Your application is now <b>LIVE</b> at:',
      },
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
          parameter: '--cloud',
          description: 'To connect to Based Cloud instead.',
        },
        {
          parameter: '-f, --function <functions...>',
          description: 'The function names to be served (variadic).',
        },
      ],
    },
    secrets: {
      usage: '[command]',
      description: 'Set or get Based Secrets',
      example: 'npx @based/cli secrets [sub-command][options]',
      subCommands: {
        get: {
          description: 'Get a Based Secret.',
          options: [
            {
              parameter: '--key <key>, -k <key>',
              description: 'Secret key/name',
            },
          ],
          methods: {
            success:
              'Secret with key <b>${key}</b> has the value: <b>${value}</b>',
            not_found: 'Secret with key <b>${key}</b> not found.',
            not_key: 'Key argument needed.',
          },
        },
        set: {
          description: 'Set a Based Secret.',
          options: [
            {
              parameter: '--key <key>, -k <key>',
              description: 'Secret key/name',
            },
            {
              parameter: '--value <value>, -v <value>',
              description: 'Secret value',
            },
          ],
          methods: {
            success: 'Secret <b>${key}</b> set successfully!',
            not_key: 'Key argument needed.',
            not_value: 'Value argument needed.',
          },
        },
      },
    },
  },
  errors: {
    401: 'Was not possible to autenticate you. Please check your email and try again. ${error}',
    402: "Was not possible to autenticate you because your <b>token is expired</b>. Let's try it again!",
    408: 'Connection <b>timeout</b> while trying to reach the cloud. Please check your network connection and try again.',
    404: 'Fatal error while trying to establish a <b>connection to the cloud</b>. Check your <b>${file}</b> file or your <b>arguments</b> and try again. ${error}',
    499: 'Could not connect. Check your <b>${file}</b> file or <b>your arguments</b> and try again.',
    901: "The <b>${option}</b> provided is not valid: '<b>${value}</b>'. Check it and try again.",
    902: 'Was not possible to save the file: ${error}',
    903: 'Was not possible to get your machines from the cloud: ${error}',
    904: 'The specified path is invalid or does not exist. Please provide a valid path.',
    905: 'Error geting your file: ${error}',
    906: 'Error flushing the current database: ${error}',
    907: 'Error making your backup: ${error}',
    908: 'Error restoring your file: ${error}',
    909: 'Error uploading your file: ${error}',
    910: 'Error cleaning your logs: ${error}',
    911: "Error running your tests, was not possible to find the command: <b>'${command}'</b> in your <b>'package.json'</b>",
    912: 'Request failed with status code ${code}.',
    913: 'Request error: ${error}',
    914: 'Error parsing the response of the request: ${error}',
    915: 'Source ZIP file not found.',
    916: 'Entry point not found in the ZIP file.',
    917: 'Fatal error: ${error}',
  },
  alias: {
    isExternalPath:
      '@commands.backups.subCommands.download.methods.getDownload.isExternalPath',
  },
  context: {
    configurationFileNotFound:
      'No <b>Based</b> configuration file was found, or it is empty or invalid. <b>Consider creating one.</b>',
    createBasedFile:
      'Do you want to create a Based file? If you continue without creating the file, your session will not be saved. If you proceed with this operation, a file named <b>based.ts</b> will be created in the current directory: <dim><b>${directory}</b></dim>',
    file: '<dim>Project file:</dim> <b>${file}</b>',
    cluster: '<dim>Cluster:</dim> <b>${cluster}</b>',
    org: '<dim>Org:</dim> <b>${org}</b>',
    project: '<dim>Project:</dim> <b>${project}</b>',
    env: '<dim>Env:</dim> <b>${env}</b>',
    apiKey: '<dim>API Key:</dim> <b>${apiKey}</b>',
    loading: 'Loading...',
    input: {
      enterToSkip: '<dim>(ENTER to skip)</dim>',
      skip: '<dim>(Enter to skip)</dim>',
      today: '<dim>(T for today)</dim>',
      now: '<dim>(N for now)</dim>',
      empty: 'This value cannot be empty.',
      continue: 'Continue?',
      positive: 'Yes',
      negative: 'No',
    },
  },
  methods: {
    savingFile: 'Saving file...',
    uploadingFile: 'Uploading file...',
    downloading: 'Downloading file...',
    savedFile: 'Saved file: <reset><b>${path}</b></reset>',
    projectCreation: 'Creating your project',
    projectCreated: 'Project created at: ${path}',
    warning:
      "<b>Warning! This action cannot be undone. Proceed only if you know what you're doing.</b>",
    tools: {
      typescript: {
        label: 'TypeScript',
        value: 'typescript',
        hint: 'Recommended',
      },
      vitest: { label: 'Vitest (Test runner)', value: 'vitest' },
      biome: { label: 'BiomeJS (Linter & Formatting code)', value: 'biome' },
      react: { label: 'React (UI)', value: 'react' },
    },
    format: {
      ts: { label: 'TypeScript', value: 'ts', hint: 'Recommended' },
      js: { label: 'JavaScript', value: 'js' },
      json: { label: 'JSON', value: 'json' },
    },
    aborted: 'Operation aborted.',
    login: {
      otherUser: 'Other user',
      selectUser: 'Select user',
      email: 'Enter your email address:',
      success: 'User: <b>${email}</b> logged in successfully!',
    },
    bundling: {
      noIndex:
        "Could not find <b>'index.ts'</b> or <b>'index.js'</b> for <b>'${function}'</b>",
      multipleConfig:
        "Found <b>multiple configs</b> for the function <b>'${function}'</b>. The config file: <b>'${file}'</b> will not be used for this function.",
      noMainTypeApp:
        "No <b>'main'</b> field defined for <b>'${function}'<b> of type 'app', this is a required field",
      loadingConfigs: 'Loading your <b>Based</b> files',
      noConfigs:
        'No matching files found. Check your <b>Based</b> files and try again.',
      project: 'Bundling your project',
      functionsLabel_one: '<b>Function</b>: ${number}',
      functionsLabel_many: '<b>Functions</b>: ${number}',
      assetsLabel_one: '<b>Asset</b>: ${number}',
      assetsLabel_many: '<b>Assets</b>: ${number}',
      pluginLabel: '<b>Plugins</b>: ${number}',
      changeDetected: 'Detected changes, rebundling files',
      errorDetected: 'Error detected while bundling',
      wrongTypeIntro: '<yellow><b>Wrong type</b></yellow>',
      wrongType:
        "The type key of the function '<b>${name}</b>' is missing or invalid. The only valid values are: ${types}",
      methodNotExportedIntro: '<yellow><b>Export default missing</b></yellow>',
      methodNotExported:
        "No <b>default</b> export pointing to a method related to the function '<b>${name}</b>' of type '<b>${type}</b>' was found",
      asyncJobIntro: '<yellow><b>Async jobs</b></yellow>',
      asyncJob:
        "<b>Based Job Functions</b> cannot be declared as an <b>async</b> function. Change the declaration of the function '<b>${name}</b>'. The job will not be executed.",
      error: {
        file: '<b>File</b>: ${file}',
        location: '<b>Location</b>: Ln ${line}, Col ${column}',
        plugin: '<b>Plugin</b>: ${name}',
      },
      types: {
        update: '<b>Updated</b>: ${file}',
        delete: '<b>Deleted</b>: ${file}',
        create: '<b>Created</b>: ${file}',
      },
    },
    schema: {
      multiple: 'Multiple schemas found',
      multipleDesc: 'You should have only one schema in your project.',
      remove: 'Remove the files and try again.',
      loading: 'Loading your schema',
      unavailable: '<yellow>Schema unavailable for BasedDB v2</yellow>',
      setSchema: `Your Schema was successfully found, but schemas can only be defined for BasedDB v1. If you're trying to apply a Schema to BasedDB v2, you'll need to do it manually through a function temporarily.`,
    },
    infra: {
      multiple: 'Multiple infras found',
      multipleDesc: 'You should have only one infra in your project.',
      remove: 'Remove the files and try again.',
      loading: 'Loading your infra',
    },
    server: {
      name: '<dim><b>Based Dev Server</b> error:</dim>',
    },
    database: {
      name: '<primary><b>Based DB</b></primary>',
      instance: '<dim><b>Local instance</b>: ${status}</dim>',
      running: 'Running',
      notRunning: 'Not running',
    },
    plugins: {
      cloudFunctions: 'Connecting your app to your cloud functions',
      localFunctions: 'Connecting your app to your local functions',
    },
    hubConnection: {
      cluster: 'Based Cluster',
      environment: 'the Environment',
      project: 'the Project',
      connecting: 'Connecting to ${target}...',
      connected: 'Connected to ${target}.',
    },
  },
} as const
