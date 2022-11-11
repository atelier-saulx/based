import { BasedErrorCode, ErrorPayload } from '../../error' // createError
import { WorkerClient } from '../../../types'
import { BasedServer } from '../../server'

export const sendError = (
  server: BasedServer,
  client: WorkerClient,
  basedCode: BasedErrorCode,
  err?: ErrorPayload[BasedErrorCode]
): void => {
  console.error('BOELOE BOELOE BOELOE ERROR!', err, basedCode)
  //   const errorData = createError(server, client, basedCode, err)
}
