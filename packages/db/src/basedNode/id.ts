import { readSeperateFieldFromBuffer } from './read.js'
import { idFieldDef } from '../schemaTypeDef.js'

export const idDef = {
  set: () => undefined,
  get() {
    if (this.__r) {
      return readSeperateFieldFromBuffer(idFieldDef, this)
    }

    return this.__q.buffer.readUint32LE(this.__o)
  },
}
