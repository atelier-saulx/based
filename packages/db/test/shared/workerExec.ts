import { workerData } from 'node:worker_threads'
import { DbClient, DbClientHooks } from '../../src/client/index.js'
import { register } from 'node:module'
import { registerQuery } from '../../src/client/query/registerQuery.js'

const fn = await import(workerData.file)

const channel = workerData.channel

const seqIdMap = new Map()
const request = async (name, ...args: any[]): Promise<any> => {
  return new Promise((resolve) => {
    const mySeqId = seqId++
    channel.postMessage({ fn: name, id: mySeqId, data: args })
    seqIdMap.set(mySeqId, (r) => {
      seqIdMap.delete(mySeqId)
      resolve(r)
    })
  })
}

channel.on('message', (d) => {
  seqIdMap.get(d.id)(d.result)
})

var seqId = 0
const hooks: DbClientHooks = {
  subscribe(q, onData: (res: Uint8Array) => void, onError) {
    let timer: ReturnType<typeof setTimeout>
    let killed = false
    const poll = async () => {
      const res = await request('getQueryBuf', q.buffer)
      if (killed) {
        return
      }
      if (res.byteLength >= 8) {
        onData(res)
      } else if (res.byteLength === 1 && res[0] === 0) {
        console.info('schema mismatch, should resolve after update')
        // ignore update and stop polling
        return
      } else {
        onError(new Error('unexpected error'))
      }
      timer = setTimeout(poll, 100)
    }

    poll()

    return () => {
      clearTimeout(timer)
      killed = true
    }
  },
  async setSchema(schema, fromStart, transformFns) {
    schema = { ...schema }
    const { ...res } = await request(
      'setSchema',
      schema,
      fromStart,
      transformFns,
    )
    return res
  },
  async flushModify(buf) {
    let offsets = await request('modify', new Uint8Array(buf))
    offsets = offsets && { ...offsets }
    return { offsets }
  },
  async getQueryBuf(buf) {
    const res = await request('getQueryBuf', new Uint8Array(buf))
    return res
  },
}

const client = new DbClient({
  hooks: { ...hooks },
})

client.putLocalSchema(workerData.schema)

await fn.default(client, workerData.data)

channel.postMessage('done')
