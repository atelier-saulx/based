import { Authorize, VerifyAuthState } from '@based/functions'
import * as jwt from 'jsonwebtoken'
import { deepEqual } from '@saulx/utils'

// The `authorize` function runs every time a data function is called.
// The boolean return value determines whether access to the function
// is allowed or denied.
const authorize: Authorize = async (_based, ctx, _name, _payload) => {
  // If there is an authState and a token, a user is logged in, so we
  // allow access. Note that the `verifyAuthState` function (see further
  // below) will still check the validity of the token.
  if (ctx.session?.authState?.token) {
    return true
  }

  // Otherwise, we deny access to all functions. Note that functions
  // with the property public in the function config will bypass the
  // authorize function.
  return false
}
export default authorize

// `verifyAuthState` is a support function for `authorize`.
// It is meant to handle the validation and renewal of
// session tokens, freeing up `authorize` for business logic.
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

  // We get the secret using the based secrets functionality.
  // You can set the secret using the CLI like with the example below:
  // `npx @based/cli secrets set --key jwt-secret --value mysupersecret`
  const secret = await based.query('based:secret', 'jwt-secret').get()
  if (!secret) {
    throw new Error('Secret `jwt-secret` not found in the env. Is it set?')
  }

  try {
    // We verify and decode the jwt
    const decoded = jwt.verify(authState.token, secret, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload

    // Check the token format
    if (!decoded.userId) {
      throw new Error('invalid token, no userId')
    }

    // We check if the user exists in the database
    const existingUser = await based
      .query('db', {
        $id: decoded.userId,
        id: true,
      })
      .get()
    if (!existingUser) {
      throw new Error('invalid token, user does not exist')
    }

    // We update the authState if the token is for a new user.
    if (authState.userId !== decoded.userId) {
      return {
        authState: {
          userId: decoded.userId,
          token: authState.token,
        },
      }
    }

    if (deepEqual(ctx.session?.authState, authState)) {
      // If the new authState is the same as the current one,
      // we return true, meaning the current authState is still
      // valid, and no action needs to be taken.
      return true
    } else {
      // If it's a new authState we update it.
      return authState
    }
  } catch (err) {
    // This will trigger if the jwt verification fails

    // In case the token is valid but expired, let's renew the user token.
    if (err.name === 'TokenExpiredError') {
      const decoded: any = jwt.decode(authState.token)
      // We only renew the user token if it's not older than a week.
      // Otherwise, let's make the user log in again.
      if (
        !decoded.exp ||
        typeof decoded.exp !== 'number' ||
        decoded.exp < Date.now() / 1000 - 7 * 24 * 60 * 60
      ) {
        console.info('Token is older than a week:', authState?.userId)
        return { error: 'token expired' }
      }
      // We create a new token.
      const updatedToken = jwt.sign({ userId: decoded.userId }, secret, {
        algorithm: 'HS256',
        expiresIn: '1w',
      })
      // We return a new authState updating the session.
      return {
        userId: decoded.userId,
        token: updatedToken,
      }
    }
    console.error('[verifyAuthState]', err.message)
    return { error: 'invalid token' }
  }
}
