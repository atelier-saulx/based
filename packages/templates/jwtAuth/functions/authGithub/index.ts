import { Params } from '@based/server'
import fetch from 'node-fetch'
import {
  generateTokens,
  refreshTokenExpiresIn,
  tokenExpiresIn,
} from '../shared'

export default async ({ based, payload }: Params) => {
  const { code, redirect, state, clientId } = payload

  const { project, env } = based.opts
  const privateKey = await based.secret(`users-private-key-${project}-${env}`)
  const githubClientSecret = await based.secret(
    `github-client-secret-${project}-${env}`
  )
  if (!clientId || !githubClientSecret) {
    throw new Error(
      `GitHub clientId should be sent in the payload and Client Secret should be configured as a secret with the name github-client-secret-${project}-${env}. Check this page for help: https://github.com/atelier-saulx/based/blob/main/packages/client/docs/auth-based-ui-howto.md`
    )
  }

  let accessTokenResponse: any
  try {
    accessTokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: githubClientSecret,
          code,
          redirect_uri: redirect,
        }),
      }
    ).then((response) => response.json())

    if (accessTokenResponse.error) {
      throw new Error(accessTokenResponse.error)
    }
  } catch (error) {
    throw new Error(error)
  }
  const { access_token: accessToken } = accessTokenResponse
  if (!accessToken) throw new Error('Could not get access_token')

  let profileResponse: any
  try {
    profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: 'token ' + accessToken,
      },
    }).then((response) => response.json())

    if (profileResponse.error) {
      throw new Error(profileResponse.error)
    }
  } catch (error) {
    throw new Error('error decoding thirdparty')
  }
  const {
    id,
    name,
    // avatar: avatar_url
  } = profileResponse

  let emailsResponse: any
  try {
    emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: 'token ' + accessToken,
      },
    }).then((response) => response.json())

    if (emailsResponse.error) {
      throw new Error(emailsResponse.error)
    }
  } catch (error) {
    throw new Error('error decoding thirdparty')
  }
  const email = emailsResponse.find(
    (e: { primary: boolean }) => e.primary === true
  )?.email
  if (!email) throw new Error('Could not fetch email')

  const alias = 'github-' + id

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
      email: user.email,
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
        // name: true,
        // aliases: true,
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
