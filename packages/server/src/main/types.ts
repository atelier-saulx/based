import { BasedErrorData } from '../error'
import type uws from '@based/uws'
import { ClientContext } from '../types'

export type EventMap = {
  error: BasedErrorData
  ratelimit: void
  log: any
}

export type Listener<T> = (
  context: ClientContext,
  data?: T,
  err?: Error
) => void

export type Event = keyof EventMap

export type WebsocketClient = {
  // ClientContext &
  context: ClientContext | null
  ws:
    | (uws.WebSocket & {
        obs: Set<number>
        unauthorizedObs: Set<{
          id: number
          checksum: number
          name: string
          payload: any
        }>
      })
    | null
}

export type HttpClient = {
  res: uws.HttpResponse | null
  req: uws.HttpRequest | null
  context: ClientContext | null
}

export const isHttpClient = (
  client: HttpClient | WebsocketClient
): client is HttpClient => {
  if ('res' in client) {
    return true
  }
  return false
}
