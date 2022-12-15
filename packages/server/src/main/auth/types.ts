import { ClientContext } from '../../types'
import type uws from '@based/uws'

export type AuthConfig = {
  authorizePath?: string
  authorizeConnection?: AuthorizeConnection
}

export type Authorize = (
  client: ClientContext,
  name: string,
  payload?: any
) => Promise<boolean>

export type AuthorizeConnection = (req: uws.HttpRequest) => Promise<boolean>
