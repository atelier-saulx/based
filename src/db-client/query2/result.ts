import {
  resultToObject,
  type ReaderSchema,
  ReaderSchemaEnum,
} from '../../protocol/index.js'

export const $buffer = Symbol()
export const $schema = Symbol()
export const $result = Symbol()

const define = (result: any) => {
  result.__proto__ = []
  const data = resultToObject(
    result[$schema],
    result[$buffer],
    result[$buffer].byteLength - 4,
    0,
    result,
  )
  if (data !== result) result.__proto__ = data
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
  const stub = single ? {} : []
  const result = single ? {} : []
  const proxy = new Proxy(stub, handler)

  result[$buffer] = buffer
  result[$schema] = schema
  stub[$result] = result
  // @ts-ignore
  result.__proto__ = proxy
  return result
}
