import { prop } from './utils.js'

export function BasedNodeBase() {}
// TREE (for nested objects)
Object.defineProperty(BasedNodeBase.prototype, '__t', {
  writable: true,
  enumerable: false,
})
Object.defineProperty(BasedNodeBase.prototype, '__q', {
  writable: true,
  enumerable: false,
})
Object.defineProperty(BasedNodeBase.prototype, '__o', {
  writable: true,
  enumerable: false,
})
prop(BasedNodeBase.prototype, 'id', {
  get() {
    return this.__q.buffer.readUint32LE(this.__offset__)
  },
})

export class BasedNode extends Object {
  [key: string]: any
}
