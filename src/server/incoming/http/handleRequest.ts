import { BasedServer } from '../../server.js'
import { readBody } from './readBody.js'
import payloadParser from './payloadParser.js'
import type {
  BasedRouteComplete,
  Context,
  HttpSession,
} from '../../../functions/index.js'

export const handleRequest = (
  server: BasedServer,
  method: string,
  ctx: Context<HttpSession>,
  route: BasedRouteComplete,
  ready: (payload?: any) => void,
) => {
  if (method === 'post' || method === 'put' || method === 'patch') {
    readBody(server, ctx, ready, route)
  } else {
    ready(payloadParser(ctx, route))
  }
}

// export type UiSchemaType = SchemaType & {
//   leadIcon: boolean
//   trialIcon: boolean
// }
