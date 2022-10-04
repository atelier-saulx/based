import { isObservableFunctionSpec } from '../../functions'
import {
	decodePayload,
	decodeName,
	readUint8,
	encodeGetResponse,
} from '../../protocol'
import { BasedServer } from '../../server'
import { create, destroy } from '../../observable'
import { ActiveObservable, WebsocketClient } from '../../types'
import { BasedErrorCode } from '../../error'
import { sendError } from './send'

const sendGetData = (
	server: BasedServer,
	id: number,
	obs: ActiveObservable,
	checksum: number,
	client: WebsocketClient
) => {
	if (!client.ws) {
		return
	}

	if (checksum === 0) {
		client.ws.send(obs.cache, true, false)
	} else if (checksum === obs.checksum) {
		client.ws.send(encodeGetResponse(id), true, false)
	} else if (obs.diffCache && obs.previousChecksum === checksum) {
		client.ws.send(obs.diffCache, true, false)
	} else {
		client.ws.send(obs.cache, true, false)
	}

	if (obs.clients.size === 0) {
		destroy(server, id)
	}
}

export const getMessage = (
	arr: Uint8Array,
	start: number,
	len: number,
	isDeflate: boolean,
	client: WebsocketClient,
	server: BasedServer
) => {
	// | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |

	const nameLen = arr[start + 20]

	const id = readUint8(arr, start + 4, 8)
	const checksum = readUint8(arr, start + 12, 8)
	const name = decodeName(arr, start + 21, start + 21 + nameLen)

	if (!name || !id) {
		return false
	}

	const route = server.functions.route(name)

	if (!route || !route.observable) {
		return false
	}

	const payload = decodePayload(
		new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
		isDeflate
	)

	server.auth.config
		.authorize(server, client, name, payload)
		.then((ok) => {
			if (!client.ws) {
				return false
			}

			if (!ok) {
				sendError(server, client, BasedErrorCode.AuthorizeRejectedError, route)
				return false
			}

			if (server.activeObservablesById.has(id)) {
				const obs = server.activeObservablesById.get(id)
				if (obs.beingDestroyed) {
					clearTimeout(obs.beingDestroyed)
					obs.beingDestroyed = null
				}
				if (obs.cache) {
					sendGetData(server, id, obs, checksum, client)
				} else {
					if (!obs.onNextData) {
						obs.onNextData = new Set()
					}
					obs.onNextData.add(() => {
						sendGetData(server, id, obs, checksum, client)
					})
				}
			} else {
				server.functions
					.install(name)
					.then((spec) => {
						if (spec && isObservableFunctionSpec(spec)) {
							const obs = create(server, name, id, payload)
							if (!client.ws?.obs.has(id)) {
								if (!obs.onNextData) {
									obs.onNextData = new Set()
								}
								obs.onNextData.add(() => {
									sendGetData(server, id, obs, checksum, client)
								})
							}
						} else {
							sendError(server, client, BasedErrorCode.FunctionNotFound, route)
						}
					})
					.catch((_err) => {
						sendError(server, client, BasedErrorCode.FunctionNotFound, route)
					})
			}
		})
		.catch((err) => {
			sendError(server, client, BasedErrorCode.AuthorizeFunctionError, {
				route,
				observableId: id,
				err,
			})
		})

	return true
}
