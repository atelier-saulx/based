#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import meow from 'meow'
import App from './app.js'
import { Opts, Props } from './types.js'
import { decodeAuthState } from '@based/client'
import { withFullScreen } from 'fullscreen-ink'

const cli = meow(
  `
	Usage
	  $ @based/cli [options]

  Commands
    deploy     Deploy to the online environment
    dev        Run in local development mode
    init       Initialize a new project
    status     Show status & logs
    secrets    Set/get secrets. Use subcommand 'set'/'get'
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
    --cwd       Override the cwd of the project
    --hub       Use hub url
    --name, -k  Name of secret to get/set
    --value, -v Value of secret to set
    
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
      force: {
        type: 'boolean',
      },
      hub: {
        type: 'string',
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
      org: {
        type: 'string',
      },
      token: {
        type: 'string',
        alias: 't',
      },
      url: {
        type: 'string',
      },
      cwd: {
        type: 'string',
        default: process.cwd(),
      },
      name: {
        type: 'string',
        shortFlag: 'k',
      },
      value: {
        type: 'string',
        shortFlag: 'v',
      },
    },
  },
)

const command: Props['command'] = cli.input[0] as Props['command']
const args: string[] = cli.input.slice(1)

const opts: Opts = {
  noCloud: cli.flags.noCloud,
  env: cli.flags.env,
  cluster: cli.flags.cluster,
  project: cli.flags.project,
  url: cli.flags.url,
  force: cli.flags.force,
  watch: cli.flags.watch,
  cwd: cli.flags.cwd,
  org: cli.flags.org,
  hub: cli.flags.hub,
  name: cli.flags.name,
  value: cli.flags.value,
  args,
}

if (cli.flags.token) {
  try {
    opts.token = JSON.parse(cli.flags.token)
  } catch (err) {
    opts.token = decodeAuthState(cli.flags.token)
  }
}

if (command === 'dev' || command === 'deploy' || command === 'secrets') {
  render(<App opts={opts} command={command ?? 'status'} />)
} else {
  withFullScreen(<App opts={opts} command={command ?? 'status'} />).start()
}
