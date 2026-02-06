import {
  resultToObject,
  type ReaderSchema,
  ReaderSchemaEnum,
} from '../../protocol/index.js'
import { readUint32 } from '../../utils/uint8.js'

export const $buffer = Symbol()
export const $schema = Symbol()
export const $result = Symbol()

const define = (result: any) => {
  if ('length' in result) {
    result.__proto__ = Array.prototype
    result.length = 0
    resultToObject(
      result[$schema],
      result[$buffer],
      result[$buffer].byteLength - 4,
      0,
      result,
    )
  } else {
    result.__proto__ = Object.prototype
    Object.assign(
      result,
      resultToObject(
        result[$schema],
        result[$buffer],
        result[$buffer].byteLength - 4,
        0,
      ),
    )
  }

  Object.defineProperty(result, $buffer, { enumerable: false })
  Object.defineProperty(result, $schema, { enumerable: false })
}

const handler: ProxyHandler<any> = {
  get(stub, prop) {
    const result = stub[$result]
    if (prop === $buffer || prop === $schema) {
      return result[prop]
    }
    if (prop === 'then') {
      // this can be improved!!
      const schema: ReaderSchema = result[$schema]
      if (schema.type !== ReaderSchemaEnum.single || !schema.props?.then) {
        return undefined
      }
    }

    define(result)
    return result[prop]
  },
  ownKeys(stub) {
    const result = stub[$result]
    define(result)
    return Reflect.ownKeys(result)
  },
  getOwnPropertyDescriptor(stub, prop) {
    const result = stub[$result]
    define(result)
    return Reflect.getOwnPropertyDescriptor(result, prop)
  },
}

export const proxyResult = (buffer: Uint8Array, schema: ReaderSchema) => {
  const single = schema.type === ReaderSchemaEnum.single
  const length = readUint32(buffer, 0)
  if (length === 0) return single ? null : []
  let stub, result
  if (single) {
    stub = {}
    result = {}
  } else {
    stub = []
    result = []
    result.length = length
  }
  const proxy = new Proxy(stub, handler)
  result[$buffer] = buffer
  result[$schema] = schema
  stub[$result] = result
  // @ts-ignore
  result.__proto__ = proxy
  return result
}
