import { program, Argument } from 'commander'
import { command, GlobalOptions } from '../command'
import checkAuth from '../checkAuth'
import makeClient from '../makeClient'
import { fail, printHeader } from '../tui'
import { ls } from './ls'
import { remove } from './remove'
import { add } from './add'
import { makeConfig } from '../makeConfig'

command(
  program
    .command('envs')
    .addArgument(
      new Argument('<command>', 'envs command').choices(['ls', 'add', 'remove'])
    )
).action(async (command: 'ls' | 'add' | 'remove', options: GlobalOptions) => {
  const config = await makeConfig(options)
  printHeader(options, config)

  // prob make something like db as a sub command
  // or reset

  // if LS will use your email check which orgs you are part of

  // if it does not exits create a new one

  let isLs = false
  let isAdd = false
  let isRemove = false

  if (command === 'add') {
    isAdd = true
  } else if (command === 'ls') {
    isLs = true
  } else if (command === 'remove') {
    isRemove = true
  }

  const token = await checkAuth(options)
  const client = makeClient(config.cluster)
  try {
    if (options.apiKey) {
      await client.auth(token, { isApiKey: true })
    } else {
      await client.auth(token)
    }
  } catch (error) {
    fail(error, { data: [] }, options)
  }

  if (isRemove) {
    await remove({ client, options, config })
  } else if (isLs) {
    await ls({ client, options })
  } else if (isAdd) {
    await add({ client, options, config })
  }

  process.exit()
})
