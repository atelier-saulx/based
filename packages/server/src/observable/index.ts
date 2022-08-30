import type { BasedServer } from '../server'
import { ObservableUpdateFunction } from '../types'
import { valueToBuffer, encodeObservableResponse } from '../protocol'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'

export class BasedObservableFunction {
  server: BasedServer
  name: string
  id: number
  clients: Set<number>
  payload: any
  cache: Uint8Array // SharedArrayBuffer this will be it
  checksum: number

  // add subscribe / unsub here

  // diff
  // diffchecksum

  constructor(server: BasedServer, name: string, payload: any, id: number) {
    this.server = server
    this.payload = payload
    if (!this.server.activeObservables[name]) {
      this.server.activeObservables[name] = {}
    }

    if (this.server.activeObservables[name][id]) {
      console.error('OBSERVABLE ALLRDY EXISTS', id, name)
    } else {
      this.server.activeObservables[name][id] = this
    }

    const spec = this.server.functions.observables[name]

    if (!spec) {
      console.error('Cannot find observable spec!', name)
      this.destroy()
      return
    }

    const update: ObservableUpdateFunction = (
      data: any,
      checksum?: number,
      diff?: any,
      fromChecksum?: number
    ) => {
      const buff = valueToBuffer(data)

      if (checksum === undefined) {
        if (data === undefined) {
          checksum = 0
        } else {
          // do something
          if (typeof data === 'object' && data !== null) {
            checksum = hashObjectIgnoreKeyOrder(data)
          } else {
            checksum = hash(data)
          }
        }
      }

      const encodedData = encodeObservableResponse(id, checksum, buff)

      this.cache = encodedData
      this.checksum = checksum

      server.uwsApp.publish(String(id), encodedData, true, false)
    }

    spec.function(payload, update)
  }

  destroy() {
    console.info('destroy observable!')
    // also need to send info to clients that its gone (e.g. does not exist anymore)
    delete this.server.activeObservables[this.name][this.id]
    delete this.server.activeObservablesById[this.id]
  }

  async updateObservableCode(): Promise<void> {
    console.info('update observable code!', this.id, this.name)
  }
}
