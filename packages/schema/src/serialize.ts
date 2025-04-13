import * as deflate from 'fflate'
import { StrictSchema } from './types.js'

const hasNative = '__basedDb__native__' in global

export const serialize = (schema: StrictSchema): Uint8Array => {
  return new Uint8Array([])
}

export const deSerialize = (schema: Uint8Array): StrictSchema => {
  return {}
}
