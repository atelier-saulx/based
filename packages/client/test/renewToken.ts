import anyTest, { TestInterface } from 'ava'
import jwt from 'jsonwebtoken'
import createServer from '@based/server'
import { start, startOrigin } from '@saulx/selva-server'
import based from '@based/client'
import { SelvaClient } from '@saulx/selva'
import { generateKeyPair } from 'crypto'
import defaultAuthorize from '../../../env-services/hub/src/auth/functions/defaultAuthorize'
import renewToken from '../../../env-services/hub/src/auth/functions/renewToken'
import { TokenBody } from '../../../env-services/hub/src/auth/functions/types'

const authSchema = {
  languages: ['en'],
  rootType: {
    fields: {
      publicKey: { type: 'string' },
      privateKey: { type: 'string' },
    },
  },
  types: {
    user: {
      prefix: 'us',
      fields: {
        name: { type: 'string' },
        email: { type: 'email' },
        password: { type: 'digest' },
      },
    },
  },
}

const test = anyTest as TestInterface<{
  db: SelvaClient
  publicKey: string
  privateKey: string
}>

const generateKeys = () =>
  new Promise<{ privateKey: string; publicKey: string }>((resolve, reject) => {
    generateKeyPair(
      'rsa',
      {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'pkcs1',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs1',
          format: 'pem',
        },
      },
      (err, publicKey, privateKey) => {
        if (err) {
          reject(err)
        }
        resolve({ publicKey, privateKey })
      }
    )
  })

test.before(async (t) => {
  const selvaServer = await start({
    port: 9401,
  })
  t.context.db = selvaServer.selvaClient
  // @ts-ignore
  await t.context.db.updateSchema(authSchema)
  await t.context.db.updateSchema({
    types: {
      thing: {
        prefix: 'th',
        fields: {
          name: { type: 'string' },
          nested: {
            type: 'object',
            properties: {
              something: { type: 'string' },
            },
          },
        },
      },
    },
  })
  const keys = await generateKeys()
  t.context.privateKey = keys.privateKey
  t.context.publicKey = keys.publicKey
  await t.context.db.set({
    $id: 'root',
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  })
})

test.after(async (t) => {
  await t.context.db.destroy()
})

test.serial('should renew a token', async (t) => {
  t.timeout(5000)
  t.plan(2)

  const id = 'wawa'
  const exampleUser = {
    email: 'beerdejim@gmail.com',
    password: 'mysnurkels',
  }

  const token = jwt.sign(
    {
      id,
    },
    t.context.privateKey,
    {
      expiresIn: '-2s',
      algorithm: 'RS256',
    }
  )
  const refreshToken = jwt.sign(
    {
      id,
      refreshToken: true,
    },
    t.context.privateKey,
    {
      expiresIn: '1d',
      algorithm: 'RS256',
    }
  )

  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      defaultAuthorize,
      login: async () => {
        return { token, refreshToken }
      },
      // TODO: add assertion that this was called
      renewToken: async (props) => {
        const result = await renewToken(props)
        // check new token
        const newTokenBody = jwt.verify(
          result.token,
          t.context.publicKey
        ) as TokenBody
        t.is(newTokenBody.id, id)
        return result
      },
    },
  })

  await t.context.db.set({
    type: 'user',
    ...exampleUser,
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9333'
    },
  })
  t.teardown(async () => {
    await server.destroy()
    client.disconnect()
  })

  await client.login(exampleUser)
  const result = await client.get({ $id: 'root', id: true })
  t.is(result.id, 'root')
})
