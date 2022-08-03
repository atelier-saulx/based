import { Params } from '@based/server'
import fetch from 'node-fetch'
import {
  generateTokens,
  refreshTokenExpiresIn,
  tokenExpiresIn,
} from '../shared'

export default async ({ based, payload }: Params) => {
  const { code, redirect, state, clientId, codeVerifier } = payload
  let response: any

  const { project, env } = based.opts
  const privateKey = await based.secret(`users-private-key-${project}-${env}`)
  if (!clientId) {
    throw new Error(`Microsoft clientId should be sent in the payload`)
  }

  if (!codeVerifier) {
    throw new Error('Need codeVerifier')
  }
  const origin = redirect.includes('?')
    ? redirect.slice(0, redirect.indexOf('?'))
    : redirect

  try {
    const details = {
      client_id: clientId,
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
  const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization,
      'Content-Type': 'application/json',
      Origin: origin,
    },
  }).then((r) => r.json())

  if (profileResponse.error) {
    console.error(profileResponse.error)
    throw new Error(profileResponse.error.message)
  }

  const { id, displayName: name, userPrincipalName, mail } = profileResponse
  const email = mail || userPrincipalName

  const alias = 'ms-' + id

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
