import fs from 'fs'
import { Worker } from 'worker_threads'
import { join } from 'path'
import beforeExit from 'before-exit'
import { hash } from '@saulx/hash'
import { createRecord } from 'data-record'
import { protocol } from '../../src'
import { SelvaMergeStrategy } from '../../src/protocol'

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

      const selvaServer = require('@saulx/selva-server')
      const selva = require('@saulx/selva')
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
}: {
  client: any
  dir: any
  id: string
  dir_opt_str?: string
  res_opt_str?: string
  res_type?: any
}) => {
  return client.command('hierarchy.find', [
    '',
    createRecord(protocol.hierarchy_find_def, {
      dir,
      res_type:
        res_type || protocol.SelvaFindResultType.SELVA_FIND_QUERY_RES_IDS,
      merge_strategy: SelvaMergeStrategy.MERGE_STRATEGY_NONE,
      dir_opt_str,
      res_opt_str,
      limit: BigInt(-1),
      offset: BigInt(0),
    }),
    id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0'),
    '#1',
  ])
}
