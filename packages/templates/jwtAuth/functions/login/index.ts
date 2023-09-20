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

  const token = jwt.sign(
    {
      userId: existingUser.id,
    },
    // TODO: this secret should come from based secrets
    // feature and not added to the repository
    'supersecret',
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
