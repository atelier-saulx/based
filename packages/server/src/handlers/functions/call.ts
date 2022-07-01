import { BasedServer } from '../..'
import Client from '../../Client'
import { FunctionCallMessage, RequestTypes } from '@based/client'
import { Params } from '../../Params'
import { getFunction } from '../../getFromConfig'
import { isCallFunction } from '../../types'
// start with call
const call = async (
  server: BasedServer,
  client: Client,
  [, name, reqId, payload]: FunctionCallMessage,
  params?: Params // in authorize this is a bit awkard
) => {
  const fn = await getFunction(server, name)
  if (fn && isCallFunction(fn)) {
    if (!params) {
      params = new Params(server, payload, client, [name])
    }
    try {
      const result = await fn.function(params)
      if (fn.headers) {
        client.send(
          [RequestTypes.Call, reqId, result],
          await fn.headers(params, result)
        )
      } else {
        client.send([RequestTypes.Call, reqId, result])
      }
    } catch (err) {
      const error = {
        type: err.name,
        name,
        message: err.message,
        payload,
        auth: err.name === 'AuthorizationError',
      } as any
      if (err.code) {
        error.code = err.code
      }
      client.send([RequestTypes.Call, reqId, 0, error])
    }
  } else {
    client.send([
      RequestTypes.Call,
      reqId,
      0,
      {
        type: 'FunctionDoesNotExistError',
        name: `call "${name}"`,
        message: `Function ${name} does not exist`,
        payload,
      },
    ])
  }
}

export default call
