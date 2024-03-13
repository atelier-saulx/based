import test from 'ava'
import { startOrigin, SelvaServer } from '@based/db-server'
import getPort from 'get-port'
import { BasedDbClient } from '../src/index.js'
import { wait } from '@saulx/utils'
import { sourceId } from '../src/id.js'
import { hash } from '@saulx/hash'
import { Fork, ast2rpn, createAst } from '@based/db-query'

import { dirname } from 'node:path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

import { Worker } from 'node:worker_threads'

import {
  ModifyArgType,
  ModifyOpSetType,
  SelvaModify_OpEdgeMetaCode,
  edgeMetaDef,
} from '../src/protocol/encode/modify/types.js'
import {
  SelvaFindResultType,
  SelvaHierarchy_AggregateType,
  SelvaTraversal,
  hierarchy_agg_def,
  hierarchy_find_def,
} from '../src/protocol/types.js'
import { createRecord } from 'data-record'

test('simple test', async (t) => {
  const port = 9910
  const originServer = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })

  const makeMrWorker = () => {
    return new Promise((resolve) => {
      const wrk = new Worker(__dirname + '/writerman.js')
      wrk.on('message', (d) => {
        console.log('MSG')
        resolve(0)
        wrk.terminate()
      })
    })
  }

  const q = []

  // const d2 = Date.now()
  // console.log('hash time')
  // let myVar = 'start!'
  // for (let i = 0; i < 1e9; i++) {
  //   myVar = hash(myVar).toString(16)
  // }
  // console.info('HASH DONE', Date.now() - d2, 'ms')

  const d = Date.now()

  for (let i = 0; i < 10; i++) {
    // 10M
    q.push(makeMrWorker())
  }

  await Promise.all(q)

  console.log(Date.now() - d, 'ms')

  try {
    console.log('ALL')
    const result2 = await client
      .command('hierarchy.aggregate', [
        '', // lang
        createRecord(hierarchy_agg_def, {
          agg_fn: SelvaHierarchy_AggregateType.SELVA_AGGREGATE_TYPE_COUNT_NODE,
          skip: 0n,
          offset: 0n,
          limit: -1n,
          dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_ALL,
        }),
        'bogus'.padEnd(16, '\0'),
        '#1',
      ])
      .catch(console.error)

    console.dir(result2, { depth: 10 })
  } catch (err) {
    console.error(err)
  }

  // client.command('hierarchy.aggregate')

  originServer.destroy()

  t.true(true)
})
