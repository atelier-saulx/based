# Based CLI

## 🔗 Links
- [GitHub](https://github.com/atelier-saulx/based#readme)

---

## Concept

	- There should be two main modes: interactive and non-interactive.
	- Items that should be clearly visible when the command runs:
		- cli version
		- cluster, org, project, env
		- command being run
 	- Different steps in the command should be clear with some kind of separator.
	- When needed should authenticate the user first.
	- Main arguments should be confirmed with inputs, and prepopulated in case they exist.

## Syntax

	`based [...global arguments] command [...command arguments]`

## Global arguments

	- `--non-interactive`: Run in non interactive mode. Also infered from isTTY.
	- `--org <org>`: Org
	- `-p, --project <project>`: Project
	- `-e, --env <env>`
	- `--cluster <cluster>`: Cluster
	- `-b, --based-file <basedFile>: Path to based config file. Defualts to `based.json` in the current folder
	- `-d, --debug`: Show debug information
	- `-o, --output-type <output-type>`: Output type: `fancy` (default), `json`

## Commands

### `envs <action>`

Manage environments in the cluster.

Actions:

	- `ls`: List envs
	- `add`: Add and environment
	- `remove`: Remove an environment

#### `ls` action

Flow:

	- get cluster
	- authenticate user
	- list existing envs

#### `add` action

Flow:

	- get cluster, org, project, env from file or arguments
	- ask for env name if not in based file or arguments
	- create env
	- (?)

---

## License

Licensed under the MIT License.

See [LICENSE](./LICENSE) for more information.
