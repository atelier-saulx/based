import { BasedServer } from './server.js'
import {
  HttpSession,
  Context,
  Session,
  WebSocketSession,
  BasedRoute,
  BasedFunctionConfig,
} from '../functions/index.js'
import { AttachedCtx } from './query/types.js'

export type ClientSession = HttpSession | WebSocketSession

export type FunctionHandler<
  S extends Session = Session,
  R extends BasedRoute = BasedRoute,
  P = any,
> = (
  props: FunctionProps<S, R, P> & {
    spec: BasedFunctionConfig<R['type']>
  },
) => any

export type FunctionErrorHandler<
  S extends Session = Session,
  R extends BasedRoute = BasedRoute,
  P = any,
> = (props: FunctionProps<S, R, P>, err?: Error) => true | void

export type FunctionProps<
  S extends Session = Session,
  R extends BasedRoute = BasedRoute,
  P = any,
> = {
  route: R
  server: BasedServer
  ctx: Context<S>
  payload?: P
  error?: FunctionErrorHandler<S, R, P>
  id?: number
  checksum?: number
  attachedCtx?: AttachedCtx
}
