import { Authorize, VerifyAuthState } from '@based/functions'
import * as jwt from 'jsonwebtoken'
import { deepEqual } from '@saulx/utils'

const authorize: Authorize = async (_based, _ctx, _name, _payload) => {
  return false
}

export default authorize

export const verifyAuthState: VerifyAuthState = async (
  based,
  ctx,
  authState
) => {
  console.log('this is verifyAuthState')

  if (!ctx.session) {
    return { error: 'Unauthorized' }
  }

  if (!authState.token) {
    return { error: 'Unauthorized' }
  }

  // TODO: This secret should come from the based secrets feature
  const secret = 'supersecret'

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
      console.log('---1')
      return true
    } else {
      console.log('---2')
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
