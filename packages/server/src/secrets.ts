import { BasedServer } from '.'
import jwt, { SignOptions } from 'jsonwebtoken'

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

export const decodeToken = (value: string, publicKey: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    jwt.verify(value, publicKey, (err, decoded) => {
      if (err) {
        resolve(false)
      } else {
        resolve(decoded)
      }
    })
  })
}

export const encodeValueBySecret = (
  server: BasedServer,
  payload: string | object,
  privateKeySecret: string,
  type: 'jwt' = 'jwt',
  signOptions?: SignOptions
): Promise<any> => {
  return new Promise((resolve, reject) => {
    getSecret(server, privateKeySecret).then((privateKey) => {
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
          throw new Error(`Encode ${type} not implementedd yet`)
        }
      } else {
        reject(new Error(`Secret does not exist ${privateKeySecret}`))
      }
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
    getSecret(server, publicKeySecret).then((publicKey) => {
      if (publicKey) {
        if (type === 'jwt') {
          jwt.verify(value, publicKey, (err, decoded) => {
            if (err) {
              resolve(false)
            } else {
              resolve(decoded)
            }
          })
        } else {
          console.error(`decode ${type} not implementedd yet`)
        }
      } else {
        reject(new Error(`Secret does not exist ${publicKeySecret}`))
      }
    })
  })
}
