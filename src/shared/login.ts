import type { BasedClient, BasedOpts } from '@based/client'
import { confirm } from '@clack/prompts'
import {
  envSelect,
  orgSelect,
  projectSelect,
  userSelect,
} from '../commands/auth/prompts.js'
import { clusterText } from '../commands/infra/init/prompts.js'
import {
  authByState,
  destroyLastSession,
  getLastSession,
  updateLocalUsers,
} from '../helpers/auth/index.js'
import { parseOrgsData } from '../helpers/infra/index.js'
import { CONNECTION_TIMEOUT, LOCAL_AUTH_INFO } from './constants.js'
import {
  AppContext,
  SharedBasedClient,
  getFileByPath,
  saveAsFile,
} from './index.js'

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

export const connectToHub = async (
  context: AppContext,
  opts: BasedOpts,
): Promise<BasedClient> => {
  const { file } = await context.get('basedProject')
  const target =
    opts.org === 'saulx' && opts.project === 'based-cloud'
      ? context.i18n('methods.hubConnection.cluster')
      : opts.optionalKey
        ? context.i18n('methods.hubConnection.project')
        : context.i18n('methods.hubConnection.environment')

  const basedClient: BasedClient = SharedBasedClient.getInstance(opts)

  if (!basedClient) {
    throw new Error(context.i18n('errors.404', file))
  }

  if (basedClient.connected) {
    return basedClient
  }

  const timeout = setTimeout(() => {
    context.print.fail(context.i18n('errors.408'), true)
  }, CONNECTION_TIMEOUT)

  try {
    context.spinner.start(
      context.i18n('methods.hubConnection.connecting', target),
    )

    await basedClient.once('connect')
  } catch (error) {
    throw new Error(context.i18n('errors.404', file, error))
  }

  context.print.info(
    context.i18n('methods.hubConnection.connected', target),
    true,
  )

  clearTimeout(timeout)

  return basedClient
}

export const newLogin = async (email?: string): Promise<Based.API.Client> => {
  const context: AppContext = AppContext.getInstance()
  const { cluster, org, env, project } = await context.getProgram()

  const users: Based.Auth.AuthenticatedUser[] =
    await getFileByPath<Based.Auth.AuthenticatedUser[]>(LOCAL_AUTH_INFO)

  const basedClientAdmin: BasedClient = await connectToHub(context, {
    org: 'saulx',
    env: 'platform',
    project: 'based-cloud',
    name: '@based/admin-hub',
    cluster,
  })

  let lastSession = getLastSession(users)
  let authenticatedUser: Based.Auth.AuthenticatedUser

  if (lastSession) {
    lastSession = await authByState(context, basedClientAdmin, lastSession)

    if (lastSession) {
      authenticatedUser = lastSession
    }
  }

  if (!authenticatedUser) {
    const form = await context.form.group({
      user: userSelect(context, basedClientAdmin, users, email),
    })

    authenticatedUser = form.user as Based.Auth.AuthenticatedUser
  }

  await saveAsFile(
    updateLocalUsers(users, authenticatedUser),
    LOCAL_AUTH_INFO,
    'json',
  )

  let parsedUserEnvs: Based.Infra.ParsedUserEnvs

  if (!cluster || !org || !project || !env) {
    const userCloudInfo: Based.Infra.UserEnvs[] = await basedClientAdmin
      .query(context.endpoints.USER_CLOUD_INFO.endpoint, {
        userId: basedClientAdmin.authState?.userId,
      })
      .get()

    parsedUserEnvs = parseOrgsData(userCloudInfo)
  }

  const form = await context.form.group({
    cluster: clusterText(context, false, cluster),
    ...(!org && { org: orgSelect(context, Object.keys(parsedUserEnvs), org) }),
    ...(!project && {
      project: (results) =>
        projectSelect(
          context,
          Object.keys(parsedUserEnvs[results.results.org]),
          project,
        )(results),
    }),
    ...(!env && {
      env: (results) =>
        envSelect(
          context,
          parsedUserEnvs[results.results.org][results.results.project],
          env,
        )(results),
    }),
  })

  const basedProject = {
    ...form,
    ...(cluster && { cluster }),
    ...(org && { org }),
    ...(project && { project }),
    ...(env && { env }),
  }

  const basedClientEnv: BasedClient = await connectToHub(context, {
    ...basedProject,
    key: 'cms',
    optionalKey: true,
  })

  await basedClientEnv.setAuthState(authenticatedUser)

  const basedClientProject: BasedClient = await connectToHub(
    context,
    basedProject,
  )

  await basedClientProject.setAuthState(authenticatedUser)

  const clients = buildClients(
    basedClientAdmin,
    basedClientEnv,
    basedClientProject,
  )

  context.set('basedProject', basedProject)

  if (lastSession) {
    context.print
      .pipe()
      .success(context.i18n('commands.auth.methods.welcomeBack'), true)
      .line()
  }

  return clients
}

export const logout = async () => {
  const context: AppContext = AppContext.getInstance()
  const users: Based.Auth.AuthenticatedUser[] =
    await getFileByPath<Based.Auth.AuthenticatedUser[]>(LOCAL_AUTH_INFO)

  const lastSession = getLastSession(users)

  if (lastSession) {
    context.print.info(
      `The user <b>${lastSession.email}</b> is currently connected.`,
      true,
    )

    const logout = await confirm({
      message: 'Do you want to disconnect the account?',
    })

    if (logout) {
      const autenticatedUsers = destroyLastSession(users, lastSession)

      await saveAsFile(autenticatedUsers, LOCAL_AUTH_INFO, 'json')

      context.print.success(context.i18n('methods.logout.success'), true)
    } else {
      context.print.fail(context.i18n('methods.aborted'))
    }
  }

  if (!lastSession) {
    context.print.fail(
      "I couldn't find any user to disconnect. Please log in first to start using <b>Based</b>.",
    )
  }
}
