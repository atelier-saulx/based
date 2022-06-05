import { Params } from '@based/server'

export default async ({ callStack, based, user }: Params) => {
  const { project, env } = based.opts
  if (callStack && ['login'].includes(callStack[0])) {
    return true
  }

  if (user && user._token) {
    const token = await user.token(`users-public-key-${project}-${env}`)

    if (token.id) {
      return true
    }
  }

  return false
}
