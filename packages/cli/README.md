# Based CLI

Based CLI allows control of functions available in the Based dashboard UI account from the convenience of the command line and script repetitive actions like deploying functions and schema changes.

- [Global Arguments](#global-arguments)
- [Configuration file](#configuration-file)
- [Authentication](#authentication)
- Commands
	- [`login`](#login)
	- [`logout`](#logout)
	- [`deploy`](#deploy)
	- [`apiKeys`](#apiKeys)
	- [`secrets`](#secrets)

## Global Arguments

| Argument                       | Description                                          |       |                                  |
|--------------------------------|------------------------------------------------------|-------|----------------------------------|
| `--help`                       | Display global help or help for a command.           |       |                                  |
| `--org <org>`                  | Organization name overide.                           |       |                                  |
| `-p, --project <project>`      | Project name overide.                                |       |                                  |
| `-e, --env <env>`              | Environment name overide.                            |       |                                  |
| `-b, --based-file <basedFile>` | Location of your [configuration file]().             |       |                                  |
| `-d, --debug`                  | Show more descritive errors and debug information.   |       |                                  |
| `-k, --api-key <apiKey>`       | Authenticate using an [apiKey]() from file.          |       |                                  |
| `-H, --no-header`              | Don't show the header. Useful for chaining commands. |       |                                  |
| `-o, --output fancy            | json                                                 | none` | Output type. Defaults to `fancy` |


## Configuration file

Based CLI tries to find a configuration file named `based.json` or `based.js` in your current folder. It will walk up to the root folder of your project or up to your home folder if it cannot find it.
If a based file does not exist, the CLI will offer to save a new file.
The configuration file stores the organization, project, and env that the CLI connects. The config file can be a JSON file or a javascript file, in which case it will execute it, expecting to export an object with the properties below.

#### Example:
```json
{
  "org": "saulx",
  "project": "hello",
  "env": "dev"
}
```

#### Configuration object properties
| Property  | Description             |
|-----------|-------------------------|
| `org`     | Organization name.      |
| `project` | Project name.           |
| `env`     | Environment name.       |


## Authentication

You need to be authenticated with your Based account to use the CLI.
Two options are available: email authentication or API Key authentication. The former is easiest for regular use, and the latter is meant to be used with non-interactive scripts.

Use the `login` command with your email as the argument to authenticate. The command will pause, and an email with an authentication link will be sent to your address. From any device, you need to click the link in the confirmation email you receive. It will notify the CLI and authenticate you automatically. No password is involved.

*NOTE: Based authentication emails use a three-word token in the message subject as a security feature. Make sure the words in the prompt match the ones in the email subject. Never click the link on an authentication email that does not match these three words.*

```text
$ npx based login my@email.com
 _                        _
| |                      | |
| |__   __ _ ___  ___  __| |
| '_ \ / _` / __|/ _ \/ _` |
| |_) | (_| \__ \  __/ (_| |
|_.__/ \__,_|___/\___|\__,_|
                  CLI v0.8.1

┃ Org: saulx Project: hello Env: dev
┃
┃ Logging in.
┃ We sent an email to nuno@saulx.com.
┃ Please follow the steps provided inside it and
┃ make sure the message contains Scattered Gray Weasel.
⠦ Waiting for confirmation
```

After clicking the link, the CLI will log you in automatically and save a token in a `~/.based` on your home folder.

## Commands

### `login`

Authenticates the CLI with your project.
See [Authentication](#authentication) for more details.

| Argument  | Description |
|-----------|-------------|
| `<email>` | Your email. |

Example:
```bash
$ npx based login your@email.com
```

### `logout`

Logout the CLI from your accout.

Example:
```bash
$ npx based logout
```
### `deploy`

The `deploy` command updates your schema changes and functions in one go.
The command searches your project folder for files that match the standard schema file name and function folder format and shows you a summary of the changes updates about to happen. By default, it will show you the files found and ask if you want to update the schema, the functions, or both. It can also be non-interactive when the `--schema` and `--functions` arguments are used.

Schema files are JSON files with an object containing a `schema` property with a [schema definition](https://github.com/atelier-saulx/based-docs/blob/main/docs/schema.md). Multiple databases can be updated simultaneously using an array of objects containing the `schema` property and an additional `db` property with the database name.
Javascript or typescript files can also be used. In this case, they should export an object or array just like the JSON file.
By standard, schema files should be named `based.schema.json` (or `.js`/`.ts` in the case of javascript or typescript). The deploy command will search your project folders for these files, but you can also specify the location and name of your schema file using the `-f` variadic argument.

Functions should be located in their own folder with a `based.config.js` file. The deploy command will search for this pattern to find the functions to be deployed.
If you use dependencies, there should also be a `package.json` file alongside the function so it can be correctly bundled.

```
 ── functions
    ├── aFunction
    │   ├── based.config.js
    │   └── index.ts
    ├── anotherFunction
    │   ├── based.config.js
    │   └── index.ts
    └── functionWithDependencies
        ├── based.config.js
        ├── index.ts
        └── package.json
```

| Argument                  | Description                             |
|---------------------------|-----------------------------------------|
| `--schema`                | Sets deploy shema option.               |
| `-f, --file <schemaFile>` | Location of the schema file. (Variadic) |
| `--functions`             | Sets deploy functions option.           |

Example:
```bash
$ npx based deploy --functions --schema -f ./schema.json
```

### `apiKeys`

Manages apiKeys.

| Subcommand | Description         |
|------------|---------------------|
| `ls`       | List apiKeys.       |
| `add`      | Add apiKey.         |
| `remove`   | Remove an apiKey.   |
| `download` | Download an apiKey. |

### `secrets`

Manages your secrets feature in based.

| Argument              | Description                                          |
|-----------------------|------------------------------------------------------|
| `-f, --file <file>`   | Add a secret to an organization from a file.         |
| `-v, --value <value>` | Add a secret to an organization from a value inline. |
| `-D, --delete`        | Delete a secret from an organization. (Interactive)  |
