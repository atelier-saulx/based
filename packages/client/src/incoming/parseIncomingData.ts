import { readUint32 } from '@based/utils'
import {
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_UINT8_ARRAY,
  CONTENT_TYPE_STRING,
  CONTENT_TYPE_UNDEFINED,
  CONTENT_TYPE_NULL,
  CONTENT_TYPE_DB_QUERY,
} from '../contentType.js'
import { deSerializeSchema, resultToObject } from '@based/protocol/db-read'

const Decoder = new TextDecoder()

export const parseIncomingData = (contentType: number, buf: Uint8Array) => {
  if (contentType === CONTENT_TYPE_UNDEFINED) {
    return undefined
  }
  if (contentType === CONTENT_TYPE_NULL) {
    return null
  }
  if (contentType === CONTENT_TYPE_UINT8_ARRAY) {
    return buf
  }
  if (contentType === CONTENT_TYPE_STRING) {
    return Decoder.decode(buf)
  }
  if (contentType === CONTENT_TYPE_JSON) {
    return JSON.parse(Decoder.decode(buf))
  }
  if (contentType === CONTENT_TYPE_DB_QUERY) {
    const schemaLen = readUint32(buf, 0)
    const schema = deSerializeSchema(buf.subarray(4, schemaLen + 4))
    const result = buf.subarray(schemaLen + 4)
    return resultToObject(schema, result, result.byteLength)
  }
  throw new Error('Invalid contentType received')
}
