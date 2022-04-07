import { program } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { ensureDir, writeJSON } from 'fs-extra'
import { join } from 'path'
import makeClient from './makeClient'
import getBasedLocation from './getBasedLocation'
import { GenericOutput } from './types'
import {
  printEmptyLine,
  prefixNotice,
  fail,
  prefix,
  prefixSuccess,
  printError,
  printHeader,
} from './tui'
import { command, GlobalOptions } from './command'
import { makeConfig } from './makeConfig'

type LoginOutput = GenericOutput & {
  data: {
    email: string
  }[]
}

export const innerAuth = async (
  email: string,
  options: GlobalOptions
): Promise<string | null> => {
  const config = await makeConfig(options)

  const output: LoginOutput = { data: [] }

  if (!email) {
    fail('Need a valid email adress to authenticate.', output, options)
  }
  if (options.nonInteractive) {
    fail(
      'Login command not available in non interactive mode.',
      output,
      options
    )
  }

  const client = makeClient(config.cluster)

  try {
    const code = await client.call('preauth', {
      email,
    })

    printEmptyLine()
    console.info(prefix + 'Logging in.')
    console.info(prefixNotice + `We sent an email to ${chalk.blue(email)}.`)
    console.info(
      prefixNotice + `Please follow the steps provided inside it and`
    )
    console.info(
      prefixNotice + `make sure the message contains ${chalk.blue(code)}.`
    )

    const spinner = ora('Waiting for confirmation').start()

    const token = await client.call('auth', {
      email,
      code,
    })
    spinner.stop()

    if (!token) {
      fail('Error authenticating verification timedout.', output, options)
    } else {
      const p = getBasedLocation(config.cluster)

      await ensureDir(p)

      await writeJSON(join(p, 'user.json'), {
        token,
        email,
      })

      printEmptyLine()
      console.info(
        prefixSuccess + `Successfully authenticated as ${chalk.blue(email)}.`
      )

      // @ts-ignore
      return token
    }
  } catch (err) {
    options.debug && printError(err)
    fail('Error authenticating.', output, options)
  }
}

command(
  program.command('login <email>').description('Authenticate using email')
).action(async (email: string, options: GlobalOptions) => {
  const config = await makeConfig(options)
  printHeader(options, config)

  await innerAuth(email, options)
  process.exit()
})
