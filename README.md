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

The first and recommended method is to create a configuration file called `based.json` or `based.json`
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

## Basic commands
### auth
Authorize your user in the Based Cloud.

*Example:* `npx @based/cli auth`

| Option            | Description                    | Required |
|-------------------|--------------------------------|----------|
| `--email <email>` | To speed up the login process. | No       |


### init [not-ready]
*Example:* `npx @based/cli init [options]`

| Option                       | Description                                                                              | Required |
|------------------------------|------------------------------------------------------------------------------------------|----------|
| `--path <path>`              | Specify the path where the boilerplate app should be installed.                          | Yes      |
| `--debug`                    | Show debug information if available.                                                     | No       |
| `-c`, `--cluster <cluster>`  | Define the cluster to use (default: "production").                                       | No       |
| `-o`, `--org <org>`          | Specify the organization.                                                                | No       |
| `-p`, `--project <project>`  | Specify the project name.                                                                | No       |
| `-e`, `--env <env>`          | Specify witch environment (can be a name or "#branch" if you want to deploy by branch).  | No       |
| `-s`, `--size <size>`        | Set the size of the environment to create (choices: "small", "large")(default: "small"). | No       |
| `-aK`, `--api-key <api-key>` | API Key generated on Based.io for Service Account.                                       | No       |

### dev
*Example:* `npx @based/cli dev [options]`

| Option                             | Description                                                                             | Required |
|------------------------------------|-----------------------------------------------------------------------------------------|----------|
| `-p`, `--port <port>`              | To set manually the Based Dev Server port.                                              | No       |
| `-fn`, `--function <functions...>` | The function names to be served (variadic).                                             | No       |
| `-c`, `--cluster <cluster>`        | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`                | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`        | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`                | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>`       | API Key generated on Based.io for Service Account.                                      | No       |


### deploy
*Example:* `npx @based/cli deploy [options]`

| Option                             | Description                                                                             | Required |
|------------------------------------|-----------------------------------------------------------------------------------------|----------|
| `-fn`, `--function <functions...>` | The function names to be deployed (variadic).                                           | No       |
| `--schema`                         | Deploy schemas (default: false).                                                        | No       |
| `-w`, `--watch`                    | Watch for changes (default: false).                                                     | No       |
| `--force`                          | Force deploy unchanged (default: false).                                                | No       |
| `-c`, `--cluster <cluster>`        | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`                | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`        | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`                | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>`       | API Key generated on Based.io for Service Account.                                      | No       |


### logs
*Example:* `npx @based/cli logs [sub-command][options]`

#### show
| Option                             | Description                                                                             | Required |
|------------------------------------|-----------------------------------------------------------------------------------------|----------|
| `--before <DD/MM/YYYY>`            | Filter by date.                                                                         | No       |
| `--after <DD/MM/YYYY>`             | Filter by date.                                                                         | No       |
| `-fn`, `--function <functions...>` | Filter by function.                                                                     | No       |
| `-cs`, `--checksum <cheksum>`      | Filter by checksum.                                                                     | No       |
| `-l`, `--level <level>`            | Filter by level.                                                                        | No       |
| `-s`, `--service <services...>`    | Filter by service name.                                                                 | No       |
| `-c`, `--cluster <cluster>`        | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`                | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`        | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`                | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>`       | API Key generated on Based.io for Service Account.                                      | No       |


#### clean
| Option                       | Description                                                                             | Required |
|------------------------------|-----------------------------------------------------------------------------------------|----------|
| `-c`, `--cluster <cluster>`  | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`          | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`  | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`          | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>` | API Key generated on Based.io for Service Account.                                      | No       |


### backup
*Example:* `npx @based/cli backup [sub-command][options]`

#### make
| Option                       | Description                                                                             | Required |
|------------------------------|-----------------------------------------------------------------------------------------|----------|
| `-c`, `--cluster <cluster>`  | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`          | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`  | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`          | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>` | API Key generated on Based.io for Service Account.                                      | No       |

#### list
| Option                       | Description                                                                             | Required |
|------------------------------|-----------------------------------------------------------------------------------------|----------|
| `-c`, `--cluster <cluster>`  | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`          | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`  | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`          | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>` | API Key generated on Based.io for Service Account.                                      | No       |

#### download
| Option                       | Description                                                                             | Required |
|------------------------------|-----------------------------------------------------------------------------------------|----------|
| `--db <db>`                  | DB instance name.                                                                       | No       |
| `--file <file>`              | The '.rdb' backup file to download.                                                     | No       |
| `--path <path>`              | Specify the path where the file will be saved.                                          | No       |
| `-c`, `--cluster <cluster>`  | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`          | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`  | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`          | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>` | API Key generated on Based.io for Service Account.                                      | No       |

#### restore
| Option                       | Description                                                                             | Required |
|------------------------------|-----------------------------------------------------------------------------------------|----------|
| `--db <db>`                  | DB instance name.                                                                       | No       |
| `--file <file>`              | The '.rdb' backup file to upload.                                                       | No       |
| `-c`, `--cluster <cluster>`  | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`          | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`  | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`          | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>` | API Key generated on Based.io for Service Account.                                      | No       |

#### flush
| Option                       | Description                                                                             | Required |
|------------------------------|-----------------------------------------------------------------------------------------|----------|
| `--db <db>`                  | DB instance name.                                                                       | No       |
| `-c`, `--cluster <cluster>`  | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`          | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`  | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`          | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>` | API Key generated on Based.io for Service Account.                                      | No       |


### call [not-ready]
*Example:* `npx @based/cli call [options]`

| Option                              | Description                                                                             | Required |
|-------------------------------------|-----------------------------------------------------------------------------------------|----------|
| `-fn`, `--function <function name>` | The function name to be called.                                                         | Yes      |
| `-c`, `--cluster <cluster>`         | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`                 | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`         | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`                 | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>`        | API Key generated on Based.io for Service Account.                                      | No       |


### edit [not-ready]
*Example:* `npx @based/cli edit [options]`

| Option                        | Description                                                                             | Required |
|-------------------------------|-----------------------------------------------------------------------------------------|----------|
| `--id <id>`                   | ID.                                                                                     | No       |
| `--db <db>`                   | DB instance name.                                                                       | No       |
| `-l`, `--language <language>` | Language.                                                                               | No       |
| `-e`, `--editor <editor>`     | Editor (default: "nvim").                                                               | No       |
| `-c`, `--cluster <cluster>`   | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`           | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`   | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`           | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>`  | API Key generated on Based.io for Service Account.                                      | No       |


### secrets [not-ready]
*Example:* `npx @based/cli secrets [sub-command][options]`

#### set
| Option                       | Description                                                                             | Required |
|------------------------------|-----------------------------------------------------------------------------------------|----------|
| `-k`, `--key <key>`          | Key.                                                                                    | No       |
| `-v`, `--value <value>`      | Value.                                                                                  | No       |
| `-c`, `--cluster <cluster>`  | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`          | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`  | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`          | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>` | API Key generated on Based.io for Service Account.                                      | No       |


#### get
| Option                       | Description                                                                             | Required |
|------------------------------|-----------------------------------------------------------------------------------------|----------|
| `-k`, `--key <key>`          | Key.                                                                                    | No       |
| `-c`, `--cluster <cluster>`  | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`          | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`  | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`          | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>` | API Key generated on Based.io for Service Account.                                      | No       |


### query [not-ready]
*Example:* `npx @based/cli query [options]`

| Option                        | Description                                                                             | Required |
|-------------------------------|-----------------------------------------------------------------------------------------|----------|
| `--id <id>`                   | Query ID.                                                                               | Yes      |
| `--db <db>`                   | DB instance name.                                                                       | No       |
| `-n`, `--name <name>`         | Name.                                                                                   | No       |
| `-w`, `--watch`               | Watch for changes (default: false).                                                     | No       |
| `-t`, `--type <type>`         | Type.                                                                                   | No       |
| `-l`, `--language <language>` | Language.                                                                               | No       |
| `-f`, `--fields <fields>`     | Fields.                                                                                 | No       |
| `-r`, `--limit <limit>`       | Limit.                                                                                  | No       |
| `-c`, `--cluster <cluster>`   | Define the cluster to use (default: "production").                                      | No       |
| `-o`, `--org <org>`           | Specify the organization.                                                               | No       |
| `-p`, `--project <project>`   | Specify the project name.                                                               | No       |
| `-e`, `--env <env>`           | Specify witch environment (can be a name or "#branch" if you want to deploy by branch). | No       |
| `-aK`, `--api-key <api-key>`  | API Key generated on Based.io for Service Account.                                      | No       |