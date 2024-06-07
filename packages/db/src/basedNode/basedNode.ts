import { BasedQueryResponse } from '../query/BasedQueryResponse.js'
import { prop } from './utils.js'

export function BasedNodeBase() {}

const proto = BasedNodeBase.prototype

// TODO: add inspect

Object.defineProperty(proto, '__q', {
  writable: true,
  enumerable: false,
})
Object.defineProperty(proto, '__o', {
  writable: true,
  enumerable: false,
})
Object.defineProperty(proto, '__p', {
  writable: true,
  enumerable: false,
})
prop(proto, 'id', {
  get() {
    return this.__q.buffer.readUint32LE(this.__offset__)
  },
})

export class BasedNode extends Object {
  [key: string]: any
  '__q': BasedQueryResponse
  '__o': number
  '__p'?: number
}
