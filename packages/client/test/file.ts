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
          src: { type: 'url' },
          createdAt: { type: 'string' },
          progress: { type: 'number' },
          origin: { type: 'url' },
          size: { type: 'number' },
          mime: { type: 'string' },
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
          let c = 0
          let size = 0
          stream.on('data', (chunk) => {
            c++
            size += chunk.byteLength
          })
          stream.on('end', () => {
            console.info('chunks', c, 'size', size)
            resolve({
              src: 'flap',
              origin: 'hello',
            })
          })
        })
      },
      authorize: async () => {
        console.info('auth!')
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

  console.info(id)

  const d = Date.now()

  await client.observeUntil(
    {
      $id: id,
      progress: true,
    },
    (d) => {
      console.info(d)
      if (d.progress === 1) {
        return true
      }
    }
  )

  console.info('RDY', Date.now() - d, 'ms')

  await server.destroy()

  t.pass()
})
