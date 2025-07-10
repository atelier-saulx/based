import * as readline from 'node:readline/promises'
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from 'unique-names-generator'
import { email as validEmail } from '@saulx/validators'
import { bold, printError } from './tui.js'
import { getBasedClient } from './getBasedClient.js'
import { BasedClient, BasedOpts } from '@based/client'
import { program } from './index.js'

export const login = async () => {
  const { platformDiscoveryUrl } = program.optsWithGlobals()

  const basedClient = await getBasedClient()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  rl.on('SIGINT', function () {
    process.exit(1)
  })
  const answer = await rl.question(`Enter your email address to login: `)
  if (!validEmail(answer)) {
    console.error('Please enter a valid email.')
    process.exit(1)
  }
  const email = answer
  rl.close()

  const code = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: ' ',
    style: 'capital',
  })

  console.info(`Logging in.
We sent an email to ${bold(email)}.
Please follow the steps provided inside it and
make sure the message contains the code ${bold(code)}.
Waiting for confirmation...`)

  const opts: BasedOpts = {
    org: 'saulx',
    project: 'based-cloud',
    env: 'platform',
    name: '@based/admin-hub',
    cluster: basedClient.opts.cluster,
  }
  if (platformDiscoveryUrl) {
    opts.discoveryUrls = [platformDiscoveryUrl]
  }
  const adminHubClient = new BasedClient(opts)

  const loginResult = await adminHubClient.call('login', {
    email,
    code,
  })
  console.log({ loginResult })

  adminHubClient.destroy()

  if (loginResult?.result?.error) {
    printError('Issue trying to login', loginResult.result.error)
    process.exit(1)
  }
  await basedClient.setAuthState({
    ...loginResult,
    type: 'based',
  })
  await new Promise((resolve) => setTimeout(resolve, 200))

  console.info('Succesfully logged in')

  return basedClient
}
