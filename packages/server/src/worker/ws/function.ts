import {
  decodePayload,
  valueToBuffer,
  encodeFunctionResponse,
} from '../../protocol'
import { parentPort } from 'node:worker_threads'
import { ClientContext } from '../../types'
import { authorize } from '../authorize'
// add authorize

export default (
  name: string,
  path: string,
  id: number,
  reqId: number,
  context: ClientContext,
  isDeflate: boolean,
  payload?: Uint8Array
) => {
  const fn = require(path)

  let parsedPayload: any

  if (payload) {
    parsedPayload = decodePayload(payload, isDeflate)
  }

  authorize(context, name, payload)   .then((ok) => {
    //     if (!ok) {
    //       sendError(server, client, BasedErrorCode.AuthorizeRejectedError, route)
    //       return false
    //     }
    
    //     server.functions
    //       .install(name)
    //       .then((spec) => {
    //         if (spec && !isObservableFunctionSpec(spec)) {
    //           spec
    //             .function(payload, client)
    //             .then((v) => {
    //               client.ws?.send(
    //                 encodeFunctionResponse(reqId, valueToBuffer(v)),
    //                 true,
    //                 false
    //               )
    //             })
    //             .catch((err) => {
    //               sendError(server, client, BasedErrorCode.FunctionError, {
    //                 route,
    //                 requestId: reqId,
    //                 err,
    //               })
    //             })
    //         } else {
    //           sendError(server, client, BasedErrorCode.FunctionNotFound, route)
    //         }
    //       })
    //       .catch(() => {
    //         sendError(server, client, BasedErrorCode.FunctionNotFound, route)
    //       })
    //   })
    //   .catch((err) => {
    //     sendError(server, client, BasedErrorCode.AuthorizeFunctionError, {
    //       route,
    //       requestId: reqId,
    //       err,
    //     })
    //     return false
    //   })

  fn(parsedPayload, {})
    .then((v) => {
      parentPort.postMessage({
        id,
        payload: encodeFunctionResponse(reqId, valueToBuffer(v)),
      })
    })
    .catch((err) => {
      parentPort.postMessage({
        id,
        err,
      })
    })
}

// sharedBuf

// authorize has to go from here (scince we dont parse the payload yet)

// authorize has to be a path to an authorize function as well....

// server.auth.config
//   .authorize(server, client, name, payload)
//   .then((ok) => {
//     if (!ok) {
//       sendError(server, client, BasedErrorCode.AuthorizeRejectedError, route)
//       return false
//     }

//     server.functions
//       .install(name)
//       .then((spec) => {
//         if (spec && !isObservableFunctionSpec(spec)) {
//           spec
//             .function(payload, client)
//             .then((v) => {
//               client.ws?.send(
//                 encodeFunctionResponse(reqId, valueToBuffer(v)),
//                 true,
//                 false
//               )
//             })
//             .catch((err) => {
//               sendError(server, client, BasedErrorCode.FunctionError, {
//                 route,
//                 requestId: reqId,
//                 err,
//               })
//             })
//         } else {
//           sendError(server, client, BasedErrorCode.FunctionNotFound, route)
//         }
//       })
//       .catch(() => {
//         sendError(server, client, BasedErrorCode.FunctionNotFound, route)
//       })
//   })
//   .catch((err) => {
//     sendError(server, client, BasedErrorCode.AuthorizeFunctionError, {
//       route,
//       requestId: reqId,
//       err,
//     })
//     return false
//   })
