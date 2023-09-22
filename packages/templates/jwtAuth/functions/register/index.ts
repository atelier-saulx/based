import { BasedFunction } from '@based/functions'
import * as jwt from 'jsonwebtoken'

enum UserStatuses {
  confirmed = 1,
}

const register: BasedFunction = async (based, payload, ctx) => {
  const { email, password } = payload

  if (!email || !password) {
    throw new Error('Email and Password required')
  }

  // we get the secret using the based secrets functionality
  // you can set the secret using the CLI like with the example bellow:
  // `npx @based/cli secrets set --key jwt-secret --value mysupersecret``
  const secret = await based.query('based:secret', 'jwt-secret').get()
  console.log({ secret })
  if (!secret) {
    throw new Error('Secret `jwt-secret` not found in the env. Is it set?')
  }

  // we check if a user with that email already exists in the db
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
  if (existingUser) {
    throw new Error('User already exists.')
  }

  // We generate a id for the user.
  // Note that we're not yet creating the user. We do this
  // so a user is not created in case the confirmation email
  // fails to be sent
  const { id } = await based.call('db:id', {
    type: 'user',
  })

  // We generate a signed token to include in the email actionUrl.
  // this will prove the origin of the confirmation email.
  const confirmationToken = jwt.sign(
    {
      userId: id,
      type: 'emailConfirmation',
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '15m',
    }
  )

  // We generate the action url to be included in the email
  const actionDomain =
    process.env.CLUSTER === 'local'
      ? `http://${process.env.DOMAIN}`
      : `https://${process.env.DOMAIN}`
  const actionUrl = `${actionDomain}/registrationConfirmation?t=confirmationToken`

  // We send the email using the based.io default template and register email feature.
  // You can override this with your own email provider and email template.
  const emailResult = await based.call('based:send-register-email', {
    email,
    actionUrl,
  })
  if (emailResult.error) {
    throw new Error(emailResult.error)
  }

  await based.call('db:set', {
    $id: id,
    email: email.trim().toLowerCase(),
    password,
  })

  const token = jwt.sign(
    {
      userId: id,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '15m',
    }
  )

  const authState = { id, token }
  based.sendAuthState(ctx, { ...authState, persistent: true })

  return authState
}

export default register
