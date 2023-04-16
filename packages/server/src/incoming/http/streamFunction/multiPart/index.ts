import {
  HttpSession,
  Context,
  StreamPayload,
  BasedRoute,
  BasedFunctionConfig,
} from '@based/functions'
import { BasedServer } from '../../../../server'
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
  installedFn: Promise<BasedFunctionConfig<'stream'> | null>,
  file: StreamPayload,
  route: BasedRoute<'stream'>
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
  const spec = await installedFn
  console.log('FILEFILE')

  if (spec === null) {
    return {
      error: createErrorData(BasedErrorCode.FunctionNotFound, {
        route,
      }),
    }
  }

  try {
    const ok = await (spec.authorize || server.auth.authorize)(
      server.client,
      ctx,
      route.name,
      file
    )
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

  try {
    const value = await spec.fn(server.client, file, ctx)
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
  route: BasedRoute<'stream'>
) => {
  ctx.session.res.cork(() => {
    ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
    ctx.session.res.writeHeader('Access-Control-Allow-Headers', '*')
    ctx.session.corsSend = true
  })

  console.info('whaaa121212122', route)

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
