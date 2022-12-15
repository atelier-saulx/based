import { ClientContext } from '../../types'
import { BasedFunctionSpec, BasedObservableFunctionSpec } from '../functions'
import { BasedServer } from '../server'

/*
	function (http)
	function (ws)
	get(http)
	get(ws)
	authorize()
	subscribe
	unsubscribe (also when client leaves!)
	updateFn (if exists check if ops) - this will send the whole spec 
	removeFn // bit more annoying don’t want too ‘touch up’ fns all the time from the worker
	errorInstallingFn
*/

export const runFunction = () => {}

export const get = () => {}

// can also just send an id if we have a persistent client...
export const authorize = (server: BasedServer, client: ClientContext) => {}

export const subscribe = () => {}

export const unsubscribe = () => {}

export const updateFunction = (
  server: BasedServer,
  spec: BasedFunctionSpec | BasedObservableFunctionSpec
) => {
  console.info('update spec', spec)
}

export const removeFunction = (server: BasedServer, name: string) => {
  console.info('remove fn', name)
}

export const installFunctionErr = (
  server: BasedServer,
  name: string,
  err: Error
) => {
  console.info('installFunctionErr', name, err)
}
