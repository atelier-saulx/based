import { BasedServer } from './server.js'
import {
  Context,
  isClientContext,
  BasedRoute,
  BasedFunctionConfig,
  isBasedFunctionConfig,
  BasedFunctionTypes,
  Session,
} from '@based/functions'
import { sendSimpleError } from './sendError.js'
import { BasedErrorCode } from '@based/errors'
import { FunctionErrorHandler, FunctionProps } from './types.js'

const functionNotFound = (props): FunctionErrorHandler => {
  if (!isClientContext(props.ctx)) {
    return
  }
  sendSimpleError(
    props.server,
    props.ctx,
    BasedErrorCode.FunctionNotFound,
    { type: props.route.type, name: props.route.name },
    props.id,
  )
}

// make this a function hander as well
export const installFn = async <
  S extends Session = Session,
  R extends BasedRoute = BasedRoute,
  P = any,
>(
  props: FunctionProps<S, R, P>,
): Promise<null | BasedFunctionConfig<R['type']>> => {
  if (!props.route) {
    return null
  }
  const { type, name } = props.route
  try {
    const spec = await props.server.functions.install(name)
    if (!props.ctx.session) {
      return null
    }

    if (spec === null) {
      functionNotFound(props)
      return null
    }

    if (!isBasedFunctionConfig(type, props.route)) {
      if (!isClientContext(props.ctx)) {
        return null
      }
      sendSimpleError(
        props.server,
        props.ctx,
        BasedErrorCode.FunctionIsWrongType,
        { name, type },
        props.id,
      )
      return null
    }

    // @ts-ignore Fixed by chekcing the specs
    return spec
  } catch (err) {
    functionNotFound(props)
  }
  return null
}
