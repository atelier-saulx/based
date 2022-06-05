/* eslint-disable no-console */
import crypto from 'crypto'
import { BasedServerClient } from '@based/server'

const tokenExpiresIn = '30m'
const refreshTokenExpiresIn = '7d'

export default async ({
  payload,
  based,
}: {
  based: BasedServerClient
  payload?: { email: string; password: string }
}) => {
  const { children: dbUser } = await based.get({
    children: {
      id: true,
      email: true,
      password: true,
      $find: {
        $filter: {
          $operator: '=',
          $field: 'email',
          $value: payload.email,
        },
      },
    },
  })
  const hashedPassword = await based.digest(payload.password)

  const { project, env } = based.opts

  if (dbUser && dbUser.password === hashedPassword) {
    const privateKey = await based.secret(`users-private-key-${project}-${env}`)

    const token = await based.encode(
      { sub: dbUser.id, id: dbUser.id },
      { key: privateKey },
      'jwt',
      { expiresIn: tokenExpiresIn }
    )
    const refreshToken = await based.encode(
      { sub: dbUser.id, id: dbUser.id, refreshToken: true },
      { key: privateKey },
      'jwt',
      { expiresIn: refreshTokenExpiresIn }
    )

    const code = crypto.randomBytes(16).toString('hex')
    based.redis.set(
      code,
      JSON.stringify({
        token,
        tokenExpiresIn,
        refreshToken,
        refreshTokenExpiresIn,
      }),
      'EX',
      60 * 5
    ) // expire in 5m

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      token,
      tokenExpiresIn,
      refreshToken,
      refreshTokenExpiresIn,
      code,
    }
  }
  throw new Error('User not found')
}
