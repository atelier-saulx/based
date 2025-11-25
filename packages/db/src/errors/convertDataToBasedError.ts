import { BasedErrorCode, BasedErrorData } from './types.js'
import { BasedError } from './BasedError.js'

export const convertDataToBasedError = (
  payload: BasedErrorData,
  stack?: string,
): BasedError => {
  if (!payload || typeof payload !== 'object') {
    const err = new BasedError(`Payload: ${payload}`)
    // err.code = BasedErrorCode.FunctionError
    err.name = 'Invalid returned payload'
    return err
  }
  const { message, code } = payload
  const msg = message
    ? message[0] === '['
      ? message
      : `[${BasedErrorCode[code]}] ` + message
    : !code
      ? JSON.stringify(payload, null, 2)
      : 'Cannot read error msg'
  const error = new BasedError(msg)
  error.stack = stack ? msg + ' ' + stack : msg
  error.name = BasedErrorCode[code]
  error.code = code
  return error
}
