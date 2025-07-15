#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import meow from 'meow'
import App, { Props } from './app.js'
import { Opts } from './types.js'

const cli = meow(
  `
	Usage
	  $ @based/cli [options]

  Commands
    deploy     Deploy to the online environment
    dev        Run in local development mode
    init       Initialize a new project
    status     Show status & logs
    logout     Logout from the cloud

  Options
    --no-cloud  Do not use cloud
    --watch     Watch for changes and redeploy (only for deploy)
    --force     Force a reload of the app functions (only for deploy)
    --env       Set the environment
    --cluster   Set the cluster
    --project   Set the project
    --token     User api token
    --url       Use a custom discovery url

  Examples
    $ @based/cli deploy --watch --force
`,
  {
    importMeta: import.meta,
    flags: {
      noCloud: {
        type: 'boolean',
      },
      watch: {
        type: 'boolean',
      },
      dev: {
        type: 'boolean',
      },
      init: {
        type: 'boolean',
      },
      logout: {
        type: 'boolean',
      },
      force: {
        type: 'boolean',
      },
      env: {
        type: 'string',
      },
      cluster: {
        type: 'string',
      },
      project: {
        type: 'string',
      },
      token: {
        type: 'string',
      },
      url: {
        type: 'string',
      },
    },
  },
)

const command: Props['command'] = cli.input[0] as Props['command']

const opts: Opts = {
  noCloud: cli.flags.noCloud,
  env: cli.flags.env,
  cluster: cli.flags.cluster,
  project: cli.flags.project,
  token: cli.flags.token,
  url: cli.flags.url,
  force: cli.flags.force,
  watch: cli.flags.watch,
}

render(<App opts={opts} command={command ?? 'status'} />)
