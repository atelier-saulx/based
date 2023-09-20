import { BasedFunction } from '@based/functions'
import * as jwt from 'jsonwebtoken'

const register: BasedFunction = async (based, payload, ctx) => {
  const { email, password } = payload

  if (!email || !password) {
    throw new Error('Email and Password required')
  }

  // we get the secret using the based secrets functionality
  // you can set the secret using the CLI like with the example bellow:
  // `npx @based/cli secrets set --key jwt-secret --value mysupersecret``
  const secret = await based.query('based:secret', 'jwt-secret').get()
  if (!secret) {
    throw new Error('Secret `jwt-secret` not found in the env. Is it set?')
  }

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
          ],
        },
      },
    })
    .get()

  console.log({ existingUser })

  if (existingUser) {
    throw new Error('User already exists.')
  }

  const { id } = await based.call('db:set', {
    type: 'user',
    email: email.trim().toLowerCase(),
    password,
  })

  const token = jwt.sign(
    {
      id,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '1w',
    }
  )

  const authState = { id, token }
  based.sendAuthState(ctx, { ...authState, persistent: true })

  return authState
}

export default register
