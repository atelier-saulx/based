import { BasedFunction } from '@based/functions'
import * as jwt from 'jsonwebtoken'

const register: BasedFunction = async (based, payload, ctx) => {
  const { email, password } = payload

  if (!email || !password) {
    throw new Error('Email and Password required')
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
    // TODO: this secret should come from based secrets
    // feature and not added to the repository
    'supersecret',
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
