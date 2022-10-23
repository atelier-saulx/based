// sharedBuf

// authorize has to go from here (scince we dont parse the payload yet)
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
