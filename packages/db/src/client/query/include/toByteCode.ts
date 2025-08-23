import { MICRO_BUFFER, TEXT } from '@based/schema/def'
import { DbClient } from '../../index.js'
import { QueryDef, QueryDefType, includeOp } from '../types.js'
import { walkDefs } from './walk.js'

const EMPTY_BUFFER = new Uint8Array(0)

export const includeToBuffer = (db: DbClient, def: QueryDef): Uint8Array[] => {
  const result: Uint8Array[] = []

  if (
    !def.include.stringFields.size &&
    !def.include.props.size &&
    !def.references.size &&
    !def.include.main.len
  ) {
    return result
  }

  let mainBuffer: Uint8Array

  if (def.include.stringFields) {
    for (const [field, include] of def.include.stringFields.entries()) {
      walkDefs(db, def, { field, opts: include.opts })
    }
  }

  if (def.include.main.len > 0) {
    const len =
      def.type === QueryDefType.Edge
        ? def.target.ref.edgeMainLen
        : def.schema.mainLen

    if (def.include.main.len === len) {
      // GET ALL MAIN FIELDS
      mainBuffer = EMPTY_BUFFER
      let i = 2
      for (const key in def.include.main.include) {
        const v = def.include.main.include[key]
        v[0] = v[1].start
        i += 4
      }
    } else {
      // GET SOME MAIN FIELDS
      const size = Object.keys(def.include.main.include).length
      mainBuffer = new Uint8Array(size * 4 + 2)
      mainBuffer[0] = def.include.main.len
      mainBuffer[1] = def.include.main.len >>> 8
      let i = 2
      let m = 0
      for (const key in def.include.main.include) {
        const v = def.include.main.include[key]
        mainBuffer[i] = v[1].start
        mainBuffer[i + 1] = v[1].start >>> 8
        const len = v[1].len
        v[0] = m
        mainBuffer[i + 2] = len
        mainBuffer[i + 3] = len >>> 8
        i += 4
        m += len
      }
    }
  }

  const propSize = def.include.props.size ?? 0

  if (mainBuffer) {
    if (mainBuffer.byteLength !== 0) {
      const buf = new Uint8Array(5)
      buf[0] = includeOp.PARTIAL
      buf[1] = 0
      buf[2] = MICRO_BUFFER // add this in types
      buf[3] = mainBuffer.byteLength
      buf[4] = mainBuffer.byteLength >>> 8
      result.push(buf, mainBuffer)
    } else {
      const buf = new Uint8Array(3)
      buf[0] = includeOp.DEFAULT
      buf[1] = 0
      buf[2] = MICRO_BUFFER
      result.push(buf)
    }
  }

  if (propSize) {
    for (const [prop, propDef] of def.include.props.entries()) {
      if (propDef.opts?.meta) {
        const buf = new Uint8Array(3)
        buf[0] = includeOp.META
        buf[1] = prop
        buf[2] = propDef.def.typeIndex
        result.push(buf)
      }
      if (propDef.opts?.meta !== 'only') {
        if (propDef.def.typeIndex === TEXT) {
          const codes = propDef.opts.codes
          if (codes.has(0)) {
            const b = new Uint8Array(5)
            b[0] = includeOp.DEFAULT
            b[1] = prop
            b[2] = propDef.def.typeIndex
            b[3] = 0
            b[4] = 0
            result.push(b)
          } else {
            for (const code of codes) {
              const fallBackSize = propDef.opts.fallBacks.length
              const b = new Uint8Array(5 + fallBackSize)
              b[0] = includeOp.DEFAULT
              b[1] = prop
              b[2] = propDef.def.typeIndex
              b[3] = code
              b[4] = fallBackSize
              let i = 0
              for (const fallback of propDef.opts.fallBacks) {
                b[i + 5] = fallback
                i++
              }
              result.push(b)
            }
          }
        } else {
          const buf = new Uint8Array(3)
          buf[0] = includeOp.DEFAULT
          buf[1] = prop
          buf[2] = propDef.def.typeIndex
          result.push(buf)
        }
      }
    }
  }

  return result
}
