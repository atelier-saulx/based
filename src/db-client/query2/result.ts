import {
  resultToObject,
  type ReaderSchema,
  ReaderSchemaEnum,
} from '../../protocol/index.js'

const parse = (target: object) =>
  resultToObject(
    target[$schema],
    target[$buffer],
    target[$buffer].byteLength - 4,
  )

const sharedHandler: ProxyHandler<any> = {
  get(target, prop) {
    if (prop === 'then') return target[prop]
    target[$parsed] ??= parse(target)
    return target[$parsed][prop]
  },
  ownKeys(target) {
    target[$parsed] ??= parse(target)
    return Reflect.ownKeys(target[$parsed])
  },
  getOwnPropertyDescriptor(target, prop) {
    target[$parsed] ??= parse(target)
    return Reflect.getOwnPropertyDescriptor(target[$parsed], prop)
  },
}

const $parsed = Symbol()
const $buffer = Symbol()
const $schema = Symbol()

export const proxyResult = (buffer: Uint8Array, schema: ReaderSchema) => {
  const target = schema.type === ReaderSchemaEnum.single ? {} : []
  const proxy = new Proxy(target, sharedHandler)
  target[$buffer] = buffer
  target[$schema] = schema
  return proxy
}
