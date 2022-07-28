import { Params } from '@based/server'
import { generateTokens, tokenExpiresIn } from '../shared'

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
    const { token } = await generateTokens({
      based,
      id: refreshTokenBody.id,
      privateKey,
    })
    return { token, tokenExpiresIn }
  }

  throw new Error('invalid refreshToken')
}
