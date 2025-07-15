#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import meow from 'meow'
import App from './app.js'
import { Opts } from './types.js'

const cli = meow(
  `
	Usage
	  $ @based/cli [options]

	Options
		--dev       Run in development mode
		--no-cloud  Do not use cloud
		--init      Initialize a new project
		--status    Show status of the project

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
    },
  },
)

const command = cli.flags.dev ? 'dev' : cli.flags.init ? 'init' : 'status'

const opts: Opts = {
  noCloud: cli.flags.noCloud,
}
render(<App opts={opts} command={command} />)
