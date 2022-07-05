import crypto from 'crypto'
import { Params } from '@based/server'
import getService from '@based/get-service'
import resetEmailHtml from './resetEmailHtml'

const generateResetToken = (): Promise<string> =>
  new Promise((resolve) =>
    crypto.randomBytes(48, (_, buffer) =>
      resolve('reset:' + buffer.toString('hex'))
    )
  )

export default async ({ based, payload }: Params) => {
  const { email, redirectUrl } = payload

  if (!email) {
    throw new Error('email required')
  }

  const r = await based.get({
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
            $operator: '=',
            $field: 'email',
            $value: email,
          },
        ],
      },
    },
  })

  const { existingUser } = r

  if (!existingUser?.id) {
    return { status: 1, r }
    // throw new Error('User does not exists')
  }

  const resetToken = await generateResetToken()

  // existingUser?.id
  await based.set({
    $id: existingUser.id,
    // TODO: fix it later
    $alias: resetToken,
    status: 'resetSent',
  })

  const service = await getService({
    org: based.opts.org,
    project: based.opts.project,
    env: based.opts.env,
    name: '@based/hub',
  })

  const actionUrl = `${service.url.replace(
    'ws',
    'http'
  )}/call/resetPasswordForm?q=${encodeURI(
    JSON.stringify({ t: resetToken, r: redirectUrl })
  )}"`

  await based.sendEmail({
    from: 'no-reply@based.io',
    to: email,
    subject: `Based.io password reset`,
    body: resetEmailHtml({ email, actionUrl }),
  })

  return { status: 1 }
}
