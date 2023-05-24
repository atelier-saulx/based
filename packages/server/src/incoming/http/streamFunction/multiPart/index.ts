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
  const installedFn = installFn(server, server.client.ctx, route)

  const pendingFiles: ReturnType<typeof handleFile>[] = []

  const onFile = (file: StreamPayload) => {
    pendingFiles.push(handleFile(server, ctx, installedFn, file, route))
  }

  const ready = async () => {
    const results = await Promise.all(pendingFiles)
    if (ctx.session) {
      if (route.headers) {
        for (const header of route.headers) {
          ctx.session.headers[header] = ctx.session.req.getHeader(header)
        }
        ctx.session.res.cork(() => {
          ctx.session.res.writeHeader(
            'Access-Control-Allow-Headers',
            'Authorization,Content-Type' + ',' + route.headers.join(',')
          )
          ctx.session.res.writeHeader('Access-Control-Expose-Headers', '*')
          ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
        })
      } else {
        ctx.session.res.cork(() => {
          ctx.session.res.writeHeader(
            'Access-Control-Allow-Headers',
            'Authorization,Content-Type'
          )
          ctx.session.res.writeHeader('Access-Control-Expose-Headers', '*')
          ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
        })
      }
      sendHttpResponse(ctx, results)
    }
  }

  readFormData(ctx, server, route, onFile, ready)
}
