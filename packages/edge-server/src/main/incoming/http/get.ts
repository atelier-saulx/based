import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import {
  HttpClient,
  ActiveObservable,
  BasedFunctionRoute,
} from '../../../types'
import { end } from '../../sendHttpResponse'
import { compress } from '../../compress'
import {
  createObs,
  destroyObs,
  getObs,
  hasObs,
  sendObsGetError,
  subscribeNext,
} from '../../observable'
import zlib from 'node:zlib'
import { parseQuery } from '@saulx/utils'
import { BasedErrorCode, sendError } from '../../error'
import genObservableId from '../../../genObservableId'

const sendGetResponse = (
  route: BasedFunctionRoute,
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  client: HttpClient
) => {
  if (!client.res) {
    return
  }

  const encoding = client.context.headers.encoding

  try {
    if (checksum === 0 || checksum !== obs.checksum) {
      if (!obs.cache) {
        sendError(server, client, BasedErrorCode.NoOservableCacheAvailable, {
          observableId: id,
          route: { name: obs.name },
        })
      } else if (obs.isDeflate) {
        if (typeof encoding === 'string' && encoding.includes('deflate')) {
          client.res.cork(() => {
            client.res.writeStatus('200 OK')
            client.res.writeHeader('ETag', String(obs.checksum))
            client.res.writeHeader('Content-Encoding', 'deflate')
            end(client, obs.cache.slice(4 + 8 + 8))
          })
        } else {
          compress(
            client,
            zlib.inflateRawSync(obs.cache.slice(4 + 8 + 8))
          ).then(({ payload, encoding }) => {
            client.res.cork(() => {
              client.res.writeStatus('200 OK')
              if (encoding) {
                client.res.writeHeader('Content-Encoding', encoding)
              }
              client.res.writeHeader('ETag', String(obs.checksum))
              end(client, payload)
            })
          })
        }
      } else {
        client.res.cork(() => {
          client.res.writeStatus('200 OK')
          client.res.writeHeader('ETag', String(obs.checksum))
          end(client, obs.cache.slice(4 + 8 + 8))
        })
      }
    } else {
      client.res.cork(() => {
        client.res.writeStatus('304 Not Modified')
        end(client)
      })
    }
  } catch (err) {
    // TODO: OTHER ERROR again UNEXPECTED
    console.error('Internal: Unxpected error in sendGetResponse', err)
    sendError(server, client, BasedErrorCode.ObservableFunctionError, {
      err,
      observableId: id,
      route,
    })
  }

  destroyObs(server, id)
}

const getFromExisting = (
  server: BasedServer,
  id: number,
  client: HttpClient,
  route: BasedFunctionRoute,
  checksum: number
) => {
  const obs = getObs(server, id)

  if (obs.error) {
    sendObsGetError(server, client, obs.id, obs.name, obs.error)
    return
  }

  if (obs.cache) {
    sendGetResponse(route, server, id, obs, checksum, client)
    return
  }

  subscribeNext(obs, (err) => {
    if (err) {
      sendObsGetError(server, client, obs.id, obs.name, err)
    } else {
      sendGetResponse(route, server, id, obs, checksum, client)
    }
  })
}

export const httpGet = (
  route: BasedFunctionRoute,
  payload: any,
  client: HttpClient,
  server: BasedServer,
  checksum: number
): void => {
  if (!client.res) {
    return
  }

  if (payload === undefined && client.context.query) {
    try {
      payload = parseQuery(decodeURIComponent(client.context.query))
    } catch (err) {}
  }

  const name = route.name
  const id = genObservableId(name, payload)

  if (hasObs(server, id)) {
    getFromExisting(server, id, client, route, checksum)
    return
  }

  server.functions
    .install(name)
    .then((spec) => {
      if (!client.res) {
        return
      }
      if (spec && isObservableFunctionSpec(spec)) {
        if (server.activeObservablesById.has(id)) {
          getFromExisting(server, id, client, route, checksum)
        } else {
          console.error('GET: NO OBS LETS WAIT', name)
          const obs = createObs(server, name, id, payload)
          if (!obs.onNextData) {
            obs.onNextData = new Set()
          }
          obs.onNextData.add((err) => {
            if (err) {
              sendObsGetError(server, client, obs.id, obs.name, err)
            } else {
              sendGetResponse(route, server, id, obs, checksum, client)
            }
          })
        }
      } else if (spec && !isObservableFunctionSpec(spec)) {
        sendError(server, client, BasedErrorCode.FunctionIsNotObservable, route)
      } else if (!spec) {
        sendError(server, client, BasedErrorCode.FunctionNotFound, route)
      }
    })
    .catch((err) => {
      // TODO: error type
      console.error('Internal: Unxpected error in observable', err)
      sendError(server, client, BasedErrorCode.FunctionNotFound, route)
    })
}
