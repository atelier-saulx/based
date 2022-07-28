import crypto from 'crypto'

export const tokenExpiresIn = '30m'
export const refreshTokenExpiresIn = '7d'

export const generateTokens = async ({ based, id, privateKey }) => {
  const token = await based.encode(
    { sub: id, id },
    { key: privateKey },
    'jwt',
    {
      expiresIn: tokenExpiresIn,
      algorithm: 'RS256',
    }
  )
  const refreshToken = await based.encode(
    { sub: id, id, refreshToken: true },
    { key: privateKey },
    'jwt',
    {
      expiresIn: refreshTokenExpiresIn,
      algorithm: 'RS256',
    }
  )

  const code = crypto.randomBytes(16).toString('hex')
  based.redis.set(
    {
      name: 'default',
      type: 'origin',
    },
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

  return { token, refreshToken, code }
}
