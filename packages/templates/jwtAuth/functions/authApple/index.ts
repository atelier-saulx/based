import { Params } from '@based/server'
import jwt, { GetPublicKeyOrSecret } from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import fetch from 'node-fetch'
import {
  generateTokens,
  refreshTokenExpiresIn,
  tokenExpiresIn,
} from '../shared'

// JSON Web Key Set is the format Apple stores its public keys
const jwks = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
})

const formEncode = (body: object) => {
  const formBody = []
  for (const property in body) {
    const encodedKey = encodeURIComponent(property)
    const encodedValue = encodeURIComponent(body[property])
    formBody.push(encodedKey + '=' + encodedValue)
  }
  return formBody.join('&')
}

export default async ({ based, payload }: Params) => {
  const { code, redirect, state, clientId, teamId, keyId } = payload
  let response: any

  const { project, env } = based.opts
  const privateKey = await based.secret(`users-private-key-${project}-${env}`)
  const applePrivateKey = await based.secret(
    `apple-privatekey-${project}-${env}`
  )
  if (!clientId || !teamId || !keyId || !applePrivateKey) {
    throw new Error(
      `Apple clientId, teamId, keyId needs to be sent in the payload and PrivateKey should be configured as a secret with the name apple-privatekey-${project}-${env}`
    )
  }

  const clientSecret = jwt.sign(
    {
      iss: teamId, // Apple Developer Team ID.
      iat: Math.floor(Date.now() / 1000), // creation time in seconds
      exp: Math.floor(Date.now() / 1000) + 60 * 5, // expires in 5 minutes. Expressed in seconds
      aud: 'https://appleid.apple.com',
      sub: clientId,
    },
    applePrivateKey,
    {
      algorithm: 'ES256',
      keyid: keyId,
    }
  )

  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: /^https:/.test(redirect)
      ? redirect
      : 'https://based2.loca.lt/apple',
  }
  // const tokenResponse = await appleSignin.getAuthorizationToken(code, options)
  const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formEncode(body),
  }).then((r) => r.json())
  console.log({ tokenResponse })

  const getKeys: GetPublicKeyOrSecret = (header, cb) => {
    jwks.getSigningKey(header.kid, (err, key) => {
      if (err) throw err
      // @ts-ignore
      cb(null, key.publicKey || key.rsaPublicKey)
    })
  }

  const verifyResult = await new Promise<any>((resolve, reject) => {
    jwt.verify(
      tokenResponse.id_token,
      getKeys,
      {
        issuer: 'https://appleid.apple.com',
        audience: clientId,
      },
      (err, decoded) => {
        if (err) reject(err)
        else resolve(decoded)
      }
    )
  })

  console.log({ verifyResult })
  return {}
  // const { sub: id, email = user.email } = verifyResult

  const alias = 'google-' + resourceName.split('/')[1]

  const user = await based.get({
    $alias: alias,
    id: true,
    email: true,
  })

  if (user?.id) {
    // it's a signin
    const { token, refreshToken, code } = await generateTokens({
      based,
      id: user.id,
      privateKey,
    })

    return {
      id: user.id,
      code,
      email,
      token,
      tokenExpiresIn,
      refreshToken,
      refreshTokenExpiresIn,
      state,
    }
  } else {
    // it's a register
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
    if (existingUser?.id) {
      throw new Error('User already registered with this email')
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
  }
}
