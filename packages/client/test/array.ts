import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
const port = 8081
test.beforeEach(async (t) => {
  console.log('origin')
  srv = await startOrigin({
    port,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    languages: ['en'],
    types: {
      thing: {
        prefix: 'th',
        fields: {
          formFields: {
            type: 'array',
            values: {
              type: 'object',
              properties: {
                title: { type: 'text' },
              },
            },
          },
        },
      },
    },
  })
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

// TODO: waiting for delete
test.serial.skip('can use $delete inside array', async (t) => {
  const id = await client.set({
    $language: 'en',
    type: 'thing',
    formFields: [
      {
        title: 'foo',
      },
    ],
  })

  await client.set({
    // Using lang here would leave an empty title object.
    //$language: 'en',
    $id: id,
    formFields: {
      $assign: {
        $idx: 0,
        $value: {
          title: { $delete: true },
        },
      },
    },
  })

  const result = await client.get({
    $id: id,
    $all: true,
    createdAt: false,
    updatedAt: false,
  })
  t.deepEqual(result, {
    id: id,
    type: 'thing',
    formFields: [{}],
  })
})
