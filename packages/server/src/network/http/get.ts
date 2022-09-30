import { isObservableFunctionSpec } from '../../functions'
import { BasedServer } from '../../server'
import { HttpClient, ActiveObservable, BasedFunctionRoute } from '../../types'
import end from './end'
import { compress } from './compress'
import { sendHttpError } from './send'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { create, destroy } from '../../observable'
import zlib from 'node:zlib'

const sendGetResponse = (
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  encoding: string,
  checksum: number,
  client: HttpClient
) => {
  if (!client.res) {
    return
  }

  try {
    if (checksum === 0 || checksum !== obs.checksum) {
      if (!obs.cache) {
        // ERROR
        sendHttpError(client, 'no value', 400)
      } else {
        if (obs.isDeflate) {
          if (encoding && encoding.includes('deflate')) {
            // send it
            client.res.cork(() => {
              client.res.writeStatus('200 OK')
              client.res.writeHeader('ETag', String(obs.checksum))
              client.res.writeHeader('Content-Encoding', 'deflate')
              end(client, obs.cache.slice(4 + 8 + 8))
            })
          } else if (obs.rawData) {
            compress(client, JSON.stringify(obs.rawData), encoding).then(
              ({ payload, encoding }) => {
                if (client.res) {
                  client.res.cork(() => {
                    client.res.writeStatus('200 OK')
                    if (encoding) {
                      client.res.writeHeader('Content-Encoding', encoding)
                    }
                    client.res.writeHeader('ETag', String(obs.checksum))
                    end(client, payload)
                  })
                }
              }
            )
          } else {
            compress(
              client,
              zlib.inflateRawSync(obs.cache.slice(4 + 8 + 8)),
              encoding
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
    sendHttpError(client, err.message)
  }

  if (obs.clients.size === 0) {
    destroy(server, id)
  }
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

  const encoding = client.context.encoding
  const name = route.name

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
            sendGetResponse(server, id, obs, encoding, checksum, client)
          } else {
            if (!obs.onNextData) {
              obs.onNextData = new Set()
            }
            obs.onNextData.add(() => {
              sendGetResponse(server, id, obs, encoding, checksum, client)
            })
          }
        } else {
          const obs = create(server, name, id, payload)
          if (!obs.onNextData) {
            obs.onNextData = new Set()
          }
          obs.onNextData.add(() => {
            sendGetResponse(server, id, obs, encoding, checksum, client)
          })
        }
      } else if (spec && isObservableFunctionSpec(spec)) {
        sendHttpError(
          client,
          `function is not observable - use /function/${name} instead`,
          404,
          'Not Found'
        )
      } else {
        sendHttpError(
          client,
          `observable function does not exist ${name}`,
          404,
          'Not Found'
        )
      }
    })
    .catch(() =>
      sendHttpError(
        client,
        `observable function does not exist ${name}`,
        404,
        'Not Found'
      )
    )
}
