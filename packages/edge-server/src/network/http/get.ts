import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { HttpClient, ActiveObservable, BasedFunctionRoute } from '../../types'
import end from './end'
import { compress } from './compress'
import { sendHttpError } from './send'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { create, destroy } from '../../observable'
import zlib from 'node:zlib'
import { BasedErrorCode } from '../../error'
import { parseQuery } from '@saulx/utils'

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
        sendHttpError(
          server,
          client,
          BasedErrorCode.NoOservableCacheAvailable,
          {
            observableId: id,
            name: obs.name,
          }
        )
      } else {
        if (obs.isDeflate) {
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
      }
    } else {
      client.res.cork(() => {
        client.res.writeStatus('304 Not Modified')
        end(client)
      })
    }
  } catch (err) {
    sendHttpError(server, client, BasedErrorCode.FunctionError, {
      err,
      observableId: id,
      route,
    })
  }

  destroy(server, id)
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

  const name = route.name

  if (payload === undefined && client.context.query) {
    try {
      payload = parseQuery(decodeURIComponent(client.context.query))
    } catch (err) {}
  }

  server.functions
    .install(name)
    .then((spec) => {
      if (!client.res) {
        return
      }
      if (spec && isObservableFunctionSpec(spec)) {
        const id = hashObjectIgnoreKeyOrder([name, payload])

        if (server.activeObservablesById.has(id)) {
          const obs = server.activeObservablesById.get(id)
          if (obs.beingDestroyed) {
            clearTimeout(obs.beingDestroyed)
            obs.beingDestroyed = null
          }
          if (obs.cache) {
            sendGetResponse(route, server, id, obs, checksum, client)
          } else {
            if (!obs.onNextData) {
              obs.onNextData = new Set()
            }
            obs.onNextData.add(() => {
              sendGetResponse(route, server, id, obs, checksum, client)
            })
          }
        } else {
          const obs = create(server, name, id, payload)
          if (!obs.onNextData) {
            obs.onNextData = new Set()
          }
          obs.onNextData.add(() => {
            sendGetResponse(route, server, id, obs, checksum, client)
          })
        }
      } else if (spec && isObservableFunctionSpec(spec)) {
        sendHttpError(
          server,
          client,
          BasedErrorCode.FunctionIsNotObservable,
          route
        )
      } else {
        sendHttpError(server, client, BasedErrorCode.FunctionNotFound, route)
      }
    })
    .catch(() =>
      sendHttpError(server, client, BasedErrorCode.FunctionNotFound, route)
    )
}