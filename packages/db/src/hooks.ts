import { StrictSchema } from '@based/schema'
import { BasedDbQuery } from './client/query/BasedDbQuery.js'
import { OnError } from './client/query/subscription/types.js'
import { DbServer } from './server/index.js'
import picocolors from 'picocolors'
import { displayTarget } from './client/query/display.js'

export const getDefaultHooks = (server: DbServer, subInterval = 200) => {
  return {
    subscribe(
      q: BasedDbQuery,
      onData: (res: Uint8Array) => void,
      onError: OnError,
    ) {
      let timer: ReturnType<typeof setTimeout>
      let killed = false
      const poll = async () => {
        const res = await server.getQueryBuf(q.buffer)
        if (killed) {
          return
        }
        if (res.byteLength >= 4) {
          onData(res)
        } else if (res.byteLength === 1 && res[0] === 0) {
          console.info('schema mismatch, should resolve after update')
          // ignore update and stop polling
          return
        } else {
          const def = this.def
          let name = picocolors.red(`QueryError[${displayTarget(def)}]\n`)
          name += `  Incorrect buffer received (maybe server not started ${res.byteLength}) bytes\n`
          onError(new Error(name))
        }
        timer = setTimeout(poll, subInterval)
      }

      poll()

      return () => {
        clearTimeout(timer)
        killed = true
      }
    },
    setSchema(schema: StrictSchema, fromStart: boolean) {
      return Promise.resolve(server.setSchema(schema, fromStart))
    },
    flushModify(buf: Uint8Array) {
      const d = performance.now()
      const offsets = server.modify(buf)
      const dbWriteTime = performance.now() - d
      return Promise.resolve({
        offsets,
        dbWriteTime,
      })
    },
    getQueryBuf(buf: Uint8Array) {
      return Promise.resolve(server.getQueryBuf(buf))
    },
  }
}
