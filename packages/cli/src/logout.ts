import { program } from 'commander'
import { emptyDir } from 'fs-extra'
import ora from 'ora'
import getToken from './getToken'
import makeClient from './makeClient'
import getBasedLocation from './getBasedLocation'
import { command, GlobalOptions } from './command'
import {
  fail,
  prefixSuccess,
  printEmptyLine,
  printError,
  printHeader,
} from './tui'
import { GenericOutput } from './types'
import { makeConfig } from './makeConfig'

type Logout = GenericOutput & {
  data: {
    email: string
  }[]
}

command(program.command('logout').description('Logout')).action(
  async (options: GlobalOptions) => {
    const config = await makeConfig(options)
    printHeader(options, config)

    const output: Logout = { data: [] }

    const { token } = await getToken(config.cluster)

    if (!token) {
      fail('Not logged in.', output, options)
    }

    const p = getBasedLocation(config.cluster)

    await emptyDir(p)

    const client = makeClient(config.cluster)

    client.auth(token)

    let spinner: ora.Ora
    try {
      if (options.output === 'fancy') {
        spinner = ora('Logging out').start()
      }
      await client.call('logout', {
        token,
      })
      spinner && spinner.clear()

      if (options.output === 'fancy') {
        printEmptyLine()
        console.info(prefixSuccess + 'Logged out.')
      }
      process.exit(0)
    } catch (err) {
      spinner && spinner.clear()
      options.debug && printError(err)
      fail('Error loggin out.', output, options)
    }
  }
)
