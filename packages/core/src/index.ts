import {
  GenericObject,
  BasedOpts,
  closeObserve,
  ObserveOpts,
  observeDataListener,
  observeErrorListener,
  closeSchemaObserve,
  Schema,
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

  disconnect() {}

  // -------- Schema
  schema: Schema

  observeSchema(onSchema: observeSchemaListener): closeSchemaObserve {
    return () => {}
  }

  // -------- Observe
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
}

export { BasedOpts }
