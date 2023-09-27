import { BasedFunction } from '@based/functions'
import * as jwt from 'jsonwebtoken'

// This confirmation function is called via HTTP REST when the user clicks the
// confirmation email sent during registration.

const register: BasedFunction = async (based, payload, ctx) => {
  const { t: token } = payload
  // We validate the payload.
  if (!token) {
    throw new Error('Invalid request')
  }

  // Get the JWT secret from the based.io secrets functionality. Check
  // the register function for more details.
  const secret = await based.query('based:secret', 'jwt-secret').get()
  if (!secret) {
    throw new Error('Secret `jwt-secret` not found in the env. Is it set?')
  }

  try {
    // We verify and decode the JWT to retrieve the body contents.
    const tokenBody = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as { userId: string; type: string }

    // The body contains the userId and the type of token.
    const { userId, type } = tokenBody
    // We check the JWT body format
    if (!userId || type !== 'emailConfirmation') {
      throw new Error('Invalid  token')
    }
    // If the user does not exist we throw an error
    const existingUser = await based
      .query('db', { $id: userId, status: true })
      .get()
    if (!existingUser || !Object.keys(existingUser).length) {
      throw new Error('Invalid user')
    } else if (existingUser.status !== 'waitingForConfirmation') {
      throw new Error('Invalid or expired confirmation token')
    }

    // We set the state as "confirmed" for the user
    await based.call('db:set', {
      $id: userId,
      status: 'confirmed',
    })

    return 'Email confirmed'
  } catch (error) {
    // If the JWT is expired or the signature verification
    // fails, this will be triggered.
    throw new Error('Invalid or expired confirmation token')
  }
}
export default register
