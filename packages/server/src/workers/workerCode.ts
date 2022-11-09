// import { Client } from '@based/server/src/types'
// import { BasedServerClient } from '@based/server'

// export type CallParams = {
//   payload: any
//   based: BasedServerClient
//   user: Client
//   callStack: string[]
// }

// export type ObservableParams = {
//   payload: any
//   based: BasedServerClient
//   user?: Client
//   callStack: string[]
//   // error later...
//   update: (value: any, checksum?: number) => void
// }

// workers

// in the worker we are going to run the code with getters

// e.g.

// fn({ user, payload, update, based }) // we add error later

// fn({ user, payload, based })

// WorkerParams object - mimic normal params object

// this all has to be part of based server

// mimic normal client
class WorkerClient {
  constructor(id: number) {
    // yes number
    console.info(id)
  }
  // tokenm
}

// has to wrap every method
class WorkerBasedClient {
  //   constructor() {}
}

class WorkerParams {
  private _clientId: number

  public payload: any

  public callStack = []

  get user(): WorkerClient {
    // also pair it with other functions potentialy
    return new WorkerClient(this._clientId)
  }

  get based(): WorkerBasedClient {
    return new WorkerBasedClient()
  }
}
