import test from 'ava'
import { start } from '@saulx/selva-server'
import createServer from '@based/server'
import based from '../src'

let db

test.before(async () => {
  const selvaServer = await start({
    port: 9201,
  })
  db = selvaServer.selvaClient
  await selvaServer.selvaClient.updateSchema({
    types: {
      file: {
        prefix: 'fi',
        fields: {
          version: { type: 'string' },
          src: { type: 'url' },
          createdAt: { type: 'string' },
          progress: { type: 'number' },
          origin: { type: 'url' },
          size: { type: 'number' },
          mime: { type: 'string' },
          mimeType: { type: 'string' },
          status: { type: 'number' },
          renditions: {
            type: 'object',
            properties: {
              small: { type: 'url' },
              medium: { type: 'url' },
              large: { type: 'url' },
            },
          },
        },
      },
      thing: {
        prefix: 'th',
        fields: {
          name: { type: 'string' },
          image: { type: 'reference' }, // will add strict types
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
})

test.after(async () => {
  await db.destroy()
})

test.serial('file', async (t) => {
  // also start a file upload server else its a bit hard to test

  const server = await createServer({
    port: 9100,
    db: {
      host: 'localhost',
      port: 9201,
    },
    // handle file store (is a function to configure)
    config: {
      storeFile: ({ stream }) => {
        return new Promise((resolve) => {
          stream.on('data', () => {})
          stream.on('end', () => {
            resolve({
              version: 'x',
              src: 'http://www.hello.com/flap',
              origin: 'http://www.hello.com/flap',
              status: 3,
            })
          })
        })
      },
      authorize: async () => {
        return true
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  await client.auth('mytoken')

  let hugeString = ''
  for (let i = 0; i < 1000e3; i++) {
    hugeString += 'flap drol ' + i
  }

  const { id } = await client.file({
    contents: hugeString, // implement stream in node.js
    mimeType: 'text/plain',
    name: 'myfile',
  })

  await client.observeUntil(
    {
      $id: id,
      progress: true,
    },
    (d) => {
      if (d.progress === 1) {
        return true
      }
    }
  )

  await server.destroy()

  t.pass()
})
