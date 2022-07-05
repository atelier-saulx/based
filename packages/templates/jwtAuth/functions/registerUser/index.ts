import crypto from 'crypto'
import { Params } from '@based/server'
import getService from '@based/get-service'
import registerEmailHtml from './registerEmailHtml'

// DRY
const tokenExpiresIn = '30m'
const refreshTokenExpiresIn = '7d'

const generateConfirmToken = (): Promise<string> =>
  new Promise((resolve) =>
    crypto.randomBytes(48, (_, buffer) =>
      resolve('confirm:' + buffer.toString('hex'))
    )
  )

export default async ({ based, payload }: Params) => {
  const { name, email, password, redirectUrl } = payload

  if (!email || !password) {
    throw new Error('email and password required')
  }

  const { existingUser } = await based.get({
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

  if (existingUser?.id) {
    throw new Error('User already exists')
  }

  const confirmToken = await generateConfirmToken()
  const { id } = await based.set({
    type: 'user',
    $alias: confirmToken,
    status: 'confirmationSent',
    email,
    password,
    name,
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
  )}/call/confirmUser?q=${encodeURI(
    JSON.stringify({ c: confirmToken, r: redirectUrl })
  )}"`

  await based.sendEmail({
    from: 'no-reply@based.io',
    to: email,
    subject: `Based.io email confirmation`,
    body: registerEmailHtml({ email, actionUrl }),
  })

  const { project, env } = based.opts
  const privateKey = await based.secret(`users-private-key-${project}-${env}`)

  const token = await based.encode(
    { sub: id, id },
    { key: privateKey },
    'jwt',
    { expiresIn: tokenExpiresIn }
  )
  const refreshToken = await based.encode(
    { sub: id, id, refreshToken: true },
    { key: privateKey },
    'jwt',
    { expiresIn: refreshTokenExpiresIn }
  )

  await based.observeUntil(
    {
      $id: id,
      status: true,
    },
    (r) => r.status === 'confirmedEmail'
  )

  return { id, token, refreshToken, email }
}
