import test from 'ava'
import createServer from '@based/server'
import based from '../src'
import { start } from '@saulx/selva-server'
import jwt from 'jsonwebtoken'
import { deepEqual, wait } from '@saulx/utils'
import { publicKey, privateKey } from './shared/keys'

let db

test.before(async () => {
  const selvaServer = await start({
    port: 9099,
  })
  db = selvaServer.selvaClient
  await selvaServer.selvaClient.updateSchema({
    types: {
      thing: {
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
})

test.after(async () => {
  await db.destroy()
})

test.serial('authorize functions', async (t) => {
  // shared observable

  const server = await createServer({
    port: 9100,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
      secrets: {
        'tally-jwt': publicKey,
      },
      authorizeConnection: async (req, ctx) => {
        console.info('authorizeConnection', ctx)
        return true
      },

      // this will be different
      authorize: async ({ user, payload, name, type, callStack }) => {
        // extra option is URN audience checks
        // timeout etc can also be automatic

        console.info('--->', callStack, name, type)

        const token = user && (await user.token('tally-jwt'))

        // pass where its called from

        // based.auth(await based.secret('myspecialapiuser'))

        // from Internal / External

        if (!token || token.foo !== 'bar') {
          return false
        }

        if (type === 'observe' && payload?.gurdy && !name) {
          return false
        }

        if (name === 'ale' && payload?.wrong) {
          throw new Error('very wrong yes')
        }

        if (name === 'advanced' && payload?.flappie) {
          return false
        }

        if (name === 'hello' && payload?.no) {
          return false
        }

        if (name === 'ale' && payload?.flap) {
          return false
        }

        return true
      },
      functions: {
        jim: {
          observable: false,
          authorize: async () => {
            console.info('jim function never works!')
            return false
          },
          function: async ({ based, callStack }) => {
            return { x: true }
          },
        },
        ale: {
          observable: false,
          function: async ({ based, callStack }) => {
            console.info(callStack)
            return based.get({
              $id: 'root',
              $all: true,
            })
          },
        },
        advanced: {
          shared: true,
          observable: true,
          function: async ({ payload, update, based }) => {
            return based.observe(payload, (data) => {
              update(data)
            })
          },
        },
        hello: {
          observable: false,
          function: async ({ based, payload }) => {
            return based.call('ale', payload)
          },
        },
      },
    },
  })

  const token = jwt.sign({ foo: 'bar' }, privateKey, { algorithm: 'RS256' })

  console.info(token)

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
    // can pass auth here as well
  })

  // can also await
  client.auth(token)

  try {
    await client.call('jim')
    t.fail('Unauthorized request "jim" did not throw!')
  } catch (err) {
    console.info(err)
    t.is(err.name, 'AuthorizationError from call "jim"')
  }

  let errCnt = 0

  try {
    await client.call('ale', { wrong: true })
    t.fail('Unauthorized request did not throw!')
  } catch (err) {
    console.info(err)
    t.true(err.message.includes('very wrong yes'))
    t.is(err.name, 'AuthorizationError from call "ale"')
  }

  await client.call('ale')

  const x = await client.call('hello', { yes: true })

  t.deepEqual(x, {
    id: 'root',
    type: 'root',
  })

  try {
    await client.call('hello', { flap: true })
    t.fail('Unauthorized request did not throw!')
  } catch (err) {
    console.info(err)
    t.true(err.message.includes('Function ale unauthorized request'))
    t.is(err.name, 'AuthorizationError from hello')
  }

  try {
    await client.call('hello', { no: true })
    t.fail('Unauthorized request did not throw!')
  } catch (err) {
    console.info(err)
    t.is(err.name, 'AuthorizationError from call "hello"')
  }

  const unsub = await client.observe(
    {
      things: {
        name: true,
        id: true,
        nested: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: {
              $operator: '=',
              $value: 'thing',
              $field: 'type',
            },
          },
        },
      },
    },
    (x) => {}
  )

  unsub()

  await client.observe(
    {
      gurdy: {},
    },
    (x) => {},
    () => {
      errCnt++
    }
  )

  const unsub2 = await client.observe(
    'advanced',
    {
      things: {
        name: true,
        id: true,
        nested: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: {
              $operator: '=',
              $value: 'thing',
              $field: 'type',
            },
          },
        },
      },
    },
    (x) => {}
  )

  unsub2()

  await client.observe(
    'advanced',
    {
      flappie: true,
    },
    (x) => {},
    () => {
      errCnt++
    }
  )

  try {
    await client.get('advanced', {
      flappie: true,
    })
    t.fail('Unauthorized observe advanced request did not throw!')
  } catch (err) {
    console.error(err)
    t.is(err.name, 'AuthorizationError from observe "advanced"')
  }

  // no hard crash plz
  await client.observe(
    'advanced',
    {
      gurdy: {},
    },
    (x) => {},
    () => {
      errCnt++
    }
  )

  client.auth(false)

  t.is(errCnt, 3)

  try {
    await client.get({ $id: 'root', $all: true })
    t.fail('No token not working')
  } catch (err) {
    console.error(err)
    t.true(err.message.includes('Unauthorized request'))
  }

  await server.destroy()
  client.disconnect()
})

test.serial('authorize login / out functions', async (t) => {
  const server = await createServer({
    port: 9100,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
      secrets: {
        'tally-jwt': publicKey,
      },
      authorizeConnection: async (req, ctx) => {
        console.info('authorizeConnection', ctx)
        return true
      },
      functions: {
        advanced: {
          observable: true,
          shared: true,
          function: async ({ payload, update, based, callStack }) => {
            return based.observe(payload, (data) => {
              update(data)
            })
          },
        },
      },
      authorize: async ({ user, payload, name, type, callStack }) => {
        console.info(name, type)

        if (!user && callStack.length === 0) {
          return false
        }

        const token = user ? await user.token('tally-jwt') : false

        if (
          type === 'observe' &&
          deepEqual(payload, {
            $id: 'root',
            $all: true,
          })
        ) {
          return true
        }

        if (
          callStack.length === 0 &&
          (!token || !(token.foo === 'bar' || token.admin))
        ) {
          return false
        }

        if (
          !name &&
          type === 'observe' &&
          deepEqual(payload, {
            $id: 'root',
            id: true,
          }) &&
          callStack[0] !== 'advanced'
        ) {
          return false
        }

        return true
      },
    },
  })

  const token = jwt.sign({ foo: 'bar' }, privateKey, { algorithm: 'RS256' })

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  let errorCnt = 0
  let receivedCnt = 0
  let publicSub = 0

  await client.observe(
    {
      $id: 'root',
      $all: true,
    },
    (x) => {
      publicSub++
    }
  )

  await client.observe(
    {
      things: {
        name: true,
        id: true,
        nested: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: {
              $operator: '=',
              $value: 'thing',
              $field: 'type',
            },
          },
        },
      },
    },
    () => {
      receivedCnt++
    },
    () => {
      errorCnt++
    }
  )

  client.auth(token)

  await wait(1e3)

  await client.observe(
    {
      things: {
        name: true,
        id: true,
        nested: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: {
              $operator: '=',
              $value: 'thing',
              $field: 'type',
            },
          },
        },
      },
    },
    () => {
      receivedCnt++
    },
    () => {
      errorCnt++
    }
  )

  client.auth(false)

  await wait(1e3)

  client.auth(token)

  await wait(1e3)

  t.is(errorCnt, 3, 'received 3 errors')
  t.is(receivedCnt, 4, 'received data 4 times')
  t.is(publicSub, 1, 'received public data 1 time')

  let errorCnt2 = 0
  let receivedCnt2 = 0

  await client.observe(
    {
      $id: 'root',
      id: true,
    },
    (x) => {
      receivedCnt2++
    },
    (err) => {
      console.error(err)
      errorCnt2++
    }
  )

  t.is(errorCnt2, 1, 'received 1 error for strict')
  t.is(receivedCnt2, 0, 'received data 0 times for strict')

  console.info('go advanced')
  await client.observe(
    'advanced',
    {
      $id: 'root',
      id: true,
    },
    (x) => {
      receivedCnt2++
    }
  )

  t.is(errorCnt2, 1)
  t.is(receivedCnt2, 1)

  await server.destroy()
  client.disconnect()

  t.pass()
})
