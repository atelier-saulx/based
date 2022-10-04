import { isObservableFunctionSpec } from '../../functions'
import {
	readUint8,
	valueToBuffer,
	encodeFunctionResponse,
	decodePayload,
	decodeName,
} from '../../protocol'
import { BasedServer } from '../../server'
import { BasedErrorCode } from '../../error'
import { sendError } from './send'
import { WebsocketClient } from '../../types'

export const functionMessage = (
	arr: Uint8Array,
	start: number,
	len: number,
	isDeflate: boolean,
	client: WebsocketClient,
	server: BasedServer
): boolean => {
	// | 4 header | 3 id | 1 name length | * name | * payload |

	const reqId = readUint8(arr, start + 4, 3)
	const nameLen = arr[start + 7]
	const name = decodeName(arr, start + 8, start + 8 + nameLen)
	const payload = decodePayload(
		new Uint8Array(arr.slice(start + 8 + nameLen, start + len)),
		isDeflate
	)

	if (!name || !reqId) {
		return false
	}

	const route = server.functions.route(name)

	if (!route || route.observable === true || route.stream === true) {
		// stream not with ws for now...
		return false
	}

	server.auth.config
		.authorize(server, client, name, payload)
		.then((ok) => {
			if (!ok) {
				sendError(server, client, BasedErrorCode.AuthorizeRejectedError, route)
				return false
			}

			server.functions
				.install(name)
				.then((spec) => {
					if (spec && !isObservableFunctionSpec(spec)) {
						spec
							.function(payload, client)
							.then((v) => {
								client.ws?.send(
									encodeFunctionResponse(reqId, valueToBuffer(v)),
									true,
									false
								)
							})
							.catch((err) => {
								sendError(server, client, BasedErrorCode.FunctionError, {
									route,
									requestId: reqId,
									err,
								})
							})
					} else {
						sendError(server, client, BasedErrorCode.FunctionNotFound, route)
					}
				})
				.catch((_err) => {
					sendError(server, client, BasedErrorCode.FunctionNotFound, route)
				})
		})
		.catch((err) => {
			sendError(server, client, BasedErrorCode.AuthorizeFunctionError, {
				route,
				requestId: reqId,
				err,
			})
			return false
		})

	return true
}
