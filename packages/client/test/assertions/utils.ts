import fs from 'node:fs'
import { Worker } from 'worker_threads'
import { join, dirname } from 'node:path'
import beforeExit from 'before-exit'
import { hash } from '@saulx/hash'
import { createRecord } from 'data-record'
import { BasedDbClient, protocol } from '../../src/index.js'
import {
  SelvaFindResultType,
  SelvaMergeStrategy,
  SelvaTraversal,
} from '../../src/protocol/index.js'
import rimraf from 'rimraf'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))

const tmp = join(__dirname, '../../tmp')

export const worker = (
  fn: Function,
  context?: any
): Promise<[any, Worker, () => void]> =>
  new Promise((resolve, reject) => {
    if (!fs.existsSync(tmp)) {
      fs.mkdirSync(tmp)
    }

    // fn has to be a async function
    const body = fn.toString()

    const script = `
      const fn = ${body};
      global.isWorker = true

      const selvaServer = require('@based/db-server')
      const selva = require('@based/db-client')
      const wait = (t = 100) => (new Promise(r => setTimeout(r, t)))

      const p = { wait }


      for (let key in selva) {
        p[key] = selva[key]
      }

      for (let key in selvaServer) {
        p[key] = selvaServer[key]
      }

      const { workerData, parentPort } = require('worker_threads')
      let cleanup
      fn(p, workerData).then((v) => {
        if (typeof v === 'function') {
          cleanup = v
          v = null
        }
        parentPort.postMessage(v);
      }).catch(err => {
        throw err
      })

      parentPort.on('message', async (msg) => {
        if (msg === '___KILL___') {
          if (cleanup) {
            await cleanup()
            await wait(500)
          }
          process.exit()
        }
      })
    `

    const id = 'worker-' + hash(script) + '.js'

    const file = join(tmp, id)

    if (!fs.existsSync(join(tmp, id))) {
      fs.writeFileSync(join(tmp, id), script)
    }

    const worker = new Worker(file, { workerData: context || {} })
    beforeExit.do(() => {
      try {
        console.log('Before exit hook close worker')
        worker.terminate()
      } catch (_err) {}
    })

    const kill = () => {
      worker.postMessage('___KILL___')
    }

    worker.on('message', (msg) => {
      resolve([msg, worker, kill])
    })

    worker.on('error', (err) => {
      reject(err)
    })
  })

export const find = async ({
  client,
  dir,
  id,
  dir_opt_str,
  res_opt_str,
  res_type,
  rpn = ['#1'],
  lang = '',
  index_hints,
}: {
  lang?: string
  client: any
  dir: SelvaTraversal
  id: string
  dir_opt_str?: string
  res_opt_str?: string
  res_type?: SelvaFindResultType
  rpn?: string[]
  index_hints?: string
}) => {
  return client.command('hierarchy.find', [
    lang,
    createRecord(protocol.hierarchy_find_def, {
      dir,
      dir_opt_str,
      index_hints_str: index_hints,
      limit: BigInt(-1),
      skip: BigInt(0),
      offset: BigInt(0),
      merge_strategy: SelvaMergeStrategy.MERGE_STRATEGY_NONE,
      res_type:
        res_type || protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_IDS,
      res_opt_str,
    }),
    id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0'),
    ...rpn,
  ])
}

export const removeDump = (dir: string) => {
  if (fs.existsSync(dir)) {
    rimraf.sync(dir)
  }
}

export const idExists = async (
  client: BasedDbClient,
  id: string
): Promise<boolean> => {
  const result = await client.get({ $id: id, id: true })
  return !!result.id
}

export const getIndexingState = async (client: BasedDbClient) => {
  const l = (await client.command('index.list'))[0]
  const stateMap = {}

  for (let i = 0; i < l.length; i += 2) {
    const key = l[i].split('.')
    const expression = Buffer.from(key[key.length - 1], 'base64').toString()
    const state = {
      expression: expression,
      take_max_ave: l[i + 1][0],
      tot_max_ave: l[i + 1][1],
      ind_take_max_ave: l[i + 1][2],
      card: l[i + 1][3],
    }

    stateMap[l[i]] = state
  }

  return stateMap
}
