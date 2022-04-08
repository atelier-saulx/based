import anyTest, { TestInterface } from 'ava'
import createServer from '@based/server'
import { start, startOrigin } from '@saulx/selva-server'
import based from '@based/client'
import { SelvaClient } from '@saulx/selva'
import { generateKeyPair } from 'crypto'
import { wait } from '@saulx/utils'
import login from '../../../env-services/hub/src/auth/functions/login'
import logout from '../../../env-services/hub/src/auth/functions/logout'
import defaultAuthorize from '../../../env-services/hub/src/auth/functions/defaultAuthorize'

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

test.serial('login', async (t) => {
  t.timeout(5000)

  const exampleUser = {
    email: 'beerdejim@gmail.com',
    password: 'mysnurkels',
  }

  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      defaultAuthorize,
      login,
      logout,
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

  await t.notThrowsAsync(async () => {
    const response = await client.login(exampleUser)
    t.is(typeof response.token, 'string')
  })

  const x = await client.get({
    $id: 'root',
    id: true,
  })
  t.is(x.id, 'root')

  await wait(3e3)

  await t.notThrowsAsync(async () => {
    await client.logout()
  })

  const error = await t.throwsAsync(async () => {
    const result = await client.get({
      $id: 'root',
      id: true,
    })
    t.log(result)
  })
  t.regex(error.name, /^AuthorizationError/)
})
