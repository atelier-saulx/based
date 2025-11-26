import db from '../zigAddon.js'
import { bufToHex } from '../utils/index.js'

export default function createHash() {
  const state = db.hashCreate()
  const hash = {
    update: (buf: Uint8Array) => {
      db.hashUpdate(state, buf)
      return hash
    },
    digest: (encoding?: 'hex'): Uint8Array | string => {
      const buf = new Uint8Array(16)
      db.hashDigest(state, buf)
      if (encoding === 'hex') {
        return bufToHex(buf)
      } else {
        return buf
      }
    },
    reset: () => {
      db.hashReset(state)
    },
  }

  return hash
}
