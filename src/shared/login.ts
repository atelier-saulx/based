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

type LoginArgs = {
  cluster: string
  org: string
  env: string
  project: string
  selectUser?: boolean
}

type User = {
  email: string
  userId?: string
  token?: string
  ts?: number
}

export const login = async ({
  cluster,
  org,
  env,
  project,
  selectUser,
}: LoginArgs): Promise<{
  client: BasedClient
  admin: BasedClient
  destroy(): void
}> => {
  const hub = getBasedClient({
    org: 'saulx',
    env: 'platform',
    project: 'based-cloud',
    name: '@based/admin-hub',
    cluster,
  })

  await hub.once('connect')

  let users: User[] = await readJSON(authPath).catch(() => [])
  let user: User

  if (users.length) {
    const lastUser: User = users.sort((a: User, b: User) => b?.ts - a?.ts)[0]
    await hub
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

    if (selectUser) {
      const choices = users.map((user) => ({ name: user.email, value: user }))
      choices.push({
        name: 'Other user',
        value: null,
      })

      user = await select({
        message: 'Select user:',
        choices,
      })
    }
  }

  if (!user) {
    const email = await input({
      message: 'Enter your email address:',
      validate(email) {
        const at = email.lastIndexOf('@')
        const dot = email.lastIndexOf('.')
        return at > 0 && at < dot - 1 && dot < email.length - 2
      },
    })

    const code = (~~(Math.random() * 1e6)).toString(16)
    spinner.text = `Please check your inbox at '${pc.bold(email)}', your login code is: ${pc.bold(code)}`
    spinner.start()

    await hub.call('login', {
      email,
      skipEmailForTesting: cluster === 'local',
      code,
    })

    spinner.succeed('Email verified!')

    user = {
      ...(await hub.once('authstate-change')),
      email,
    }

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

  await client.setAuthState({
    ...hub.authState,
    type: 'based',
  })

  spinner.succeed(`🧑 User: '${user.email}' logged in successfully!`)

  return {
    client,
    admin: hub,
    destroy() {
      client.destroy()
      hub.destroy()
    },
  }
}
