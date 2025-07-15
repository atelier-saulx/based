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
    dev       Run in development mode
    init      Initialize a new project
    status    Show status of the project
    logout    Logout from the project

  Options
    --no-cloud  Do not use cloud

  Examples
    $ @based/cli --no-cloud
`,
  {
    importMeta: import.meta,
    flags: {
      noCloud: {
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
    },
  },
)

const command: Props['command'] = cli.input[0] as Props['command']

const opts: Opts = {
  noCloud: cli.flags.noCloud,
}

render(<App opts={opts} command={command ?? 'status'} />)
