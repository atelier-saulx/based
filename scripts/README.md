# Version Bumper

A command-line script for automating package versioning in @Based monorepo.

This tool inspects your local packages, compares them against the versions published on NPM, and automatically bumps versions for packages that have changed. It also updates all interdependent `package.json` files across the workspace to ensure versions stay in sync.

## Features

- **Smart Change Detection**: Uses a "diff system" by packing local code and comparing it against the published NPM tarball to only bump versions when there are actual code changes.
- **Flexible Targeting**: Bump all changed packages at once or target specific packages by name.
- **Semantic Versioning**: Bumps versions according to `major`, `minor`, or `patch` rules.
- **Release Channels**: Supports `release` (latest) and `alpha` release types, with logic to promote from alpha to release.
- **Dependency Management**: Automatically finds and updates dependencies across all packages in the workspace to use the new versions.
- **Handles Unpublished Packages**: If a package is not yet on NPM, it correctly uses the local `package.json` version as the baseline.
- **Force Bumping**: Includes an option to bypass the diff check and force a version bump.

## Setup

1.  **Install Dependencies**: Navigate into the script's directory and install its dependencies.
    ```bash
    cd scripts
    npm install
    ```

## Usage

All commands should be run from the **script folder**. The script uses an `npm` script as a runner to handle compilation.

The base command is `npm run bump -- ...args`. The `--` is important as it separates `npm` options from the arguments you want to pass to the script.

### Examples

**1. Standard Patch Release for All Changed Packages**
This is the most common use case. It checks every package, and for those with changes, it applies a patch version bump.

```bash
npm run bump -- --all --change=patch
```

**2. Bumping Specific Packages to a Minor Alpha Version**
This is useful when working on a new feature in a few packages. Package names can be scoped as `@based/schema` of not as in `schema`.

```bash
npm run bump -- --packages=protocol,schema --change=minor --tag=alpha
```

**3. Promoting an Alpha Version to a Stable Release**
If a package has a version like `1.2.4-alpha.0` published, this command will promote it to `1.2.4`.

```bash
npm run bump -- --all --change=patch --tag=release
```

_(Note: `change` is still mandatory but is ignored for promotions.)_

**4. Forcing a Major Version Bump on a Specific Package**
This command will bump the version of `@Based/schema` without checking for any file changes.

```bash
npm run bump -- --packages=@Based/schema --change=major --force
```

## Command-Line Arguments

| Argument     | Description                                                                                                                 | Required | Example                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------ |
| `--all`      | Process all non-private packages in the workspace. Cannot be used with `--packages`.                                        | Yes\*    | `--all`                  |
| `--packages` | A comma-separated list of specific package names to process. Can use the scope `@Based`or not. Cannot be used with `--all`. | Yes\*    | `--packages=pkg-a,pkg-b` |
| `--change`   | The type of semantic version bump to apply.                                                                                 | **Yes**  | `--change=minor`         |
| `--tag`      | The release channel. Defaults to `release`. Use `alpha` for pre-releases.                                                   | No       | `--tag=alpha`            |
| `--force`    | Bypasses the diff check and forces a version bump on the targeted packages. Alias: `--no-diff`.                             | No       | `--force`                |

_\*You must provide either `--all` or `--packages`._
