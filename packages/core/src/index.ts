import {
  GenericObject,
  BasedOpts,
  closeObserve,
  ObserveOpts,
  observeDataListener,
  observeErrorListener,
  Auth,
} from './types'

import Emitter from './Emitter'

/* 
-------------------
Allways starts with observing schema this is used to map types - also fits well with gql
-------------------
client.schema
client.observeSchema
-------------------
client.observe
client.get
-------------------
client.function 
-------------------
client.opts
client.disconnect
client.connect
client.debug (allows you to listen on messages)
-------------------
client.authState
client.auth
client.observeAuth
-------------------
*/

export class BasedCoreClient extends Emitter {
  // --------Generic options
  opts: BasedOpts

  connect(opts: BasedOpts) {
    this.opts = opts
  }

  disconnect() {
    this.emit('connection', false)
  }

  // -------- Observe

  // state!

  observe(
    name: string,
    onData: observeDataListener,
    payload?: GenericObject,
    onErr?: observeErrorListener,
    observeOpts?: ObserveOpts
  ): closeObserve {
    return () => {}
  }

  async get(name: string, payload?: GenericObject): Promise<any> {
    // any is better
  }

  // -------- Function
  async function(name: string, payload?: GenericObject): Promise<any> {
    // any is better
  }

  // -------- Auth
  authState: Auth = { token: false }
  // more things prob have to make it better then this
  // renewtoken in here as well
  // or start of the cookie based auth
  authInProgress: Promise<Auth>
  async auth(token: string | false): Promise<any> {
    if (token === false) {
      this.authState = { token: false }
      this.emit('auth', this.authState)
    } else if (typeof token === 'string') {
      // do actual authentication
    }
  }
}

export { BasedOpts }
