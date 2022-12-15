import { BasedServer } from '../../server'
import { HttpClient } from '../../client'
import { BasedFunctionRoute, isObservableFunctionSpec } from '../../functions'
import { end } from '../../sendHttpResponse'
import { compress } from '../../compress'
import {
  createObs,
  destroyObs,
  getObs,
  hasObs,
  sendObsGetError,
  subscribeNext,
  ActiveObservable,
  genObservableId,
} from '../../observable'
import zlib from 'node:zlib'
import { parseQuery } from '@saulx/utils'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { promisify } from 'node:util'

const inflate = promisify(zlib.inflate)

const sendCacheSwapEncoding = async (
  server: BasedServer,
  route: BasedFunctionRoute,
  client: HttpClient,
  buffer: Uint8Array,
  checksum: number
) => {
  try {
    const inflated = await inflate(buffer.slice(20))
    const { payload, encoding } = await compress(
      inflated,
      client.context.headers.encoding
    )
    if (!client.res) {
      return
    }
    client.res.cork(() => {
      client.res.writeStatus('200 OK')
      if (encoding) {
        client.res.writeHeader('Content-Encoding', encoding)
      }
      client.res.writeHeader('ETag', String(checksum))
      end(client, payload)
    })
  } catch (err) {
    sendError(server, client, BasedErrorCode.UnsupportedContentEncoding, route)
  }
}

const sendCache = (
  client: HttpClient,
  buffer: Uint8Array,
  checksum: number,
  isDeflate: boolean
) => {
  client.res.cork(() => {
    client.res.writeStatus('200 OK')
    client.res.writeHeader('ETag', String(checksum))
    if (isDeflate) {
      client.res.writeHeader('Content-Encoding', 'deflate')
    }
    end(client, buffer.slice(20))
  })
}

const sendNotModified = (client: HttpClient) => {
  client.res.cork(() => {
    client.res.writeStatus('304 Not Modified')
    end(client)
  })
}

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

  if (checksum === 0 || checksum !== obs.checksum) {
    if (!obs.cache) {
      sendError(server, client, BasedErrorCode.NoOservableCacheAvailable, {
        observableId: id,
        route: { name: obs.name },
      })
    } else if (obs.isDeflate) {
      if (typeof encoding === 'string' && encoding.includes('deflate')) {
        sendCache(client, obs.cache, obs.checksum, true)
      } else {
        sendCacheSwapEncoding(server, route, client, obs.cache, obs.checksum)
      }
    } else {
      sendCache(client, obs.cache, obs.checksum, false)
    }
  } else {
    sendNotModified(client)
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

  if (payload === undefined && 'query' in client.context) {
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
      if (!spec) {
        sendError(server, client, BasedErrorCode.FunctionNotFound, route)
        return
      }

      if (!isObservableFunctionSpec(spec)) {
        sendError(server, client, BasedErrorCode.FunctionIsNotObservable, route)
        return
      }

      if (hasObs(server, id)) {
        getFromExisting(server, id, client, route, checksum)
        return
      }

      const obs = createObs(server, name, id, payload)
      subscribeNext(obs, (err) => {
        if (err) {
          sendObsGetError(server, client, obs.id, obs.name, err)
        } else {
          sendGetResponse(route, server, id, obs, checksum, client)
        }
      })
    })
    .catch((err) => {
      // TODO: error type
      console.error('Internal: Unxpected error in observable', err)
      sendError(server, client, BasedErrorCode.FunctionNotFound, route)
    })
}
