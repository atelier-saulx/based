# @based/cli

Streamline your app development with our cli.
**Based.io** offers a real-time database and makes deploying to the cloud fast and easy,
letting you focus on building your app without the hassle.

## Simple usage

_Example:_ `npx @based/cli@alpha [commands][sub-commands][options]`

When you created your account on Based.io, you also needed to create a cluster or an organization,
name your project, and choose an environment to start developing your app.

Once you have this information, you can continue to the authentication process.

During your first interaction with the CLI,
you will need to provide your username used to create your account on Based.io.
After validating your login, you're able to run any command with the CLI.

You can choose between three methods to interact with the CLI:

The first and recommended method is to create a configuration file called `based.ts` or `based.json`
at the root of your project, which should look something like this:

```typescript
export default {
  org: 'my-org',
  project: 'my-project',
  env: '#branch', // or any other name you have chosen
}
```

For branch deployment you can also use something like this in your `based.ts`:
```typescript
export default {
  org: 'my-org',
  project: 'my-project',
  env: 'main/#branch', // with this you set that you want to deploy your branch but cloning all the data from the env 'main'
}
```
*If any selected `env` is missing from your account, the CLI will offer to create it before proceeding with the deployment.*

You can also use an API Key if you're setting up a CI/CD, like this:

```typescript
export default {
  apiKey: 'my-key',
}
```

_To get an API Key, go to Based.io._

The second method is to use the authentication parameters with each CLI interaction.
You can use `--org`, `--project`, and `--env` or just `--api-key`
followed by the corresponding information for each parameter.

If you decide to create the file at the root of your project,
there is no need to pass any of the authentication parameters when executing CLI commands;
they are all optional.
However, if you provide any of the authentication parameters in a project that has the `based.json` file,
the information passed as a parameter will take precedence over the file.


## Commands

### Global Options

The CLI has some global options that can be used from any command. These options, when used on the command line, have precedence over any other option related to your project. For example, after configuring your 'based.(ts|js|json)' file to use the project `'my-first-project'`, and you use the option `--project my-second-project` on the command line, that option will be used instead. Therefore, if you want to configure your project for CI/CD, you can pass all the parameters you need on the command line.

| Option | Description |
|--------|-------------|
| `--display <level>` | Sets the logging level for the CLI output (available levels: log / verbose / debug / silent). |
| `-y, --yes` | You can use this to skip all the prompts and use a predefined preset in some commands. |
| `-c, --cluster <cluster>` | Define the cluster to use. |
| `-o, --org <org>` | Specify the organization. |
| `-p, --project <project>` | Specify the project name. |
| `-e, --env <env>` | Specify which environment (can be a name or "#branch" if you want to deploy by branch). |
| `--api-key <api-key>` | API Key generated on Based.io for Service Account. |
| `--file <file>` | If you want to use a specific Based configuration file. All other project options take precedence over this option. |
| `-ed, --envDiscoveryUrl <url...>` | If you want to define a specific URL from a different environment to connect to. |
| `-pd, --platformDiscoveryUrl <url...>` | If you want to define a specific URL from a different platform to connect to. |

### Disconnect

Disconnect your user locally.

_Example:_ `npx @based/cli disconnect`

### Auth

Authorize your user in the Based Cloud.

_Example:_ `npx @based/cli auth`

| Option | Description |
|--------|-------------|
| `--email <email>` | To speed up the login process. |

### Init

_Example:_ `npx @based/cli init [options]`

| Option | Description |
|--------|-------------|
| `-n, --name <name>` | Give a name to your project. |
| `-d, --description <description>` | Give a description to your project. |
| `--path <path>` | The path to save the Based Project File. |
| `--format <format>` | The extension of file you prefer (available formats: ts, js, json). |
| `-dp, --dependencies <packages...>` | Choose the dependencies you want to be added to your project (available tools:  typescript, vitest, biome, react). |
| `--queries <queries...>` | You can pre-create your Based Query Functions. |
| `-f, --functions <functions...>` | You can pre-create your Based Cloud Functions. |

### Backups

Backup and restore your databases.

_Example:_ `npx @based/cli backup [sub-command][options]`

#### Make

Backup current environment state.

#### List

List available backups.

| Option | Description |
|--------|-------------|
| `-l, --limit <limit>` | Limit the number of displayed backups (all: 0). |
| `-s, --sort <sort>` | Sort the order of the backups asc/desc. |

#### Download

Download previous backups.

| Option | Description |
|--------|-------------|
| `--db <db>` | DB instance name. |
| `--file <file>` | The '.rdb' backup file to be downloaded. This option takes precedence over the '--date' option. |
| `-d, --date <dd/mm/yyyy>` | Select a date to get the latest available backup. |
| `--path <path>` | The path to save the file. This option takes precedence over the '--date' option. |

#### Restore

Upload a backup file or restore a previous version as the current one.

| Option | Description |
|--------|-------------|
| `--db <db>` | DB instance name. |
| `--file <file>` | The '.rdb' backup file to be used. You can specify a file path or a file name from a backup previously uploaded to the cloud. This option takes precedence over the '--date' option. |
| `-d, --date <dd/mm/yyyy>` | Select a date to restore the latest available backup. |

#### Flush

Flush the current database.

| Option | Description |
|--------|-------------|
| `--db <db>` | DB instance name. |
| `--force` | Flush without confirmation. Warning! This action cannot be undone. |

### Logs

Visualize the logs stream about your functions or the cloud infrastructure.

_Example:_ `npx @based/cli logs [sub-command][options]`

#### Filter

List and filter your logs.

| Option | Description |
|--------|-------------|
| `--monitor` | To display the logs in an interactive UI. |
| `--stream` | To display the logs in real time. This option takes precedence over "limit", "before", "after", and "sort" options. |
| `--collapsed` | To display the content of the logs collapsed. |
| `--app` | To display the content only about your app and your functions. |
| `--infra` | To display the content only about the infrastructure of your environment. |
| `--level <level>` | Filter by level (available levels: all / info / error). |
| `-l, --limit <limit>` | Limit the number of displayed logs (all: 0, max: 1000)(Limit has no effect when logs are being displayed as a live stream in real-time). |
| `-s, --sort <sort>` | Sort the order of the logs asc/desc (Sorting has no effect when logs are being displayed as a live stream in real-time). |
| `-sD, --start-date <dd/mm/yyyy-hh:mm:ss>` | The start date and time for filtering logs. |
| `-eD, --end-date <dd/mm/yyyy-hh:mm:ss>` | The end date and time for filtering logs. |
| `-cs, --checksum <cheksum>` | Filter by checksum. |
| `-f, --function <functions...>` | Filter by function. |
| `-m, --machine <machines...>` | Filter by machine ID. |

#### Clear

Clear the logs.

### Test

Run your application's tests using your environment data.

_Example:_ `npx @based/cli test [options]`

| Option | Description |
|--------|-------------|
| `-co, --command <command>` | Execute a specific NPM script defined in your 'package.json'. |
| `-nb, --no-backup` | To not make a new backup before running the tests. |
| `-nr, --no-restore` | To not restore the backup after running the tests. |
| `--db <db>` | The DB instance name to be used to create/restore your backups. |
| `--file <file>` | Use an '.rdb' backup file to restore your data to the current version before running the tests. You can specify a file path or a file name from a backup previously uploaded to the cloud. This option also sets '--no-backup' to 'false'. This option takes precedence over the '--date' option. |
| `--date <dd/mm/yyyy>` | You can provide a date to use the most recent backup created on that date. |

### Infra

Manage your services running, create and destroy machines.

_Example:_ `npx @based/cli infra [sub-command][options]`

#### Init

To create a very basic infra file in your repo to be used as your infra.

| Option | Description |
|--------|-------------|
| `-s, --standby` | Set the standby mode of your machines. |
| `-n, --name <name>` | Give a name to your machine. |
| `-d, --description <description>` | Give a description to your machine. |
| `-do, --domains <domains...>` | Your domains to be assigned to the machine. |
| `-m, --machine <machine>` | The size of your machine. |
| `--min <min>` | The minimum number of machines that will run your app. |
| `--max <max>` | The maximum number of machines that you want to scale your app. |
| `--path <path>` | The path to save the file. |
| `--format <format>` | The extension of file you prefer (available formats: ts, js, json). |

#### Get

To download your infra file in your repo.

| Option | Description |
|--------|-------------|
| `-m, --machine <machine>` | If you want to filter and get only a specific machine. |
| `--path <path>` | The path to save the file. |
| `--format <format>` | The extension of file you prefer (available formats: ts, js, json). |

#### Overview

Check the status from your infra, live connections, machines and services.

| Option | Description |
|--------|-------------|
| `--monitor` | To display the overview in an interactive UI. |
| `--stream` | To display the overview in real time. |

### Deploy

Push your app to Based Cloud super fast as hell.

_Example:_ `npx @based/cli deploy [options]`

| Option | Description |
|--------|-------------|
| `-w, --watch` | To deploy in watch mode. |
| `-fr, --force-reload [value]` | Enable or disable this function in the cloud, or set the update time window (in seconds) to ensure users stay in sync with your cache. |
| `--functionsOnly` | Only deploy functions, no schema |
| `--schemaOnly` | Only deploy schema, no functions |
| `-f, --functions <functions...>` | The function names to be served (variadic). |

### Dev

Develop your app running the Based Cloud locally.

_Example:_ `npx @based/cli dev [options]`

| Option | Description |
|--------|-------------|
| `--port <port>` | To set manually the Based Dev Server port. |
| `--cloud` | To connect to Based Cloud instead. |
| `-f, --function <functions...>` | The function names to be served (variadic). |

