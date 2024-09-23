import { join } from 'node:path'
import { readJSON, outputJSON } from 'fs-extra/esm'
import { homedir } from 'node:os'
import { getBasedClient } from './getBasedClient.js'
import { AuthState, BasedClient } from '@based/client'
import AppContext, { SelectInputItems } from './AppContext.js'

type User = {
  email: string
  userId?: string
  token?: string
  ts?: number
}

type LoginArgs = {
  context: AppContext
  email?: string
  cluster: string
  org: string
  env: string
  project: string
  selectUser?: boolean
}

type LoginReturn = {
  client: BasedClient
  adminHub: BasedClient
  envHub: BasedClient
  destroy: () => void
}

type AuthenticateUserReturn = AuthState & {
  email: string
}

const persistPath: string = join(homedir(), '.based/cli')
const authPath: string = join(persistPath, 'Auth.json')

const authenticateUser = async (
  email: string,
  hub: BasedClient,
  cluster: string,
  context: AppContext,
): Promise<AuthenticateUserReturn> => {
  const code: string = (~~(Math.random() * 1e6)).toString(16)
  context.print.loading(
    `Please check your inbox at '<b>${email}</b>', your login code is: '<b>${code}</b>'`,
  )

  await hub.call('login', {
    email,
    skipEmailForTesting: cluster === 'local',
    code,
  })

  context.print.success("Email verified. Welcome, let's rock!")

  return {
    ...(await hub.once('authstate-change')),
    email,
  }
}

export const login = async ({
  context,
  email,
  cluster,
  org,
  env,
  project,
  selectUser,
}: LoginArgs): Promise<LoginReturn> => {
  const adminHub: BasedClient = getBasedClient(context, {
    org: 'saulx',
    env: 'platform',
    project: 'based-cloud',
    name: '@based/admin-hub',
    cluster,
  })

  if (!Object.keys(adminHub).length) {
    context.print.fail(
      'Fatal error during authorization, was not possible to connect to the Admin Hub. Try again.',
    )
  }

  await adminHub.once('connect')

  let users: User[] = await readJSON(authPath).catch(() => [])
  let user: User

  if (email) {
    user = await authenticateUser(email, adminHub, cluster, context)

    users = users.filter(({ email }) => email !== user.email)
    users.push(user)
  }

  if (users.length && !email) {
    const lastUser: User = users.sort((a: User, b: User) => b?.ts - a?.ts)[0]
    await adminHub
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
      const choices: SelectInputItems[] = users.map((user) => ({
        name: user.email,
        value: user,
      }))
      choices.push({
        name: 'Other user',
        value: null,
      })

      user = await context.input.select('Select user:', choices, false, false)
    }
  }

  if (!user && !email) {
    const email: string = await context.input.email('Enter your email address:')

    user = await authenticateUser(email, adminHub, cluster, context)

    users = users.filter(({ email }) => email !== user.email)
    users.push(user)
  }

  user.ts = Date.now()
  await outputJSON(authPath, users)

  const client: BasedClient = getBasedClient(context, {
    cluster,
    org,
    env,
    project,
  })

  if (!Object.keys(client).length) {
    context.print.fail(
      'Fatal error during authorization, was not possible to connect to the User Env. Try again.',
    )
  }

  await client.once('connect')

  await client.setAuthState({
    ...adminHub.authState,
    type: 'based',
  })

  const envHub: BasedClient = getBasedClient(context, {
    cluster,
    org,
    env,
    project,
    key: 'cms',
    optionalKey: true,
  })

  if (!Object.keys(envHub).length) {
    context.print.fail(
      'Fatal error during authorization, was not possible to connect to the Env Hub. Try again.',
    )
  }

  await envHub.once('connect')

  await envHub.setAuthState({
    ...adminHub.authState,
    type: 'based',
  })

  context.print.success(`User: '${user.email}' logged in successfully!`, '👨‍🦱')

  return {
    client,
    adminHub,
    envHub,
    destroy() {
      client.destroy()
      adminHub.destroy()
      envHub.destroy()
    },
  }
}
