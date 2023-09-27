import { BasedFunction } from '@based/functions'
import * as jwt from 'jsonwebtoken'

const login: BasedFunction = async (based, payload, ctx) => {
  const { email, password } = payload

  // Email and password need to be sent to the function.
  if (!email || !password) {
    throw new Error('Email and Password required')
  }

  // We check if the user exists based on the email
  // and password supplied in the payload.
  const { existingUser } = await based
    .query('db', {
      existingUser: {
        id: true,
        status: true,
        $find: {
          $traverse: 'children',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'user',
            },
            {
              $field: 'email',
              $operator: '=',
              $value: email.trim().toLowerCase(),
            },
            {
              $field: 'password',
              $operator: '=',
              // `db:digest` is a based function that hashes the
              // passed payload with the same hashing algorithm
              // being used by the db on fields of type digest.
              // We can then compare the payload password with
              // the one stored in the database.
              $value: await based.call('db:digest', password),
            },
          ],
        },
      },
    })
    .get()

  if (!existingUser) {
    throw new Error('User not found')
  }

  // If the user has not confirmed the email, throw an exception.
  if (existingUser?.status === 'waitingForConfirmation') {
    throw new Error('User email not confirmed yet. Check your email.')
  }

  // We get the secret using the based secrets functionality.
  // You can set the secret using the CLI like with the example below:
  // `npx @based/cli secrets set --key jwt-secret --value mysupersecret`
  const secret = await based.query('based:secret', 'jwt-secret').get()
  if (!secret) {
    throw new Error('Secret `jwt-secret` not found in the env. Is it set?')
  }

  // We create a signed JWT token for the session.
  const token = jwt.sign(
    {
      userId: existingUser.id,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '1w',
    }
  )

  // The `authState` object is the standard way the based platform
  // stores and passes auth session data.
  const authState = { userId: existingUser.id, token }

  // The `renewAuthState()` method passes the `authState` through the
  // `verifyAuthState` function for validation and renewal, and then
  // syncs it with the client.
  // The `persistent` flag will make the client take care of storing the
  // `authState`, either in the browser's local storage or in a folder
  // when used from Node. The client will automatically load the session
  // when used again.
  await based.renewAuthState(ctx, { ...authState, persistent: true })

  // We return the `authState` just for debugging purposes.
  return authState
}

export default login
