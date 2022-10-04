import { valueToBuffer, encodeErrorResponse } from '../../protocol'
import { BasedErrorCode, ErrorPayload, createError } from '../../error'
import { WebsocketClient } from '../../types'
import { BasedServer } from '../../server'

export const sendError = (
	server: BasedServer,
	client: WebsocketClient,
	basedCode: BasedErrorCode,
	err?: ErrorPayload[BasedErrorCode]
): void => {
	const errorData = createError(server, client, basedCode, err)
	client.ws?.send(
		encodeErrorResponse(valueToBuffer(errorData)),
		true,
		false
	)
}
