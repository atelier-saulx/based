import { Params } from '@based/server'
import jwt from 'jsonwebtoken'

type RefreshTokenBody = { id: string; refreshToken: true }

export default async ({ based, payload }: Params) => {
  const { refreshToken } = payload
  const { project, env } = based.opts

  const publicKey = await based.secret(`users-public-key-${project}-${env}`)
  const privateKey = await based.secret(`users-private-key-${project}-${env}`)

  if (
    (await based.redis.get(
      {
        name: 'default',
      },
      refreshToken
    )) === 'invalidated'
  ) {
    throw new Error('invalid refreshToken')
  }

  const refreshTokenBody: RefreshTokenBody = await based.decode(refreshToken, {
    publicKey,
  })

  if (
    refreshTokenBody &&
    refreshTokenBody.refreshToken === true &&
    refreshTokenBody.id
  ) {
    const newToken = jwt.sign(
      {
        id: refreshTokenBody.id,
      },
      privateKey,
      {
        expiresIn: '30m',
        algorithm: 'RS256',
      }
    )
    return { token: newToken }
  }

  throw new Error('invalid refreshToken')
}
