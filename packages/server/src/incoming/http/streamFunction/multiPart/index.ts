import {
  HttpSession,
  Context,
  // StreamPayload,
  // BasedStreamFunction,
} from '@based/functions'
import { BasedServer } from '../../../../server'
import { BasedStreamFunctionRoute } from '../../../../functions'
// import { sendError } from '../../../../sendError'
// import getExtension from '../getExtension'
// import { authorizeRequest } from '../../authorize'
// import { BasedErrorCode, BasedErrorData, createError } from '../../../../error'
// import { BasedErrorData } from '../../../../error'

// import { sendHttpResponse } from '../../../../sendHttpResponse'
import readFormData from './readFormData'

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

  // const fileHandlers: {
  //   resolve: (payload: StreamPayload) => void
  //   reject: (err: BasedErrorData) => void
  //   payload: StreamPayload
  // }[] = []

  // let installFn: Promise<BasedStreamFunction>

  /*
    if (spec && !isObservableFunctionSpec(spec) && spec.stream) {
          installedFn = spec.function
          if (fileHandlers.length) {
            for (const file of fileHandlers) {
              installedFn(server.client, file.payload, ctx)
                .then(file.resolve)
                .catch((err) =>
                  file.reject(
                    createError(server, ctx, BasedErrorCode.FunctionError, {
                      route,
                      err,
                    })
                  )
                )
            }
          }
        } else {
          sendError(server, ctx, BasedErrorCode.FunctionNotFound, route)
        }
   // Promise.allSettled(promiseQ)
        //   .then((results) => {
        //     const r = results.map((v) => {
        //       if (v.status === 'rejected') {
        //         return v.reason
        //       } else {
        //         return v.value
        //       }
        //     })
        //     sendHttpResponse(ctx, r)
        //   })
        //   .catch((err) => {
        //     console.info('???', err)
        //   })
  */

  const onFile = () => {
    console.log('this is rdy...')

    // authorizeRequest(
    //   server,
    //   ctx,
    //   payload,
    //   route,
    //   (payload) => {
    //     if (!installedFn) {
    //       fileHandlers.push({ payload, resolve, reject })
    //     } else {
    //       installedFn(server.client, payload, ctx)
    //         .then(resolve)
    //         .catch((err) => {
    //           payload.stream.destroy()
    //           reject(
    //             createError(server, ctx, BasedErrorCode.FunctionError, {
    //               route,
    //               err,
    //             })
    //           )
    //         })
    //     }
    //   },
    //   (server, ctx, payload, err) => {
    //     payload.stream.destroy()
    //     if (err) {
    //       reject(
    //         createError(
    //           server,
    //           ctx,
    //           BasedErrorCode.AuthorizeFunctionError,
    //           {
    //             route,
    //             err,
    //           }
    //         )
    //       )
    //       return
    //     }
    //     reject(
    //       createError(server, ctx, BasedErrorCode.AuthorizeRejectedError, {
    //         route,
    //       })
    //     )
    //   }
    // )
  }

  const ready = () => {
    console.log('xx')
  }

  readFormData(ctx, server, route, onFile, ready)
}
