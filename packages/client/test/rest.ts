import test from 'ava'
import createServer from '@based/server'
import { start } from '@saulx/selva-server'
import fetch from 'cross-fetch'
import { publicKey, privateKey } from './shared/keys'
import jwt from 'jsonwebtoken'

// add https://wfuzz.readthedocs.io/en/latest/
let db

test.before(async () => {
  const selvaServer = await start({
    port: 9201,
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

// need to add 'salt' for the hashing function in the db for passwords
test.serial('rest call request', async (t) => {
  const server = await createServer({
    port: 9200,
    db: {
      host: 'localhost',
      port: 9201,
    },
    config: {
      functions: {
        a: {
          shared: true,
          observable: true,
          function: async ({ update }) => {
            update({
              rando: Math.random(),
            })
            const int = setInterval(() => {
              update({
                rando: Math.random(),
              })
            }, 500)
            return () => {
              clearInterval(int)
            }
          },
        },
        hello: {
          observable: false,
          function: async ({ payload, user }) => {
            // payload can also be the next segment in the url

            if (payload) {
              return {
                yes: '!',
                payload,
              }
            }

            return {
              snapje: 'ja',
            }
          },
        },
      },
    },
  })

  const a = await fetch('http://localhost:9200')
  const b = await fetch('http://localhost:9200/')
  const c = await fetch('http://localhost:9200/flurp')

  t.is(a.status, 400)
  t.is(b.status, 400)
  t.is(c.status, 400)

  const d = await fetch('http://localhost:9200/call/hello').then((r) =>
    r.json()
  )

  t.deepEqual(d, { snapje: 'ja' })

  const e = await fetch('http://localhost:9200/call/hello', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify({
      gurk: true,
    }),
  }).then((r) => r.json())

  t.deepEqual(e, { yes: '!', payload: { gurk: true } })

  const f = await fetch('http://localhost:9200/set', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify({
      type: 'thing',
      name: 'rest thing',
    }),
  }).then((r) => r.json())

  t.true(!!f.id)

  const g = await fetch('http://localhost:9200/get', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify({
      things: {
        $all: true,
        $list: {
          $find: {
            $traverse: 'children',
            $filter: {
              $operator: '=',
              $field: 'type',
              $value: 'thing',
            },
          },
        },
      },
    }),
  }).then((r) => r.json())

  t.is(g.things.length, 1)

  const h = await fetch('http://localhost:9200/get', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      things: {
        $all: true,
        $list: {
          $find: {
            $filter: {
              $operator: '=',
              $field: 'type',
              $value: 'thing',
            },
          },
        },
      },
    }),
  })
    .then((r) => r.json())
    .catch((err) => {
      console.error(err)
    })

  t.true(!!h.things)

  const i = await fetch('http://localhost:9200/get/a').then((r) => r.json())

  t.true(!!i.rando)

  const j = await fetch('http://localhost:9200/schema').then((r) => r.json())

  t.true(!!j.dbs)
  t.true(!!j.schema?.default)

  const k = await fetch('http://localhost:9200/digest', {
    method: 'POST',
    body: 'flap',
  }).then((r) => r.json())

  t.is(k, 'cdae30e6ee84a00994cf3f3e0872c1a3a34d8adaf34b40e613b66d9a591bde72')

  const l = await fetch('http://localhost:9200/copy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      $id: f.id,
    }),
  }).then((r) => r.json())

  t.is(l.ids.length, 1)

  const m = await fetch('http://localhost:9200/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      $id: f.id,
    }),
  }).then((r) => r.json())

  t.is(m.isDeleted, 1)

  const n = await fetch('http://localhost:9200/update-schema', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      schema: {
        types: {
          flap: {
            fields: {
              gur: { type: 'int' },
            },
          },
        },
      },
    }),
  }).then((r) => r.json())

  t.true(n.updatedSchema)

  const o = await fetch('http://localhost:9200/call/hello.csv').then((r) =>
    r.text()
  )

  t.is(o, 'snapje\nja')

  await server.destroy()

  t.pass()
})

test.serial('rest authorization', async (t) => {
  const server = await createServer({
    port: 9200,
    db: {
      host: 'localhost',
      port: 9201,
    },
    config: {
      secrets: {
        'tally-jwt': publicKey,
      },
      authorize: async ({ user }) => {
        const token = user && (await user.token('tally-jwt'))
        if (!token) {
          return false
        }
        return true
      },
      functions: {
        a: {
          shared: true,
          observable: true,
          function: async ({ update }) => {
            update({
              rando: Math.random(),
            })
            const int = setInterval(() => {
              update({
                rando: Math.random(),
              })
            }, 500)
            return () => {
              clearInterval(int)
            }
          },
        },
        hello: {
          observable: false,
          function: async ({ payload, user }) => {
            if (payload) {
              return {
                yes: '!',
                payload,
              }
            }
            return {
              snapje: 'ja',
            }
          },
        },
      },
    },
  })

  const a = await fetch('http://localhost:9200/call/hello').then((r) =>
    r.json()
  )

  t.is(a.error.type, 'AuthorizationError')

  const token = jwt.sign({ foo: 'bar' }, privateKey, { algorithm: 'RS256' })

  const b = await fetch('http://localhost:9200/call/hello', {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  }).then((r) => r.json())

  t.is(b.snapje, 'ja')

  await server.destroy()

  t.pass()
})
