import { Params } from '@based/server'
import fetch from 'node-fetch'
import {
  generateTokens,
  refreshTokenExpiresIn,
  tokenExpiresIn,
} from '../shared'

export default async ({ based, payload }: Params) => {
  const { code, redirect, state, clientId } = payload
  let response: any

  const { project, env } = based.opts
  const privateKey = await based.secret(`users-private-key-${project}-${env}`)
  const googleClientSecret = await based.secret(
    `google-client-secret-${project}-${env}`
  )
  if (!clientId || !googleClientSecret) {
    throw new Error(
      `Google clientId needs to be sent in the payload and Client Secret should be configured as a secret with the name google-client-secret-${project}-${env}`
    )
  }

  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: googleClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirect,
      }),
    }).then((response) => response.json())

    if (response.error) {
      throw new Error(response.error)
    }
  } catch (error) {
    throw new Error(error)
  }

  const url =
    'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos'

  try {
    response = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + response.access_token,
      },
    }).then((response) => response.json())

    if (response.error) {
      throw new Error(response.error)
    }
  } catch (error) {
    console.error(error)
    throw new Error('error decoding thirdparty')
  }

  const {
    resourceName,
    names: [{ displayName: name }],
    emailAddresses: [{ value: email }],
    // photos: [{ url: photo }],
  } = response

  const alias = 'google-' + resourceName.split('/')[1]

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

  console.log({ existingUser })
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
    console.log({ id })

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
