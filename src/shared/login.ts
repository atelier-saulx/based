import { join } from 'node:path'
import { readJSON, outputJSON } from 'fs-extra/esm'
import { homedir } from 'node:os'
import { getBasedClient } from './SharedBasedClient.js'
import { BasedClient, BasedOpts } from '@based/client'
import { AppContext } from './AppContext.js'

const persistPath: string = join(homedir(), '.based/cli')
const authPath: string = join(persistPath, 'Auth.json')
const connectionTimeout = 10e3

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

const hubConnection = async (
  context: AppContext,
  opts: BasedOpts,
): Promise<BasedClient> => {
  const errorMessage = `Fatal error trying to <b>connect to the cloud</b>. Check your <b>'based.json'</b> file, your <b>username</b>, or <b>your arguments</b> and try again.`
  const [emoji, target] =
    opts.org === 'saulx' && opts.project === 'based-cloud'
      ? ['📡', 'Based Cloud']
      : opts.optionalKey
        ? ['🌎', 'the environment manager']
        : ['🪐', 'the environment']

  context.print.loading(`Connecting to ${target}...`)

  const hubClient: BasedClient = getBasedClient(context, opts)

  if (!Object.keys(hubClient).length) {
    throw new Error(errorMessage)
  }

  const timeout = setTimeout(() => {
    context.print.stop().fail(errorMessage, true)
  }, connectionTimeout)

  await hubClient.once('connect').catch(() => {
    throw new Error(errorMessage)
  })

  context.print.stop().success(`${emoji} Connected to ${target}.`)
  clearTimeout(timeout)

  return hubClient
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
  const adminHub: BasedClient = await hubConnection(context, {
    org: 'saulx',
    env: 'platform',
    project: 'based-cloud',
    name: '@based/admin-hub',
    cluster,
  })

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

  const client: BasedClient = await hubConnection(context, {
    cluster,
    org,
    env,
    project,
  })

  await client.setAuthState({
    ...adminHub.authState,
    type: 'based',
  })

  const envHub: BasedClient = await hubConnection(context, {
    cluster,
    org,
    env,
    project,
    key: 'cms',
    optionalKey: true,
  })

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
