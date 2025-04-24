import {
  CONTENT_TYPE,
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_NULL,
  CONTENT_TYPE_STRING,
  CONTENT_TYPE_UINT8_ARRAY,
  CONTENT_TYPE_UNDEFINED,
} from './protocol.js'

const Decoder = new TextDecoder()

export const parseIncomingData = (buf: Uint8Array) => {
  if (buf.byteLength === 0) {
    // what is this..?
    return undefined
  }

  const contentType: CONTENT_TYPE = buf[0] as CONTENT_TYPE

  if (contentType === CONTENT_TYPE_UNDEFINED) {
    return undefined
  } else if (contentType === CONTENT_TYPE_NULL) {
    return null
  } else if (contentType === CONTENT_TYPE_UINT8_ARRAY) {
    return buf.subarray(1)
  } else if (contentType === CONTENT_TYPE_STRING) {
    return Decoder.decode(buf.subarray(1))
  } else if (contentType === CONTENT_TYPE_JSON) {
    return JSON.parse(Decoder.decode(buf.subarray(1)))
  }

  throw new Error('Invalid contentType received')
}
