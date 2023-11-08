import test from 'ava'
import { wait } from '@saulx/utils'
import { start } from '@saulx/selva-server'
import { SelvaClient } from '@saulx/selva'
import { gqlDb, gql as initGql } from '@based/graphql'

export type GenericObject = { [key: string]: any }

// add https://wfuzz.readthedocs.io/en/latest/

let db: SelvaClient

const schema: any = {
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
    port: t.context.port,
  })
  db = selvaServer.selvaClient
  await selvaServer.selvaClient.updateSchema(schema)
})

test.after(async () => {
  await db.destroy()
})

test('Get', async (t: T) => {
  // await client.schema()

  // // FIXME start
  // await client.get('$configuration')

  // const cfgCleanup = await client.observe('$configuration', () => {})
  // // FIXME end

  const { schema: s } = await db.getSchema()

  await wait(1000)
  const gql = initGql({ default: s })

  const setQuery = gql`
    mutation MakeMatch {
      createMatch(
        input: {
          sortNum: 1
          name: "something"
          flapperdrol: { hello: { abba: "cd" } }
        }
      ) {
        id
        type
      }

      ping(payload: { hello: "yo" })
    }
  `

  console.log(JSON.stringify(setQuery, null, 2))

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

  const id = await db.set(setQuery)

  const {
    data: {
      createMatch: { type },
      ping,
    },
  } = await db.get({ $id: id, $all: true })

  t.deepEqual(type, 'match')
  t.deepEqual(ping, {
    hello: 'hello',
    pong: { hello: 'yo' },
  })

  // const d = await client.graphql.query(`
  //   mutation HelloMutation {
  //     setMatch(id: "maHello", input: { sortNum: 0, name: "something", flapperdrol: { hello: { cd: "abba" }}}) {
  //       id
  //       name
  //       flapperdrol
  //     }
  //   }
  // `)

  // t.deepEqual(d, {
  //   data: {
  //     setMatch: {
  //       id: 'maHello',
  //       name: 'something',
  //       flapperdrol: {
  //         hello: {
  //           cd: 'abba',
  //         },
  //       },
  //     },
  //   },
  // })

  // const getQuery = `
  //  query GetMatch($id: ID!) {
  //    match(id: $id) {
  //      id
  //      _all
  //    }
  //  }
  //  `

  // const data = await client.graphql.query(getQuery, { id })

  // delete data.data.match.createdAt
  // delete data.data.match.updatedAt
  // t.deepEqual(data, {
  //   data: {
  //     match: {
  //       id,
  //       sortNum: 1,
  //       type: 'match',
  //       name: 'something',
  //       flapperdrol: {
  //         hello: {
  //           abba: 'cd',
  //         },
  //       },
  //     },
  //   },
  // })

  // const fnQuery = `
  //  query GetFn($id: ID!) {
  //    match(id: $id) {
  //      id
  //      _all
  //    }

  //    hello: observeFn(name: "hello", payload: { thing: [1,2], str: "string!" })
  //    hello2: hello(payload: { thing: [1,2], str: "string!" })
  //  }
  //  `

  // const fnData = await client.graphql.query(fnQuery, { id })

  // delete fnData.data.match.createdAt
  // delete fnData.data.match.updatedAt
  // t.deepEqual(fnData, {
  //   data: {
  //     match: {
  //       id,
  //       sortNum: 1,
  //       type: 'match',
  //       name: 'something',
  //       flapperdrol: {
  //         hello: {
  //           abba: 'cd',
  //         },
  //       },
  //     },
  //     hello: {
  //       hello: 'hello',
  //       pong: { thing: [1, 2], str: 'string!' },
  //     },
  //     hello2: {
  //       hello: 'hello',
  //       pong: { thing: [1, 2], str: 'string!' },
  //     },
  //   },
  // })

  // t.assert(
  //   (await client.graphql.query(getQuery, {})).errors[0].message.includes(
  //     'Variable id required'
  //   )
  // )

  // let cnt1 = 0
  // const obs1 = await client.graphql.live(getQuery, { id })
  // const sub1 = obs1.subscribe((resp) => {
  //   const d = resp.data.match

  //   if (cnt1 === 0) {
  //     t.deepEqual(d.name, 'something')
  //   } else if (cnt1 === 1) {
  //     t.deepEqual(d.name, 'hello new name')
  //   } else if (cnt1 === 2) {
  //     t.deepEqual(d.name, 'hello new name (again)')
  //   } else {
  //     t.fail()
  //   }

  //   cnt1++
  // })

  // await wait(1000)

  // let cnt2 = 0
  // const obs2 = await client.graphql.live(
  //   `
  //   mutation ChangeThingsLive($id: ID!) {
  //     hello: setMatch(id: $id, input: { name: "hello new name" }) {
  //       id
  //       name
  //       flapperdrol
  //     }
  //   }
  // `,
  //   { id }
  // )
  // const sub2 = obs2.subscribe((resp) => {
  //   const d = resp.data.hello

  //   if (cnt2 === 0) {
  //     t.deepEqual(d.name, 'hello new name')
  //   } else if (cnt2 === 1) {
  //     t.deepEqual(d.name, 'hello new name (again)')
  //   } else {
  //     t.fail()
  //   }

  //   cnt2++
  // })

  // await wait(1000)

  // await client.graphql.query(
  //   client.gqlDb('default')`
  //   mutation ChangeThings($id: ID!, $nameThing: String!) {
  //     hello: setMatch(id: $id, input: { name: $nameThing }) {
  //       id
  //     }
  //   }
  // `,
  //   { id, nameThing: 'hello new name (again)' }
  // )

  // await wait(1000)

  // t.deepEqual(cnt1, 3)
  // t.deepEqual(cnt2, 2)

  // sub1.unsubscribe()
  // sub2.unsubscribe()

  // const obsFnQuery = `
  //  query GetMatch($id: ID!) {
  //    match(id: $id) {
  //      id
  //    }

  //    hello: observeFn(name: "counter", payload: { thing: [1,2], str: "string!" })
  //  }
  //  `

  // const obs3 = await client.graphql.live(obsFnQuery, { id })
  // let hello = {}
  // let helloEvents = 0
  // const sub3 = obs3.subscribe((resp) => {
  //   hello = resp

  //   if (helloEvents === 0) {
  //     t.deepEqual(resp, {
  //       data: {
  //         match: {
  //           id,
  //         },
  //       },
  //     })
  //   } else if (helloEvents === 2) {
  //     t.deepEqual(resp, {
  //       data: {
  //         match: {
  //           id,
  //         },
  //         hello: {
  //           payload: {
  //             thing: [1, 2],
  //             str: 'string!',
  //           },
  //           cnt: helloEvents,
  //         },
  //       },
  //     })
  //   }

  //   helloEvents++
  // })

  // await wait(1600)

  // t.deepEqual(helloEvents, 4)
  // t.deepEqual(hello, {
  //   data: {
  //     match: { id },
  //     hello: {
  //       payload: {
  //         thing: [1, 2],
  //         str: 'string!',
  //       },
  //       cnt: 3,
  //     },
  //   },
  // })

  // sub3.unsubscribe()

  // cfgCleanup()

  // const traverseQuery = `
  //  query GetMatches($id: ID!) {
  //    root {
  //      descendants(sortBy: {field: "sortNum", order: ASC}) {
  //        ... on Match {
  //          _all
  //        }
  //      }
  //    }
  //  }
  //  `
  // await client.graphql.query(traverseQuery)

  // client.disconnect()
  // await server.destroy()
})
