import { write, bufLen, EncodeDefinition } from './protocol.js'

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

export function strEncoder(argc: number): (payload: any) => Buffer {
  const schema: EncodeDefinition = []
  for (let i = 0; i < argc; i++) {
    schema.push({ type: 'string' })
  }

  return defaultEncoder(schema)
}
