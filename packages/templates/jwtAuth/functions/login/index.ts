import { BasedServerClient } from '@based/server'
import {
  generateTokens,
  refreshTokenExpiresIn,
  tokenExpiresIn,
} from '../shared'

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

    const { token, refreshToken, code } = await generateTokens({
      based,
      id: dbUser.id,
      privateKey,
    })

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
