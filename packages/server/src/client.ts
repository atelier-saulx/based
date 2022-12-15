import uws from '@based/uws'

export type ClientContext =
  | {
      query: string
      ua: string
      ip: string
      callStack?: string[]
      id: number
      fromAuth?: boolean
      authState?: any
      method: string
      headers: {
        'content-length'?: number
        authorization?: string
        'content-type'?: string
        'content-encoding'?: string
        encoding?: string
      } & { [key: string]: string }
    }
  | {
      callStack?: string[]
      fromAuth?: boolean
      headers: {
        'content-length'?: number
        authorization?: string
        'content-type'?: string
        'content-encoding'?: string
        encoding?: string
      }
    }
  | {
      callStack?: string[]
      fromAuth?: boolean
      id: number
      name: string
      isObservable: true
      headers: {
        encoding?: string
      }
    }

export type WebsocketClient = {
  ws:
    | (uws.WebSocket &
        ClientContext & {
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

export type ObservableClient = {
  context: { name: string; id: number }
}

export const isHttpClient = (
  client: HttpClient | WebsocketClient
): client is HttpClient => {
  if ('res' in client) {
    return true
  }
  return false
}
