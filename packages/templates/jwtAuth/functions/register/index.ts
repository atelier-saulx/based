import { BasedFunction } from '@based/functions'
import * as jwt from 'jsonwebtoken'

const register: BasedFunction = async (based, payload, ctx) => {
  const { email, password } = payload

  if (!email || !password) {
    throw new Error('Email and Password required')
  }

  // We get the secret using the based secrets functionality.
  // You can set the secret using the CLI with the example below:
  // `npx @based/cli secrets set --key jwt-secret --value mysupersecret`
  const secret = await based.query('based:secret', 'jwt-secret').get()
  if (!secret) {
    throw new Error('Secret `jwt-secret` not found in the env. Is it set?')
  }

  // We check if a user with that email already exists in the database.
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

  // We generate an ID for the user.
  // Note that we're not creating the user yet. We do this to
  // prevent a user from being created in case the confirmation email
  // fails to be sent.
  const { id } = await based.call('db:id', {
    type: 'user',
  })

  // We generate a signed token to include in the email action URL.
  // This token will serve as proof of the origin of the confirmation email.
  const confirmationToken = jwt.sign(
    {
      userId: id,
      type: 'emailConfirmation',
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '10d', // TODO: TBD expiration of registration token
    }
  )

  // We generate the action URL to be included in the email.
  const actionDomain =
    process.env.CLUSTER === 'local'
      ? `http://${process.env.DOMAIN}`
      : `https://${process.env.DOMAIN}`
  const actionUrl = `${actionDomain}/registerConfirmation?t=${encodeURIComponent(
    confirmationToken
  )}`

  // We send the email using the based.io default template and register
  // email feature. You can override this with your own email provider
  // and email template.
  const emailResult = await based.call('based:send-register-email', {
    email,
    actionUrl,
  })
  if (emailResult.error) {
    throw new Error(emailResult.error)
  }

  // We set the new user in the database and set their status to
  // waiting for confirmation.
  await based.call('db:set', {
    $id: id,
    email: email.trim().toLowerCase(),
    password,
    status: 'waitingForConfirmation',
  })

  // Instead of just returning a result, we can hold the response until the user
  // clicks the action button in the confirmation email they will receive.
  // By calling this function asynchronously, we can display a message in the UI
  // prompting the user to click the email link.
  // When the user clicks the link, the function will resume and log the user in.
  return new Promise((resolve, reject) => {
    // The `based.query.subscribe()` method returns a cleanup function that we
    // use to stop the subscription.
    const close = based
      // We subscibe to the database for a change in the status field of the user.
      .query('db', {
        $id: id,
        status: true,
      })
      .subscribe((data) => {
        // When the status is confirmed, we create a token and update the authState.
        if (data.status === 'confirmed') {
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
          clearTimeout(timeout)
          // We send the new authState to the client
          based.sendAuthState(ctx, { ...authState, persistent: true })
          resolve(authState)
        }
      })

    const timeout = setTimeout(() => {
      close()
      reject(new Error('Register timeout'))
    }, 10 * 60e3)
  })
}

export default register
