import type { BasedClient } from '@based/client'
import type { AppContext } from '../../shared/index.js'

export const authByState = async (
  context: AppContext,
  basedClient: BasedClient,
  state: Based.Auth.AuthenticatedUser,
): Promise<Based.Auth.AuthenticatedUser | false> => {
  // context.spinner.start(
  //   context.i18n('commands.auth.methods.authByState', state.email),
  // )

  try {
    await basedClient.setAuthState(state)

    context.spinner.stop()

    // context.print
    //   .line()
    //   .success(context.i18n('commands.auth.methods.success'), true)
  } catch ({ error }) {
    context.print.line().info(`<red>${error}</red>`, context.state.emojis.error)

    return false
  }

  const result = {
    ...basedClient.authState,
    email: state.email,
    ts: Date.now(),
  }

  return result
}

export const authByEmail = async (
  context: AppContext,
  basedClient: BasedClient,
  cluster: string,
  email: string,
): Promise<Based.Auth.AuthenticatedUser | false> => {
  const code: string = (~~(Math.random() * 1e6)).toString(16)

  // context.spinner.start(
  //   context.i18n('commands.auth.methods.authByEmail', email, code),
  // )

  try {
    await basedClient.call('login', {
      email,
      skipEmailForTesting: cluster === 'local',
      code,
    })

    context.spinner.stop()

    // context.print
    //   .line()
    //   .success(context.i18n('commands.auth.methods.success'), true)
  } catch (error) {
    context.print
      .line()
      .info(
        `<red>${context.i18n('errors.401', error.message.split(']').pop().trim())}</red>`,
        context.state.emojis.error,
      )

    return false
  }

  const state = {
    ...(await basedClient.once('authstate-change')),
    email,
    ts: Date.now(),
  }

  console.log('auth', state)

  await basedClient.setAuthState(state)

  return state
}

export const updateLocalUsers = (
  users: Based.Auth.AuthenticatedUser[],
  user: Based.Auth.AuthenticatedUser,
): Based.Auth.AuthenticatedUser[] => {
  users = users.filter(({ email }) => email !== user.email)
  users.push(user)

  return users
}

export const getLastSession = (
  users: Based.Auth.AuthenticatedUser[],
): Based.Auth.AuthenticatedUser | false => {
  return users.sort((a, b) => b?.ts - a?.ts)[0] || false
}
