import { createRecord } from 'data-record'
import { EncodeDefinition } from './protocol.js'
import { defaultEncoder } from './defaultEncoder.js'
import { ModifyArgType } from './modify/types.js'
import { SELVA_NODE_ID_LEN, SelvaTraversal, update_def } from '../types.js'
import { VALUE_TYPES, VALUE_ENCODERS } from './modify/index.js'

function identity<T>(x: T): T {
  return x
}

type updateQueryOpts = {
  dir: SelvaTraversal
  dir_opt?: string
  edge_filter?: string
  edge_filter_regs?: string[]
}

type updateOp = {
  type: string
  field: string
  value: any
}

export function update(
  payload: [
    qOpts: updateQueryOpts,
    ops: updateOp[],
    nodeIds: string[],
    filter?: string,
    filterRegs?: string[]
  ]
) {
  const [qOpts, ops, nodeIds, filter, filterRegs] = payload
  const defs: EncodeDefinition = [{ type: 'bin' }, { type: 'string' }]
  const cmdArgs: any[] = [
    createRecord(update_def, qOpts),
    `${ops.length}`,
    ...ops
      .filter((op: updateOp) => op.field != 'type')
      .map(({ type, field, value }: updateOp) => {
        if (value?.$delete === true) {
          defs.push({ type: 'string' }, { type: 'string' }, { type: 'string' })
          return [ModifyArgType.SELVA_MODIFY_ARG_OP_DEL, field, '']
        }

        defs.push(
          { type: 'string' },
          { type: 'string' },
          VALUE_TYPES[type] || { type: 'string' }
        )

        const encoder = VALUE_ENCODERS[type] || identity
        return [type, field, encoder(value, type)]
      })
      .flat(1),
    nodeIds.map((s: string) => s.padEnd(SELVA_NODE_ID_LEN, '\0')).join(''),
  ]
  defs.push({ type: 'string' }) // nodeIds

  if (filter) {
    defs.push({ type: 'string' })
    cmdArgs.push(filter)
    if (filterRegs) {
      for (const reg of filterRegs) {
        defs.push({ type: 'string' })
        cmdArgs.push(reg)
      }
    }
  }

  const schema: EncodeDefinition = [{ type: 'array', values: defs }]
  const buf = defaultEncoder(schema)([cmdArgs])
  return buf
}
