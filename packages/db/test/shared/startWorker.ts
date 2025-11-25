import { Worker, MessageChannel } from 'node:worker_threads'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { DbClient } from '../../src/client/index.js'
import { BasedDb } from '../../src/index.js'
import native from '../../src/native.js'
import * as utils from '../../src/utils/index.js'
import hash from '../../src/hash/hash.js'

const exists = async (path: string) => await fs.stat(path).catch((e) => false)

const __dirname = dirname(fileURLToPath(import.meta.url))

type Native = typeof native
type Utils = typeof utils

export const clientWorker = async <T extends any>(
  t: any,
  db: BasedDb,
  fn: (
    client: DbClient,
    data: T,
    p: { native: Native; utils: Utils },
  ) => Promise<void>,
  data?: T,
): Promise<void> => {
  const path = join(__dirname, '/tmp')
  if (!(await exists(path))) {
    await fs.mkdir(path).catch(() => {})
  }

  const body = `export default ${fn.toString()}`
  const s = hash(body) + '.js'

  const filePath = join(__dirname, '/tmp', s)

  if (!(await exists(filePath))) {
    await fs.writeFile(filePath, body)
  }

  t.after(async () => {
    if (await exists(filePath)) {
      await fs.rm(filePath)
    }
  })

  const { port1, port2 } = new MessageChannel()
  const schemaChannel = new MessageChannel()

  const worker = new Worker(join(__dirname, 'workerExec.js'), {
    workerData: {
      file: filePath,
      channel: port2,
      data,
      schemaChannel: schemaChannel.port2,
    },
    transferList: [port2, schemaChannel.port2],
  })

  let done
  let p = new Promise((r) => {
    done = r
  })

  db.server.on('schema', (s) => {
    schemaChannel.port1.postMessage(s)
  })

  port1.on('message', async (d) => {
    if (d === 'started') {
      if (db.server.schema) {
        schemaChannel.port1.postMessage(db.server.schema)
      }
      return
    }
    if (d === 'done') {
      done()
      return
    }
    const seqId = d.id
    const result = await db.server[d.fn](...d.data)
    port1.postMessage({ id: seqId, result })
  })

  await p
  await worker.terminate()
}
