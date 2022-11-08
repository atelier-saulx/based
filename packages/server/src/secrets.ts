import { BasedServer } from '.'
import jwt, { SignOptions } from 'jsonwebtoken'
import { BasedError, BasedErrorCodes } from '@based/types'

const jwtDecode = (
  resolve: (value: any) => void,
  reject: (reason: any) => void,
  value: string,
  publicKey: string
) => {
  try {
    jwt.verify(
      value,
      publicKey,
      {
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) {
          if (err instanceof jwt.TokenExpiredError) {
            const basedError = new BasedError('Token expired')
            basedError.code = BasedErrorCodes.TokenExpired
            basedError.stack = err.stack
            reject(basedError)
          } else {
            resolve(false)
          }
        } else {
          resolve(decoded)
        }
      }
    )
  } catch (err) {
    reject(err)
  }
}

export const getSecret = async (
  server: BasedServer,
  secret: string
): Promise<any> => {
  let cert = server.config?.secrets?.[secret]

  // can make a thing to update it as well - but later...
  if (server.config?.secretsConfig) {
    if (!server.config.secretsConfig.secretTimeouts) {
      server.config.secretsConfig.secretTimeouts = {}
    }

    if (!cert) {
      cert = await server.config.secretsConfig.getInitial(server, secret)

      if (!cert) {
        return null
      }
      if (!server.config.secrets) {
        server.config.secrets = {}
      }

      server.config.secretsConfig.secretTimeouts[secret] = 0
      server.config.secrets[secret] = cert
    } else {
      if (server.config.secretsConfig.secretTimeouts[secret] !== undefined) {
        server.config.secretsConfig.secretTimeouts[secret] = 0
      }
    }
  }

  return cert || false
}

const cleanCarriageReturn = (value: string) =>
  typeof value === 'string' ? value.replace(/\n$/, '') : value

export const decodeToken = (value: string, publicKey: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    jwtDecode(resolve, reject, cleanCarriageReturn(value), publicKey)
  })
}

export const encodeValueBySecret = (
  server: BasedServer,
  payload: string | object,
  privateKeySecretOrKey: string | { secret?: string; key?: string },
  type: 'jwt' = 'jwt',
  signOptions?: SignOptions
): Promise<any> => {
  return new Promise((resolve, reject) => {
    new Promise((resolve, reject) => {
      if (typeof privateKeySecretOrKey === 'string') {
        resolve(getSecret(server, privateKeySecretOrKey))
      } else if (privateKeySecretOrKey.secret) {
        resolve(getSecret(server, privateKeySecretOrKey.secret))
      } else if (privateKeySecretOrKey.key) {
        resolve(privateKeySecretOrKey.key)
      } else {
        reject(new Error('Need to pass a secret name or a key'))
      }
    })
      .then((privateKey: string) => {
        if (privateKey) {
          const defaultOptions: SignOptions = {
            expiresIn: '2d',
            algorithm: 'RS256',
          }
          if (type === 'jwt') {
            jwt.sign(
              payload,
              privateKey,
              { ...defaultOptions, ...signOptions },
              (err, decoded) => {
                if (err) {
                  resolve(false)
                } else {
                  resolve(decoded)
                }
              }
            )
          } else {
            reject(new Error(`Encode ${type} not implementedd yet`))
          }
        } else {
          reject(new Error(`Secret does not exist ${privateKeySecretOrKey}`))
        }
      })
      .catch((err) => {
        reject(err)
      })
  })
}

export const decodeValueBySecret = (
  server: BasedServer,
  value: string,
  publicKeySecret: string,
  type: 'jwt' = 'jwt'
): Promise<any> => {
  return new Promise((resolve, reject) => {
    // make this better
    getSecret(server, publicKeySecret)
      .then((publicKey) => {
        if (publicKey) {
          if (type === 'jwt') {
            try {
              jwtDecode(resolve, reject, cleanCarriageReturn(value), publicKey)
            } catch (err) {
              reject(err)
            }
          } else {
            console.error(`decode ${type} not implemented yet`)
          }
        } else {
          reject(new Error(`Secret does not exist ${publicKeySecret}`))
        }
      })
      .catch((err) => {
        reject(err)
      })
  })
}
