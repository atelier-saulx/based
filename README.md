# @based/cli
Streamline your app development with our cli.
**Based** offers a real-time database and makes deploying to the cloud fast and easy,
letting you focus on building your app without the hassle.

## Simple usage
*Example:* `npx @based/cli [commands][sub-commands][options]`

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
  env: 'production', // or any other name you have chosen
}
```

You can also use an API Key if you're setting up a CI/CD, like this:
```typescript
export default {
  apiKey: 'my-key',
}
```
*To get an API Key, go to Based.io.*

The second method is to use the authentication parameters with each CLI interaction.
You can use `--org`, `--project`, and `--env` or just `--api-key`
followed by the corresponding information for each parameter.

If you decide to create the file at the root of your project,
there is no need to pass any of the authentication parameters when executing CLI commands;
they are all optional.
However, if you provide any of the authentication parameters in a project that has the `based.json` file,
the information passed as a parameter will take precedence over the file.

## Global Options
The CLI has some global options that can be used from any command.
These options, when used on the command line, have precedence over any other option related to your project.
For example, after configuring your 'based.json' file to use the project `'my-first-project'`,
and you use the option `--project my-second-project` on the command line, that option will be used instead.
Therefore, if you want to configure your project for CI/CD, you can pass
all the parameters you need on the command line.

| Option                      | Description                                                                                                                 |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| `--display <level>`         | Sets the logging level for the CLI output. (default: verbose)(available levels: verbose/info/success/warning/error/silent). |
| `-y`, `--yes`               | You can use this to skip all the prompts and use a predefined preset in some commands.                                      |
| `-c`, `--cluster <cluster>` | Define the cluster to use (default: "production").                                                                          |
| `-o`, `--org <org>`         | Specify the organization.                                                                                                   |
| `-p`, `--project <project>` | Specify the project name.                                                                                                   |
| `-e`, `--env <env>`         | Specify witch environment (can be a name or "#branch" if you want to deploy by branch).                                     |
| `--api-key <api-key>`       | API Key generated on Based.io for Service Account.                                                                          |

## Basic commands
### auth
Authorize your user in the Based Cloud.

*Example:* `npx @based/cli auth`

| Option            | Description                    | Required |
|-------------------|--------------------------------|----------|
| `--email <email>` | To speed up the login process. | No       |


### init [not-ready]
*Example:* `npx @based/cli init [options]`

| Option          | Description                                                     | Required |
|-----------------|-----------------------------------------------------------------|----------|
| `--path <path>` | Specify the path where the boilerplate app should be installed. | Yes      |
| `--debug`       | Show debug information if available.                            | No       |
| `[globals]`     | You can use any global option                                   | No       |

### dev
*Example:* `npx @based/cli dev [options]`

| Option                            | Description                                 | Required |
|-----------------------------------|---------------------------------------------|----------|
| `--port <port>`                   | To set manually the Based Dev Server port.  | No       |
| `-f`, `--function <functions...>` | The function names to be served (variadic). | No       |
| `[globals]`                       | You can use any global option               | No       |

### deploy
*Example:* `npx @based/cli deploy [options]`

| Option                            | Description                                   | Required |
|-----------------------------------|-----------------------------------------------|----------|
| `-f`, `--function <functions...>` | The function names to be deployed (variadic). | No       |
| `--schema`                        | Deploy schemas (default: false).              | No       |
| `-w`, `--watch`                   | Watch for changes (default: false).           | No       |
| `--force`                         | Force deploy unchanged (default: false).      | No       |
| `[globals]`                       | You can use any global option                 | No       |

### logs
*Example:* `npx @based/cli logs [sub-command][options]`

#### filter
| Option                            | Description                                                               | Required |
|-----------------------------------|---------------------------------------------------------------------------|----------|
| `-g`, `--group <group>`           | Group similar logs (default: name)(available types: name/functions/time). | No       |
| `-l`, `--level <level>`           | Filter by level (default: all)(available levels: all/info/error).         | No       |
| `--before <DD/MM/YYYY>`           | Filter by date.                                                           | No       |
| `--after <DD/MM/YYYY>`            | Filter by date.                                                           | No       |
| `-cs`, `--checksum <cheksum>`     | Filter by checksum.                                                       | No       |
| `-f`, `--function <functions...>` | Filter by function (variadic).                                            | No       |
| `-s`, `--service <services...>`   | Filter by service name (variadic).                                        | No       |
| `[globals]`                       | You can use any global option                                             | No       |

#### clean
| Option      | Description                   | Required |
|-------------|-------------------------------|----------|
| `[globals]` | You can use any global option | No       |


### backups
*Example:* `npx @based/cli backup [sub-command][options]`

#### make
| Option      | Description                   | Required |
|-------------|-------------------------------|----------|
| `[globals]` | You can use any global option | No       |

#### list
| Option                  | Description                                                  | Required |
|-------------------------|--------------------------------------------------------------|----------|
| `-l`, `--limit <limit>` | Limit the number of displayed backups (default: 10)(all: 0). | No       |
| `-s`, `--sort <sort>`   | Sort the order of the backups ASC/DESC (default: ASC).       | No       |
| `[globals]`             | You can use any global option                                | No       |

#### download
| Option          | Description                                    | Required |
|-----------------|------------------------------------------------|----------|
| `--db <db>`     | DB instance name.                              | No       |
| `--file <file>` | The '.rdb' backup file to download.            | No       |
| `--path <path>` | Specify the path where the file will be saved. | No       |
| `[globals]`     | You can use any global option                  | No       |

#### restore
| Option          | Description                       | Required |
|-----------------|-----------------------------------|----------|
| `--db <db>`     | DB instance name.                 | No       |
| `--file <file>` | The '.rdb' backup file to upload. | No       |
| `[globals]`     | You can use any global option     | No       |

#### flush
| Option      | Description                   | Required |
|-------------|-------------------------------|----------|
| `--db <db>` | DB instance name.             | No       |
| `[globals]` | You can use any global option | No       |


### call [not-ready]
*Example:* `npx @based/cli call [options]`

| Option                             | Description                     | Required |
|------------------------------------|---------------------------------|----------|
| `-f`, `--function <function name>` | The function name to be called. | Yes      |
| `[globals]`                        | You can use any global option   | No       |


### edit [not-ready]
*Example:* `npx @based/cli edit [options]`

| Option                    | Description                   | Required |
|---------------------------|-------------------------------|----------|
| `--id <id>`               | ID.                           | No       |
| `--db <db>`               | DB instance name.             | No       |
| `--language <language>`   | Language.                     | No       |
| `-e`, `--editor <editor>` | Editor (default: "nvim").     | No       |
| `[globals]`               | You can use any global option | No       |


### secrets [not-ready]
*Example:* `npx @based/cli secrets [sub-command][options]`

#### set
| Option                  | Description                   | Required |
|-------------------------|-------------------------------|----------|
| `-k`, `--key <key>`     | Key.                          | No       |
| `-v`, `--value <value>` | Value.                        | No       |
| `[globals]`             | You can use any global option | No       |


#### get
| Option              | Description                   | Required |
|---------------------|-------------------------------|----------|
| `-k`, `--key <key>` | Key.                          | No       |
| `[globals]`         | You can use any global option | No       |


### query [not-ready]
*Example:* `npx @based/cli query [options]`

| Option                    | Description                         | Required |
|---------------------------|-------------------------------------|----------|
| `--id <id>`               | Query ID.                           | Yes      |
| `--db <db>`               | DB instance name.                   | No       |
| `-n`, `--name <name>`     | Name.                               | No       |
| `-w`, `--watch`           | Watch for changes (default: false). | No       |
| `-t`, `--type <type>`     | Type.                               | No       |
| `--language <language>`   | Language.                           | No       |
| `-f`, `--fields <fields>` | Fields.                             | No       |
| `-l`, `--limit <limit>`   | Limit.                              | No       |
| `[globals]`               | You can use any global option       | No       |