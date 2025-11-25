import { BasedServer } from '../../../../server.js'
import { installFn } from '../../../../installFn.js'
import readFormData from './readFormData.js'
import { sendHttpResponse } from '../../../../sendHttpResponse.js'
import type {
  BasedFunctionConfig,
  BasedRoute,
  Context,
  HttpSession,
  StreamPayload,
} from '../../../../../functions/index.js'
import {
  BasedErrorCode,
  createErrorData,
  type BasedErrorData,
} from '../../../../../errors/index.js'

const handleFile = async (
  server: BasedServer,
  ctx: Context<HttpSession>,
  installedFn: Promise<BasedFunctionConfig<'stream'> | null>,
  file: StreamPayload,
  route: BasedRoute<'stream'>,
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
      file,
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
  route: BasedRoute<'stream'>,
) => {
  const installedFn = installFn({ server, ctx: server.client.ctx, route })

  const pendingFiles: ReturnType<typeof handleFile>[] = []

  const onFile = (file: StreamPayload) => {
    pendingFiles.push(handleFile(server, ctx, installedFn, file, route))
  }

  const ready = async () => {
    const results = await Promise.all(pendingFiles)
    if (ctx.session) {
      sendHttpResponse(ctx, results)
    }
  }

  readFormData(ctx, server, route, onFile, ready)
}
