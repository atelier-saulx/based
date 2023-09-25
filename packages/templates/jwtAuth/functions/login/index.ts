import { BasedFunction } from '@based/functions'
import * as jwt from 'jsonwebtoken'

const login: BasedFunction = async (based, payload, ctx) => {
  const { email, password } = payload

  // email and password need to be sent to the function
  if (!email || !password) {
    throw new Error('Email and Password required')
  }

  // we check if the user exists based on the email
  // and password supplied in the payload
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
              // `db:digest` is a based function that hashed the
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

  // If user has not confirmed the email, throw.
  if (existingUser?.status === 'waitingForConfirmation') {
    throw new Error('User email not confirmed yet. Check your email.')
  }

  // we get the secret using the based secrets functionality
  // you can set the secret using the CLI like with the example bellow:
  // `npx @based/cli secrets set --key jwt-secret --value mysupersecret``
  const secret = await based.query('based:secret', 'jwt-secret').get()
  if (!secret) {
    throw new Error('Secret `jwt-secret` not found in the env. Is it set?')
  }

  // We create a signed jwt token for the session
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

  // authState object is the standard way based platform
  // stores and passes auth session data.
  const authState = { userId: existingUser.id, token }

  // renewAuthState() method passes the authState though the
  // `verifyAuthState` function for validation and renewall,
  // and then syncs it with the client
  await based.renewAuthState(ctx, { ...authState, persistent: true })

  // We return the authState just for debugging.
  // The `persistent` feature will make the client
  // take care of storing in on the browser so we could
  // send just a status message
  return authState
}

export default login
