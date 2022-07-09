// very big difference is using funcitons for everything - and creating a robust interface for it
// totally seperate from each other
// observableFunctions
// functions
// add cache as option for observables
// diff in update handler
// way more low level interface then we expose in hub
// 2 bytes to encode the type OR just using the name
// subscribe - GET / RESEND (no sub) - SUBSCRIBE + SEND IF CHECKSUM
// going to start with observables
// pkg for selva functionality ( on the same )
/*
open:ws=>ws.subscribe('all')
app.publish('all',message)
*/

// no more concept of clients just an id ? or make clients

// what do we want to do with clients?

export type ObservableUpdateFunction = (
  data: any,
  checksum: number,
  diff?: any,
  fromChecksum?: number
) => {}

// make into a class?
export type ObservableFunctionSpec = {
  name: string
  checksum: number
  memCache?: number // in seconds
  idleTimeout?: number // in seconss
  worker?: string | true | false
  function?: (payload: any, update: ObservableUpdateFunction) => () => void
}

export type FunctionSpec = {
  name: string
  checksum: number
  idleTimeout?: number // in seconss
  worker?: boolean | true | false
  function?: (payload: any) => Promise<any>
}
