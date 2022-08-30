import type { BasedServer } from '../server'
import { ObservableUpdateFunction } from '../types'
import { valueToBuffer, encodeObservableResponse } from '../protocol'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { check } from 'yargs'

// maybe dont use this class..

export class BasedObservableFunction {
  server: BasedServer
  name: string
  id: number
  clients: Set<number>
  payload: any
  cache: Uint8Array // SharedArrayBuffer this will be it
  checksum: number

  isDestroyed: boolean = false

  closeFunction: () => void
  // add subscribe / unsub here

  // diff
  // diffchecksum

  constructor(server: BasedServer, name: string, payload: any, id: number) {
    this.server = server
    this.payload = payload
    this.clients = new Set()
    this.id = id
    this.name = name

    if (!this.server.activeObservables[name]) {
      this.server.activeObservables[name] = {}
    }

    if (this.server.activeObservables[name][id]) {
      console.error('OBSERVABLE ALLRDY EXISTS', id, name)
      // make all this with fns
      return this.server.activeObservables[name][id]
    } else {
      this.server.activeObservables[name][id] = this
    }

    this.server.activeObservablesById[id] = this

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

      if (checksum !== this.checksum) {
        const buff = valueToBuffer(data)
        const encodedData = encodeObservableResponse(id, checksum, buff)
        this.cache = encodedData
        this.checksum = checksum
        server.uwsApp.publish(String(id), encodedData, true, false)
      }
    }

    spec
      .function(payload, update)
      .then((close) => {
        if (this.isDestroyed) {
          close()
        } else {
          this.closeFunction = close
        }
      })
      .catch((err) => {
        console.error('Error starting', err)
        // this.destroy()
      })
  }

  destroy() {
    console.info('destroy observable!')
    // also need to send info to clients that its gone (e.g. does not exist anymore)

    // TODO: have to implement memCache here

    delete this.server.activeObservables[this.name][this.id]
    delete this.server.activeObservablesById[this.id]

    this.isDestroyed = true
    if (this.closeFunction) {
      this.closeFunction()
    }
  }

  async updateObservableCode(): Promise<void> {
    console.info('update observable code!', this.id, this.name)
  }
}
