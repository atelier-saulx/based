import test from 'ava'
import { BasedDbClient } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import { worker } from './assertions/utils'
import './assertions'
import getPort from 'get-port'

let srv: SelvaServer
let client: BasedDbClient
let port
test.beforeEach(async (t) => {
  port = await getPort()
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
      glurp: {
        prefix: 'gl',
        fields: {
          levelCnt: { type: 'number' },
          title: { type: 'string' },
        },
      },
    },
  })
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
})

// TODO: setWalker parse error (Jim)
test.serial.skip('get very deep results', async (t) => {
  const q: any = {}
  let s: any = q

  const setObj: any = {}
  const levels = 12
  const amount = 2

  for (let i = 0; i < levels; i++) {
    s.$find = {
      $traverse: 'children',
      $filter: {
        $field: 'type',
        $operator: '=',
        $value: 'glurp',
      },
    }
    s = s.$find
  }

  const levelMap = {}

  const recurse = (x: any, i = 0) => {
    let myLevel = i
    if (!levelMap[myLevel]) {
      levelMap[myLevel] = 0
    }
    if (i < levels) {
      x.children = []
      const nextI = i + 1
      for (let j = 0; j < amount; j++) {
        ++levelMap[myLevel]
        let n: any = {
          type: 'glurp',
          levelCnt: levelMap[myLevel],
          title: `Level ${myLevel} child ${j} level count -> ${levelMap[myLevel]}`,
        }
        x.children.push(n)
        recurse(n, nextI)
      }
    }
  }
  recurse(setObj)

  setObj.$id = 'root'
  console.log(JSON.stringify({ setObj }, null, 2))

  var d = Date.now()
  await client.set(setObj)
  t.log(`    Set ${amount}^${levels} things ${Date.now() - d} ms`)

  const myQuery = {
    x: {
      //   title: true,
      //   id: true,
      levelCnt: true,
      $list: {
        $find: q.$find,
      },
    },
  }

  //   console.dir(myQuery, { depth: 100 })

  d = Date.now()
  const ultraResults = await client.get(myQuery)
  t.log(
    `    Get ${amount}^${levels + 1} things using nested queries in ${
      Date.now() - d
    } ms`
  )

  //   console.dir(ultraResults, { depth: 10 })

  const r: any = []

  for (let i = 0; i < levelMap[levels - 1]; i++) {
    r.push({
      levelCnt: i + 1,
    })
  }

  t.deepEqualIgnoreOrder(
    ultraResults.x,
    r,
    `has correct amount of result (${levelMap[levels - 1]}) for ${
      levels + 1
    } deep`
  )

  d = Date.now()
  const x2 = await client.get({
    x: {
      levelCnt: true,
      title: true,
      $list: {
        $find: {
          $traverse: 'descendants',
          $filter: {
            $operator: '=',
            $field: 'type',
            $value: 'glurp',
          },
        },
      },
    },
  })

  t.log(`    Get all desc using descendants in ${Date.now() - d} ms`)

  // t.is(x2.x.length, 32766)
  t.is(x2.x.length, Math.pow(amount, levels + 1) - 2)

  const workers: ReturnType<typeof worker>[] = []

  const workerAmount = 10

  for (let i = 0; i < workerAmount; i++) {
    workers.push(
      worker(
        async ({ connect, wait }, { port }) => {
          const client = connect({ port })
          var d = Date.now()
          const x = await client.get({
            x: {
              levelCnt: true,
              $list: {
                $find: {
                  $traverse: 'descendants',
                  $filter: [
                    {
                      $operator: '=',
                      $field: 'type',
                      $value: 'glurp',
                    },
                    {
                      $operator: '>',
                      $field: 'levelCnt',
                      $value: 1,
                    },
                  ],
                },
              },
            },
          })

          return { ms: Date.now() - d, amount: x.x.length }
        },
        { port }
      )
    )
  }

  d = Date.now()

  const results = await Promise.all(workers)

  results.forEach((v, i) => {
    // console.log(
    //   chalk.gray(
    //     `    worker #${i} {Get all desc using descendants in ${v[0]} ms`
    //   )
    // )
    // t.is(v[0].amount, 32752)
    t.is(v[0].amount, Math.pow(amount, levels + 1) - 2 - levels)
    v[1].terminate()
  })

  t.log(
    `    Get all desc using descendants x${workerAmount} in ${
      Date.now() - d
    } ms`
  )

  const q2 = {
    levelCnt: true,
    $find: q.$find,
  }

  const justOne = await client.get(q2)

  // console.dir(q2, { depth: 1000 })

  t.true(justOne.levelCnt !== undefined, 'find single nested')
})
