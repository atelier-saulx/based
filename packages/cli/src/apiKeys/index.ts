import { program, Argument } from 'commander'
import { command, GlobalOptions } from '../command'
import { fail, printHeader } from '../tui'
import checkAuth from '../checkAuth'
import makeClient from '../makeClient'
import { ls } from './ls'
import { add } from './add'
import { remove } from './remove'
import { download } from './download'
import { makeConfig } from '../makeConfig'

export type ApiKeysOptions = GlobalOptions & {
  name?: string
  file?: string
}

export type ApiKeyData = {
  id: string
  name: string
  token?: string
  updatedAt?: number
}

command(
  program
    .command('apiKeys')
    .option('--name <name>', 'Name of apiKey')
    .option('--file <file>', 'Filepath to save the apiKey')
    .addArgument(
      new Argument('<subcommand>', 'apiKeys subcommand').choices([
        'ls',
        'add',
        'remove',
        'download',
      ])
    )
).action(
  async (
    subcommand: 'ls' | 'add' | 'remove' | 'download',
    options: ApiKeysOptions
  ) => {
    const config = await makeConfig(options)

    printHeader(options, config)

    const token = await checkAuth(options)
    const client = makeClient(config.cluster)

    try {
      await client.auth(token)
    } catch (error) {
      fail(error, { data: [] }, options)
    }

    if (subcommand === 'ls') {
      await ls({ client, options, config })
    } else if (subcommand === 'add') {
      await add({ client, options, config })
    } else if (subcommand === 'remove') {
      await remove({ client, options, config })
    } else if (subcommand === 'download') {
      await download({ client, options, config })
    }

    process.exit(0)
  }
)
