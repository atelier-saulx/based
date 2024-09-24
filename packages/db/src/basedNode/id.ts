import { readSeperateFieldFromBuffer } from './read.js'
import { ID_FIELD_DEF } from '../schema/schema.js'

export const idDef = {
  set: () => undefined,
  get() {
    if (this.__r) {
      return readSeperateFieldFromBuffer(ID_FIELD_DEF, this)
    }
    return this.__q.buffer.readUint32LE(this.__o)
  },
}
