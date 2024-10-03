import { join } from 'node:path'
import { readJSON, outputJSON } from 'fs-extra/esm'
import { homedir } from 'node:os'
import { getBasedClient } from './getBasedClient.js'
import { BasedClient } from '@based/client'
import { AppContext } from './AppContext.js'

const persistPath: string = join(homedir(), '.based/cli')
const authPath: string = join(persistPath, 'Auth.json')

const authenticateUser = async (
  email: string,
  hub: BasedClient,
  cluster: string,
  context: AppContext,
): Promise<BasedCli.Auth.AuthenticatedUser> => {
  const code: string = (~~(Math.random() * 1e6)).toString(16)
  context.print.loading(
    `Please check your inbox at '<b>${email}</b>', your login code is: '<b>${code}</b>'`,
  )

  await hub.call('login', {
    email,
    skipEmailForTesting: cluster === 'local',
    code,
  })

  context.print.stop().success("Email verified. Welcome, <b>let's rock!</b> 🔥")

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
}: BasedCli.Auth.Login): Promise<BasedCli.Auth.Clients> => {
  const adminHub: BasedClient = getBasedClient(context, {
    org: 'saulx',
    env: 'platform',
    project: 'based-cloud',
    name: '@based/admin-hub',
    cluster,
  })

  if (!Object.keys(adminHub).length) {
    throw new Error(
      'Fatal error during authorization, was not possible to connect to the Admin Hub. Try again.',
    )
  }

  await adminHub.once('connect')

  let users: BasedCli.Auth.User[] = await readJSON(authPath).catch(() => [])
  let user: BasedCli.Auth.User

  if (email) {
    user = await authenticateUser(email, adminHub, cluster, context)

    users = users.filter(({ email }) => email !== user.email)
    users.push(user)
  }

  if (users.length && !email) {
    const lastUser: BasedCli.Auth.User = users.sort((a, b) => b?.ts - a?.ts)[0]
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
      const choices: BasedCli.Context.SelectInputItems[] = users.map(
        (user) => ({
          name: user.email,
          value: user,
        }),
      )
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
    throw new Error(
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
    throw new Error(
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
    basedClient: client,
    adminHubBasedCloud: adminHub,
    envHubBasedCloud: envHub,
    destroy() {
      client.destroy()
      adminHub.destroy()
      envHub.destroy()
    },
  }
}
