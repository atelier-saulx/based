import { createRecord } from 'data-record'
import { opSetHll } from './types.js'

export function encodeHll(x: string): Buffer {
  return createRecord(opSetHll, {
    _spare: BigInt(0),
    $add: x,
  })
}
