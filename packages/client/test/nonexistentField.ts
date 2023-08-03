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
      user: {
        prefix: 'us',
        fields: {
          name: {
            type: 'string',
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

test.serial('invalid filter should not return result', async (t) => {
  await client.set({
    $language: 'en',
    type: 'user',
    name: 'Me me meeee',
  })

  const result = await client.get({
    $language: 'en',
    users: {
      id: true,
      name: true,
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'user',
            },
            {
              $field: 'nonexistent',
              $operator: '=',
              $value: 'something',
            },
          ],
        },
      },
    },
  })
  t.is(result.users.length, 0)
})
