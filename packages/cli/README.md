# Based CLI

Based CLI allows to control your based account from the command line.

- [Global Arguments](#global-arguments)
- [Configuration file](#configuration-file)
- [Authentication](#authentication)
- Commands
	- [`login`](#login)
	- [`deploy`](#deploy)
	- [`logs`](#logs)
	- [`envs`](#envs)

## Global Arguments

| Argument                       | Description                                          |       |                                  |
|--------------------------------|------------------------------------------------------|-------|----------------------------------|
| `--help`                       | Display global help or help for a command.           |       |                                  |
| `--cluster <cluster>`          | Cluster URL overide.                                 |       |                                  |
| `--org <org>`                  | Organization name overide.                           |       |                                  |
| `-p, --project <project>`      | Project name overide.                                |       |                                  |
| `-e, --env <env>`              | Environment name overide.                            |       |                                  |
| `-b, --based-file <basedFile>` | Location of your [configuration file]().             |       |                                  |
| `-d, --debug`                  | Show more descritive errors and debug information.   |       |                                  |
| `-k, --api-key <apiKey>`       | Authenticate using an [apiKey]() from file.          |       |                                  |
| `-H, --no-header`              | Don't show the header. Useful for chaining commands. |       |                                  |
| `-o, --output fancy            | json                                                 | none` | Output type. Defaults to `fancy` |


## Configuration file

Based CLI tries to find a configuration file with the name `based.json` or `based.js` in your current folder. It will walk up to the root folder of your project or up to your home folder if it cannot find it.
If a based file does not exist, the CLI will offer to save a new file.
The configuration file stores the organization, project and env to be used. It should either be an json file or if it's a javascript file, it will parse it expecting it to export an object with the properties bellow.

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
| `cluster` | Cluster URL (optional). |


## Authentication

In order to use the cli you need to be authenticated with the based cluster.
Two options are available: email authentication or API Key authentication. The former is easiest for normal use and the later is intended to use with non interactive scripts.

To authenticate use the `login` command with your email as the argumennt. The command will pause and an email with an authentication link is sent to your address. On your email client in any device you just need to click the email link it will notify the CLI and authenticate you authomatically. No password is involved.

*NOTE: Based authentication emails use a three word token in the subject as a security feature. Make sure the words in the prompt match the email subject. Never click the link on an authentication email that does not match these three words.*

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

After clicking the link the cli will log you in authomatically and save a token in a `~/.based` on your home folder.

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

### `deploy`

This is a dual command meant to update your schema changes and functions in one go.
The command searches your project folder for files that match the standard schema file name and function folder format and shows you a summary of the changes updates about to happen. By default it will show you the found files and ask if you want to update the schema, the functions or both, but this can be ovrriden and made non interactive using the `--schema` and `--functions` arguments.

Schema files are a json file with and object containing a `schema` property with a [schema definition](https://github.com/atelier-saulx/based-docs/blob/main/docs/schema.md). Multiple databases can be updated at the same time using an an array of objects containing the `schema` property and an additional `db` property witht he database name.
Javascript or typescript files can also be used. In this case they should export and object or array just like the json file.
By standard schema files should be named `based.schema.json` (or `.js`/`.ts` in the case of javascript or typescript. The deploy command will search your project folders for these files. You can also specify the location (and name) of your schema file usign the `-f` variadic argument.

Functions should be located each in its own folder with a `based.config.js` file. The deploy command will search for this pattern.
If you use dependencies, there should also be a `package.json` file alongside the function. This will allow the function to be bundled with its dependencies.

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

### `logs`
