import {
  BasedErrorCode,
  createErrorData,
  errorTypeHandlers,
  type BasedErrorPayload,
} from '../../src/errors/index.js'
import { equal } from '../shared/assert.js'
import test from '../shared/test.js'

await test('createErrorData server error', async (t) => {
  const payload: BasedErrorPayload = {
    observableId: 1234,
    route: { type: 'function', name: 'test' },
  }
  const result = createErrorData(BasedErrorCode.InvalidPayload, payload)
  equal(result.code, BasedErrorCode.InvalidPayload)
  equal(
    result.statusCode,
    errorTypeHandlers[BasedErrorCode.InvalidPayload].statusCode,
  )
  equal(
    result.statusMessage,
    errorTypeHandlers[BasedErrorCode.InvalidPayload].statusMessage,
  )
  equal(
    result.message,
    errorTypeHandlers[BasedErrorCode.InvalidPayload].message(payload),
  )
})

await test('createErrorData parse error', async (t) => {
  const payload = { path: ['a', 'field'] }
  const result = createErrorData(BasedErrorCode.incorrectFieldType, payload)
  equal(result.code, BasedErrorCode.incorrectFieldType)
  equal(
    result.message,
    errorTypeHandlers[BasedErrorCode.incorrectFieldType].message(payload),
  )
})
