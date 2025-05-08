import { workerData } from 'node:worker_threads'
import { DbClient, DbClientHooks } from '../../src/client/index.js'

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
  subscribe(q, onData, onError) {
    // add in a bit...
    console.warn('Subscription not supported without based-server!')
    return () => {}
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
    buf = new Uint8Array(buf)
    let offsets = await request('modify', buf)
    offsets = offsets && { ...offsets }
    return { offsets }
  },
  async getQueryBuf(buf) {
    buf = new Uint8Array(buf)
    const res = await request('getQueryBuf', buf)
    return res
  },
}

const client = new DbClient({
  hooks: { ...hooks },
})

client.putLocalSchema(workerData.schema)

await fn.default(client)

channel.postMessage('done')
