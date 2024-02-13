import test from 'ava'
import {
  BasedErrorCode,
  BasedErrorPayload,
  createErrorData,
  errorTypeHandlers
} from '../src/index.js'

test('createErrorData server error', (t) => {
  const payload: BasedErrorPayload = {
    observableId: 1234,
    route: { type: 'function', name: 'test' }
  }
  const result = createErrorData(BasedErrorCode.InvalidPayload, payload)
  t.is(result.code, BasedErrorCode.InvalidPayload)
  t.is(result.statusCode, errorTypeHandlers[BasedErrorCode.InvalidPayload].statusCode)
  t.is(result.statusMessage, errorTypeHandlers[BasedErrorCode.InvalidPayload].statusMessage)
  t.is(result.message, errorTypeHandlers[BasedErrorCode.InvalidPayload].message(payload))
})

test('createErrorData parse error', (t) => {
  const payload = { path: ['a', 'field'] }
  const result = createErrorData(BasedErrorCode.incorrectFieldType, payload)
  t.is(result.code, BasedErrorCode.incorrectFieldType)
  t.is(result.message, errorTypeHandlers[BasedErrorCode.incorrectFieldType].message(payload))
})
