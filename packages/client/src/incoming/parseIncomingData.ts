import {
  CONTENT_TYPE,
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_NULL,
  CONTENT_TYPE_STRING,
  CONTENT_TYPE_UINT8_ARRAY,
  CONTENT_TYPE_UNDEFINED,
} from './protocol.js'

const Decoder = new TextDecoder()

export const parseIncomingData = (contentType: number, buf: Uint8Array) => {
  if (contentType === CONTENT_TYPE_UNDEFINED) {
    return undefined
  } else if (contentType === CONTENT_TYPE_NULL) {
    return null
  } else if (contentType === CONTENT_TYPE_UINT8_ARRAY) {
    return buf
  } else if (contentType === CONTENT_TYPE_STRING) {
    return Decoder.decode(buf)
  } else if (contentType === CONTENT_TYPE_JSON) {
    return JSON.parse(Decoder.decode(buf))
  }

  console.error('derp', contentType, buf)

  throw new Error('Invalid contentType received')
}
