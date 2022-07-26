import crypto from 'crypto'
import { Params } from '@based/server'
import fetch from 'node-fetch'

const tokenExpiresIn = '30m'
const refreshTokenExpiresIn = '7d'

// TODO: DRY
const generateTokens = async ({ based, id, privateKey }) => {
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

export default async ({ based, payload }: Params) => {
  // TODO: Add validation
  const { code, redirect, state, codeVerifier } = payload
  let response: any

  //rlet keys = JSON.parse(await based.secret('google-keys'))
  const { project, env } = based.opts
  const privateKey = await based.secret(`users-private-key-${project}-${env}`)
  const microsoftClientId = await based.secret('microsoft-client-id')

  if (payload.getClientId === true) {
    return {
      clientId: microsoftClientId,
    }
  }

  if (!codeVerifier) {
    throw new Error('Need codeVerifier')
  }
  const origin = redirect.includes('?')
    ? redirect.slice(0, redirect.indexOf('?'))
    : redirect

  try {
    const details = {
      client_id: microsoftClientId,
      scope: 'openid email profile User.Read',
      code,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
      reponse_type: 'code',
    }

    const formBody = []
    for (const property in details) {
      const encodedKey = encodeURIComponent(property)
      const encodedValue = encodeURIComponent(details[property])
      formBody.push(encodedKey + '=' + encodedValue)
    }

    response = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // TODO send this dinalically
          // Required for CORS in Microsoft Authentication
          Origin: origin,
        },
        body: formBody.join('&'),
      }
    ).then((r) => r.json())
  } catch (err) {
    throw new Error(err)
  }

  const Authorization = `Bearer ${response.access_token}`
  const user = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization,
      'Content-Type': 'application/json',
      // TODO check why we need this
      Origin: origin,
    },
  }).then((r) => r.json())

  if (user.error) {
    console.error(user.error)
    throw new Error(user.error.message)
  }

  const { id, displayName: name, userPrincipalName, mail } = user
  const email = mail || userPrincipalName

  const alias = 'ms-' + id

  const { existingUser } = await based.get({
    existingUser: {
      id: true,
      email: true,
      name: true,
      aliases: true,
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

  if (!existingUser) {
    // it's a register
    const userWithGoogleId = await based.get({ $alias: alias, id: true })
    if (userWithGoogleId.id) {
      throw new Error('User already registered with another email')
    }

    const { id } = await based.set({
      type: 'user',
      $alias: alias,
      email,
      name,
      // TODO: add avatar?
      // avatar: photo
    })

    const { token, refreshToken, code } = await generateTokens({
      based,
      id,
      privateKey,
    })

    return {
      id,
      code,
      email,
      token,
      tokenExpiresIn,
      refreshToken,
      refreshTokenExpiresIn,
      state,
      newUser: true,
    }
  } else {
    // it's a signin
    if (!existingUser.aliases.includes(alias)) {
      throw new Error('Email and third party authenticator mismatch')
    }
    if (existingUser.id) {
      const { token, refreshToken, code } = await generateTokens({
        based,
        id: existingUser.id,
        privateKey,
      })

      return {
        id: existingUser.id,
        code,
        email,
        token,
        tokenExpiresIn,
        refreshToken,
        refreshTokenExpiresIn,
        state,
      }
    }

    throw new Error('user not found')
  }
}
