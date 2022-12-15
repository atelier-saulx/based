import { BasedServer } from '../server'
import { WebsocketClient, HttpClient, ClientContext } from '../client'
import uws from '@based/uws'

export type AuthConfig = {
  authorize?: Authorize
  authorizeConnection?: AuthorizeConnection
}

export type Authorize = (
  client: ClientContext,
  name: string,
  payload?: any
) => Promise<boolean>

export type AuthorizeHandshake = (
  server: BasedServer,
  client: WebsocketClient | HttpClient,
  payload?: any
) => Promise<boolean>

export type AuthorizeConnection = (req: uws.HttpRequest) => Promise<boolean>
