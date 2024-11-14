import { homedir } from 'node:os'
import { join } from 'node:path'
import type { BasedClient, BasedOpts } from '@based/client'
import { outputJSON, readJSON } from 'fs-extra/esm'
import { AppContext, getBasedClient } from './index.js'

const persistPath: string = join(homedir(), '.based/cli')
const authPath: string = join(persistPath, 'Auth.json')
const connectionTimeout = 1e3

const authenticateUser = async (
  email: string,
  hub: BasedClient,
  cluster: string,
  context: AppContext,
): Promise<Based.Auth.AuthenticatedUser> => {
  const code: string = (~~(Math.random() * 1e6)).toString(16)
  context.spinner.start(
    context.i18n('methods.authenticateUser.loading', email, code),
  )

  await hub.call('login', {
    email,
    skipEmailForTesting: cluster === 'local',
    code,
  })

  context.print.success(context.i18n('methods.authenticateUser.success'))

  return {
    ...(await hub.once('authstate-change')),
    email,
  }
}

// TODO
// Move this logic to the client
const buildClients = (
  cluster: BasedClient,
  env: BasedClient,
  project: BasedClient,
): Based.API.Client => {
  const clients = {
    cluster,
    env,
    project,
  }

  const call: Based.API.Client['call'] = (gatewayFunction, payload) => {
    if (!gatewayFunction) {
      return
    }

    const type: Based.API.Gateway.Endpoint['type'] = gatewayFunction.type
    const client = gatewayFunction.client

    return clients[client]?.[type](
      gatewayFunction.endpoint,
      payload,
    ) as undefined
  }

  const destroy: Based.API.Client['destroy'] = () => {
    project.destroy()
    env.destroy()
    cluster.destroy()

    process.exit(0)
  }

  const get: Based.API.Client['get'] = (client) => clients[client]

  return {
    call,
    destroy,
    get,
  }
}

const hubConnection = async (
  context: AppContext,
  opts: BasedOpts,
): Promise<BasedClient> => {
  const { file } = await context.get('basedProject')
  const [_, target] =
    opts.org === 'saulx' && opts.project === 'based-cloud'
      ? ['', context.i18n('methods.hubConnection.cloud')]
      : opts.optionalKey
        ? ['', context.i18n('methods.hubConnection.environmentManager')]
        : ['', context.i18n('methods.hubConnection.environment')]

  const hubClient: BasedClient = getBasedClient(context, opts)

  if (!Object.keys(hubClient).length) {
    throw new Error(context.i18n('errors.404', file))
  }

  const timeout = setTimeout(() => {
    context.print.fail(context.i18n('errors.408'), true)
  }, connectionTimeout)

  try {
    await hubClient.once('connect')
  } catch (error) {
    throw new Error(context.i18n('errors.404', file, error))
  }

  context.print.info(
    context.i18n('methods.hubConnection.connected', target),
    true,
  )
  clearTimeout(timeout)

  return hubClient
}

export const login = async ({
  email,
  selectUser,
}: Based.Auth.Login): Promise<Based.API.Client> => {
  const context: AppContext = AppContext.getInstance()
  const { cluster, org, env, project } = await context.getProgram()

  // context.print.loading(
  //   context.i18n(
  //     'methods.hubConnection.connecting',
  //     context.i18n('methods.hubConnection.cloud'),
  //   ),
  // )

  const adminHub: BasedClient = await hubConnection(context, {
    org: 'saulx',
    env: 'platform',
    project: 'based-cloud',
    name: '@based/admin-hub',
    cluster,
  })

  let users: Based.Auth.User[] = await readJSON(authPath).catch(() => [])
  let user: Based.Auth.User

  if (email) {
    user = await authenticateUser(email, adminHub, cluster, context)

    users = users.filter(({ email }) => email !== user.email)
    users.push(user)
  }

  if (users.length && !email) {
    const lastUser: Based.Auth.User = users.sort((a, b) => b?.ts - a?.ts)[0]

    try {
      await adminHub.setAuthState({
        ...lastUser,
        type: 'based',
      })

      user = lastUser
    } catch (error) {
      users = users.filter((user) => user !== lastUser)

      if (!Number.isNaN(error) && typeof error === 'string') {
        // TODO Fix the type in the i18n to handle dynamic strings
        const errorMsg = `errors.${error}` as Based.i18n.NestedKeys<
          typeof context.i18n
        >

        context.print.warning(context.i18n(errorMsg), true)
      } else {
        context.print.warning(error)
      }
    }

    if (selectUser) {
      const choices: Based.Context.SelectInputItems[] = users.map((user) => ({
        name: user.email,
        value: user,
      }))
      choices.push({
        name: context.i18n('methods.login.otherUser'),
        value: null,
      })

      user = await context.input.select(
        context.i18n('methods.login.selectUser'),
        choices,
        false,
        false,
      )
    }
  }

  if ((!user && !email) || !users || !users.length) {
    const email: string = await context.input.email(
      context.i18n('methods.login.email'),
    )

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

  context.print.success(context.i18n('methods.login.success', user.email), true)

  return buildClients(adminHub, envHub, client)
}
