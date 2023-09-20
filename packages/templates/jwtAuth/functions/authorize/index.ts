import { Authorize, VerifyAuthState } from '@based/functions'
import * as jwt from 'jsonwebtoken'
import { deepEqual } from '@saulx/utils'

// `authorize` function is run every time a
// data funtion is called. The boolean return
// value allows or denies access to the function.
const authorize: Authorize = async (_based, ctx, _name, _payload) => {
  // if there is an authState and a token,
  // the user is logged in so we allow access.
  // Note that `verifyAuthState` (see further bellow) function
  // will still check the validity of the token
  if (ctx.session?.authState?.token) {
    return true
  }

  // otherwise we deny access to all functions.
  // Note that functions with the property `public`
  // in the function config will bypass the `authorize`
  // function
  return false
}
export default authorize

// `verifyAuthState` is a support function for `authorize`
// it is meant to handle the validation and renewall of
// session token freeing up authorize for business logic.
export const verifyAuthState: VerifyAuthState = async (
  based,
  ctx,
  authState
) => {
  if (!ctx.session) {
    return { error: 'Unauthorized' }
  }

  if (!authState.token) {
    return { error: 'Unauthorized' }
  }

  // we get the secret using the based secrets functionality
  // you can set the secret using the CLI like with the example bellow:
  // `npx @based/cli secrets set --key jwt-secret --value mysupersecret``
  const secret = await based.query('based:secret', 'jwt-secret').get()
  if (!secret) {
    throw new Error('Secret `jwt-secret` not found in the env. Is it set?')
  }

  try {
    const decoded = jwt.verify(authState.token, secret, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload

    if (!decoded.userId) {
      throw new Error('invalid token, no userId')
    }

    const existingUser = await based
      .query('db', {
        $id: decoded.userId,
        id: true,
      })
      .get()

    console.log({ existingUser, decoded })

    if (!existingUser) {
      // user does not exist
      throw new Error('invalid token, user does not exist')
    }

    if (authState.userId !== decoded.userId) {
      return {
        authState: {
          userId: decoded.userId,
          token: authState.token,
        },
      }
    }

    // TODO: Add lastEvaluated

    if (deepEqual(ctx.session?.authState, authState)) {
      return true
    } else {
      return authState
    }
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const decoded: any = jwt.decode(authState.token)
      if (
        !decoded.exp ||
        typeof decoded.exp !== 'number' ||
        decoded.exp < Date.now() / 1000 - 7 * 24 * 60 * 60
      ) {
        console.info('Token is older than a week:', authState?.userId)
        return { error: 'token expired' }
      }
      const updatedToken = jwt.sign({ userId: decoded.userId }, secret, {
        algorithm: 'HS256',
        expiresIn: '1w',
      })
      return {
        userId: decoded.userId,
        token: updatedToken,
      }
    }
    console.error('[verifyAuthState]', err.message)
    return { error: 'invalid token' }
  }
}
