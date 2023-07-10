import { write, bufLen, EncodeDefinition } from './protocol'

export function defaultEncoder(
  schema: EncodeDefinition
): (payload: any) => Buffer {
  return (payload) => {
    if (!Array.isArray(payload)) {
      payload = [payload]
    }

    const buf = Buffer.alloc(bufLen(schema, payload))
    write(buf, schema, payload)
    return buf
  }
}
