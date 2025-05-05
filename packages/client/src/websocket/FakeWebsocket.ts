import fetch from '@based/fetch'
import { incoming } from '../incoming/index.js'
import { BasedClient, encodeAuthState } from '../index.js'
import { addObsToQueue } from '../outgoing/index.js'
import { readUint32 } from '@saulx/utils'

const syncSubs = (ws: FakeWebsocket) => {
  if (!ws._c) {
    setTimeout(() => {
      if (ws._c) {
        return
      }
      ws.client.observeState.forEach((v, k) => {
        const c = ws.client.cache.get(k)
        addObsToQueue(ws.client, v.name, k, v.payload, c?.c ?? 0)
      })
      syncSubs(ws)
    }, ws.client.restFallBack.pollInterval ?? 1e3)
  }
}

export class FakeWebsocket {
  url: string
  authState: string[]
  constructor(url: string, restPrefix: string, client: BasedClient) {
    this.url = url.replace(/^ws/, 'http')
    this.client = client
    this._r = restPrefix
    syncSubs(this)
  }
  timer: ReturnType<typeof setTimeout>
  client: BasedClient
  _c: boolean
  _r: string
  _t: string
  _om: (x?: any) => void
  _oe: (x?: any) => void
  _oc: (x?: any) => void
  close() {
    this._c = true
    if (this._oc) {
      this._oc()
    }
  }
  addEventListener(type: string, listener: (x?: any) => void) {
    if (type === 'open') {
      listener()
    } else if (type === 'message') {
      this._om = listener
    } else if (type === 'error') {
      this._oe = listener
    } else if (type === 'close') {
      this._oc = listener
    }
  }
  removeEventListener() {}
  send(binary) {
    if (binary.byteLength === 0) {
      return
    }
    fetch(
      this.url +
        '/' +
        this._r +
        '/' +
        this._t +
        encodeAuthState(this.client.authState),
      {
        method: 'post',
        body: binary,
        headers: {
          'content-length': String(binary.byteLength),
        },
      },
    )
      .then(async (v) => {
        const incomingArrayBuffer = new Uint8Array(await v.arrayBuffer())
        let i = 0
        while (i < incomingArrayBuffer.byteLength) {
          const s = readUint32(incomingArrayBuffer, i)
          const bufTime = incomingArrayBuffer.slice(i + 4, s + i + 4)
          if (s) {
            incoming(this.client, { data: bufTime })
          } else {
            console.error('error state fix later')
          }
          i += s + 4
        }
      })
      .catch((err) => {
        console.error(err)
      })
  }
}
