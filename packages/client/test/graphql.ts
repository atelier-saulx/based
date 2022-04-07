import test from 'ava'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
import based from '../src'
import { start } from '@saulx/selva-server'
import { SchemaOptions } from '../src/selvaTypes/schema'

// add https://wfuzz.readthedocs.io/en/latest/

let db

const schema: SchemaOptions = {
  languages: ['nl', 'en'],
  rootType: {
    fields: {
      children: { type: 'references' },
      descendants: { type: 'references' },
      id: { type: 'id' },
      type: { type: 'type' },
      value: { type: 'number' },
    },
  },
  types: {
    league: {
      prefix: 'le',
    },
    person: {
      prefix: 'pe',
    },
    video: {
      prefix: 'vi',
    },
    vehicle: {
      prefix: 've',
    },
    family: {
      prefix: 'fa',
    },
    team: {
      prefix: 'te',
    },
    match: {
      prefix: 'ma',
      fields: {
        sortNum: { type: 'number' },
        homeTeam: { type: 'reference' },
        awayTeam: { type: 'reference' },
        smurky: {
          meta: {
            yesh: 'a meta value',
            data: ['in an array'],
          },
          type: 'set',
          items: {
            type: 'object', // stored as json in this case (scince you start with a set)
            properties: {
              interval: {
                type: 'array',
                items: {
                  type: 'timestamp',
                },
              },
              url: { type: 'url' },
            },
          },
        },
        flurpy: {
          type: 'object',
          properties: {
            snurkels: {
              type: 'string',
              search: { type: ['TAG'] },
            },
          },
        },
        flapperdrol: {
          type: 'json',
          // timeseries: true, // TODO
        },
        video: {
          type: 'object',
          properties: {
            mp4: {
              type: 'url',
            },
            hls: {
              type: 'url',
              search: { index: 'hls', type: ['TEXT'] },
            },
            pano: {
              type: 'url',
            },
            overlays: {
              type: 'array',
              items: {
                type: 'json', // needs to be json!
                properties: {
                  interval: {
                    type: 'array',
                    items: {
                      type: 'timestamp',
                    },
                  },
                  url: { type: 'url' },
                },
              },
            },
          },
        },
      },
    },
  },
}

test.before(async () => {
  const selvaServer = await start({
    port: 9091,
  })
  db = selvaServer.selvaClient
  await selvaServer.selvaClient.updateSchema(schema)
})

test.after(async () => {
  await db.destroy()
})

test.serial('Get', async (t) => {
  const server = await createServer({
    port: 9910,
    db: {
      host: 'localhost',
      port: 9091,
    },
    config: {
      functions: {
        hello: {
          shared: true,
          observable: true,
          function: async ({ update, payload }) => {
            update({
              hello: 'hello',
              pong: payload,
            })

            return () => {}
          },
        },
        ping: {
          observable: false,
          function: async ({ payload }) => {
            return {
              hello: 'hello',
              pong: payload,
            }
          },
        },
        counter: {
          shared: true,
          observable: true,
          function: async ({ update, payload }) => {
            let cnt = 0
            const interval = setInterval(() => {
              update({
                payload,
                cnt: ++cnt,
              })
            }, 500)
            return () => {
              clearInterval(interval)
            }
          },
        },
      },
    },
  })

  await wait(1e3)

  // @ts-ignore
  server.config.functionConfig = {
    // @ts-ignore
    subscribeFunctions(cb) {
      cb(null, server.config?.functions)
      const interval = setInterval(() => {
        cb(null, server.config.functions)
      }, 550)
      return () => {
        clearInterval(interval)
      }
    },
    getInitial(server, name) {
      return Promise.resolve(server.config.functions[name])
    },
  }

  console.log('CONFIG', server.config)

  const client = based({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await client.schema()

  // FIXME start
  const firstCfg = await client.get('$configuration')
  console.log('FIRST CONFIG', firstCfg)

  const cfgCleanup = await client.observe('$configuration', (cfg) => {
    console.log('---> SUB CONFIGURATION', cfg)
  })
  // FIXME end

  const setQuery = `
    mutation MakeMatch {
      createMatch(input: { sortNum: 1, name: "something", flapperdrol: { hello: { abba: "cd" }}}) {
        id
        type
      }

      ping(payload: { hello: "yo" })
    }
  `
  // const { id } = await client.set({
  //   $language: 'en',
  //   type: 'match',
  //   name: 'something',
  //   flapperdrol: {
  //     hello: {
  //       abba: 'cd',
  //     },
  //   },
  // })

  const {
    data: {
      createMatch: { id, type },
      ping,
    },
  } = await client.graphql.query(setQuery)

  console.log('PING', ping)
  t.deepEqual(type, 'match')
  t.deepEqual(ping, {
    hello: 'hello',
    pong: { hello: 'yo' },
  })

  const d = await client.graphql.query(`
    mutation HelloMutation {
      setMatch(id: "maHello", input: { sortNum: 0, name: "something", flapperdrol: { hello: { cd: "abba" }}}) {
        id
        name
        flapperdrol
      }
    }
  `)

  t.deepEqual(d, {
    data: {
      setMatch: {
        id: 'maHello',
        name: 'something',
        flapperdrol: {
          hello: {
            cd: 'abba',
          },
        },
      },
    },
  })

  const getQuery = `
   query GetMatch($id: ID!) {
     match(id: $id) {
       id
       _all
     }
   }
   `

  const data = await client.graphql.query(getQuery, { id })

  t.deepEqual(data, {
    data: {
      match: {
        id,
        sortNum: 1,
        type: 'match',
        name: 'something',
        flapperdrol: {
          hello: {
            abba: 'cd',
          },
        },
      },
    },
  })

  const fnQuery = `
   query GetFn($id: ID!) {
     match(id: $id) {
       id
       _all
     }

     hello: observeFn(name: "hello", payload: { thing: [1,2], str: "string!" })
     hello2: hello(payload: { thing: [1,2], str: "string!" })
   }
   `

  const fnData = await client.graphql.query(fnQuery, { id })

  t.deepEqual(fnData, {
    data: {
      match: {
        id,
        sortNum: 1,
        type: 'match',
        name: 'something',
        flapperdrol: {
          hello: {
            abba: 'cd',
          },
        },
      },
      hello: {
        hello: 'hello',
        pong: { thing: [1, 2], str: 'string!' },
      },
      hello2: {
        hello: 'hello',
        pong: { thing: [1, 2], str: 'string!' },
      },
    },
  })

  t.assert(
    (await client.graphql.query(getQuery, {})).errors[0].message.includes(
      'Variable id required'
    )
  )

  let cnt1 = 0
  const obs1 = await client.graphql.live(getQuery, { id })
  const sub1 = obs1.subscribe((resp) => {
    console.log('RAW 1', resp)
    const d = resp.data.match

    if (cnt1 === 0) {
      t.deepEqual(d.name, 'something')
    } else if (cnt1 === 1) {
      t.deepEqual(d.name, 'hello new name')
    } else if (cnt1 === 2) {
      t.deepEqual(d.name, 'hello new name (again)')
    } else {
      t.fail()
    }

    cnt1++
  })

  await wait(1000)

  let cnt2 = 0
  const obs2 = await client.graphql.live(
    `
    mutation ChangeThingsLive($id: ID!) {
      hello: setMatch(id: $id, input: { name: "hello new name" }) {
        id
        name
        flapperdrol
      }
    }
  `,
    { id }
  )
  const sub2 = obs2.subscribe((resp) => {
    console.log('RAW 2', resp)
    const d = resp.data.hello

    if (cnt2 === 0) {
      t.deepEqual(d.name, 'hello new name')
    } else if (cnt2 === 1) {
      t.deepEqual(d.name, 'hello new name (again)')
    } else {
      t.fail()
    }

    cnt2++
  })

  await wait(1000)

  await client.graphql.query(
    client.gqlDb('default')`
    mutation ChangeThings($id: ID!, $nameThing: String!) {
      hello: setMatch(id: $id, input: { name: $nameThing }) {
        id
      }
    }
  `,
    { id, nameThing: 'hello new name (again)' }
  )

  await wait(1000)

  t.deepEqual(cnt1, 3)
  t.deepEqual(cnt2, 2)

  sub1.unsubscribe()
  sub2.unsubscribe()

  const obsFnQuery = `
   query GetMatch($id: ID!) {
     match(id: $id) {
       id
     }

     hello: observeFn(name: "counter", payload: { thing: [1,2], str: "string!" })
   }
   `

  const obs3 = await client.graphql.live(obsFnQuery, { id })
  let hello = {}
  let helloEvents = 0
  const sub3 = obs3.subscribe((resp) => {
    console.log('HELLO', resp)
    hello = resp

    if (helloEvents === 0) {
      t.deepEqual(resp, {
        data: {
          match: {
            id,
          },
        },
      })
    } else if (helloEvents === 2) {
      t.deepEqual(resp, {
        data: {
          match: {
            id,
          },
          hello: {
            payload: {
              thing: [1, 2],
              str: 'string!',
            },
            cnt: helloEvents,
          },
        },
      })
    }

    helloEvents++
  })

  await wait(1600)

  t.deepEqual(helloEvents, 4)
  t.deepEqual(hello, {
    data: {
      match: { id },
      hello: {
        payload: {
          thing: [1, 2],
          str: 'string!',
        },
        cnt: 3,
      },
    },
  })

  sub3.unsubscribe()

  cfgCleanup()

  const traverseQuery = `
   query GetMatches($id: ID!) {
     root {
       descendants(sortBy: {field: "sortNum", order: ASC}) {
         ... on Match {
           _all
         }
       }
     }
   }
   `
  const descs = await client.graphql.query(traverseQuery)
  console.log('HELLO', JSON.stringify(descs, null, 2))

  client.disconnect()
  await server.destroy()
})
