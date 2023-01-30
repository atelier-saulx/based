import { HttpSession, Context, StreamPayload } from '@based/functions'
import { BasedServer } from '../../../../server'
import {
  BasedStreamFunctionRoute,
  BasedStreamFunctionSpec,
} from '../../../../functions'
import { installFn } from '../../../../installFn'
import readFormData from './readFormData'
import {
  BasedErrorCode,
  BasedErrorData,
  createErrorData,
} from '../../../../error'
import { sendHttpResponse } from '../../../../sendHttpResponse'

const handleFile = async (
  server: BasedServer,
  ctx: Context<HttpSession>,
  installedFn: Promise<BasedStreamFunctionSpec | null>,
  file: StreamPayload,
  route: BasedStreamFunctionRoute
): Promise<
  | { value: any }
  | {
      error: BasedErrorData<
        | BasedErrorCode.FunctionError
        | BasedErrorCode.FunctionNotFound
        | BasedErrorCode.AuthorizeFunctionError
        | BasedErrorCode.AuthorizeRejectedError
      >
    }
> => {
  try {
    const ok = await server.auth.authorize(server.client, ctx, route.name, file)
    if (!ok) {
      return {
        error: createErrorData(BasedErrorCode.AuthorizeRejectedError, {
          route,
        }),
      }
    }
  } catch (err) {
    return {
      error: createErrorData(BasedErrorCode.AuthorizeFunctionError, {
        route,
        err,
      }),
    }
  }

  const spec = await installedFn

  if (spec === null) {
    return {
      error: createErrorData(BasedErrorCode.FunctionNotFound, {
        route,
      }),
    }
  }
  try {
    const value = await spec.function(server.client, file, ctx)
    return { value }
  } catch (err) {
    return {
      error: createErrorData(BasedErrorCode.FunctionError, { err, route }),
    }
  }
}

export const multiPart = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  route: BasedStreamFunctionRoute
) => {
  ctx.session.res.cork(() => {
    ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
    ctx.session.res.writeHeader('Access-Control-Allow-Headers', '*')
    ctx.session.corsSend = true
  })

  const installedFn = installFn(server, server.client.ctx, route)

  const pendingFiles: ReturnType<typeof handleFile>[] = []

  const onFile = (file: StreamPayload) => {
    pendingFiles.push(handleFile(server, ctx, installedFn, file, route))
  }

  const ready = async () => {
    const results = await Promise.all(pendingFiles)
    sendHttpResponse(ctx, results)
  }

  readFormData(ctx, server, route, onFile, ready)
}
