import { Command } from 'commander'
import { join } from 'node:path'
import { readJSON, outputJSON } from 'fs-extra/esm'
import { input, select } from '@inquirer/prompts'

import { homedir } from 'node:os'
import { getBasedClient } from './getBasedClient.js'
import pc from 'picocolors'
import { BasedClient } from '@based/client'
import { spinner } from './spinner.js'

const persistPath = join(homedir(), '.based/cli')
const authPath = join(persistPath, 'auth.json')

export const login = async (
  program: Command,
  selectUser?: boolean,
): Promise<{ client: BasedClient; admin: BasedClient; destroy(): void }> => {
  const { cluster, org, env, project } = program.opts()
  const admin = getBasedClient({
    org: 'saulx',
    env: 'platform',
    project: 'based-cloud',
    name: '@based/admin-hub',
    cluster,
  })

  await admin.once('connect')

  let users: {
    email: string
    userId: string
    token: string
    ts: number
  }[] = await readJSON(authPath).catch(() => [])

  let user

  if (users.length) {
    const lastUser = users.sort((a, b) => b?.ts - a?.ts)[0]
    await admin
      .setAuthState({
        ...lastUser,
        type: 'based',
      })
      .then(() => {
        user = lastUser
      })
      .catch(() => {
        users = users.filter((user) => user !== lastUser)
      })

    if (selectUser && users.length) {
      const choices = users.map((user) => ({ name: user.email, value: user }))
      choices.push({
        name: 'other user',
        value: null,
      })

      user = await select({
        message: 'select user',
        choices,
      })
    }
  }

  if (!user) {
    const email = await input({
      message: 'enter email address',
      validate(email) {
        const at = email.lastIndexOf('@')
        const dot = email.lastIndexOf('.')
        return at > 0 && at < dot - 1 && dot < email.length - 2
      },
    })

    const code = (~~(Math.random() * 1e6)).toString(16)
    spinner.text = `verify ${pc.bold(email)} with code ${pc.bold(code)}`
    spinner.start()

    await admin.call('login', {
      email,
      skipEmailForTesting: cluster === 'local',
      code,
    })

    spinner.succeed('verified')

    user = await admin.once('authstate-change')
    user.email = email

    users = users.filter(({ email }) => email !== user.email)
    users.push(user)
  }

  // update users with updated timestamp
  user.ts = Date.now()
  await outputJSON(authPath, users)

  const client = getBasedClient({
    cluster,
    org,
    env,
    project,
  })

  await client.setAuthState(admin.authState)

  console.info(`🧑 ${user.email}`)

  return {
    client,
    admin,
    destroy() {
      client.destroy()
      admin.destroy()
    },
  }
}
