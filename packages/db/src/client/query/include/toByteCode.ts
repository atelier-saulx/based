import { MICRO_BUFFER, STRING, TEXT, JSON } from '@based/schema/def'
import { DbClient } from '../../index.js'
import { QueryDef, QueryDefType, includeOp } from '../types.js'
import { walkDefs } from './walk.js'
import { langCodesMap } from '@based/schema'
import { writeUint32 } from '@based/utils'

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
      buf[1] = 0 // field name 0
      buf[2] = MICRO_BUFFER
      buf[3] = mainBuffer.byteLength
      buf[4] = mainBuffer.byteLength >>> 8
      result.push(buf, mainBuffer)
    } else {
      const buf = new Uint8Array(4)
      buf[0] = includeOp.DEFAULT
      buf[1] = 0 // field name 0
      buf[2] = MICRO_BUFFER
      buf[3] = 0 // opts len
      result.push(buf)
    }
  }

  if (propSize) {
    for (const [prop, propDef] of def.include.props.entries()) {
      if (propDef.opts?.meta) {
        if (propDef.opts.codes) {
          if (propDef.opts.codes.has(0)) {
            // TODO use locales for 0 make this NICE
            for (const code in def.schema.locales) {
              const buf = new Uint8Array(4)
              buf[0] = includeOp.META
              buf[1] = prop
              buf[2] = propDef.def.typeIndex
              buf[3] = langCodesMap.get(code)
              result.push(buf)
            }
          } else {
            for (const code of propDef.opts.codes) {
              const buf = new Uint8Array(4)
              buf[0] = includeOp.META
              buf[1] = prop
              buf[2] = propDef.def.typeIndex
              buf[3] = code
              result.push(buf)
            }
          }
        } else {
          const buf = new Uint8Array(4)
          buf[0] = includeOp.META
          buf[1] = prop
          buf[2] = propDef.def.typeIndex
          buf[3] = 0
          result.push(buf)
        }
      }

      if (propDef.opts?.meta !== 'only') {
        const hasEnd = propDef.opts?.end
        const t = propDef.def.typeIndex
        if (t === TEXT) {
          const codes = propDef.opts.codes
          if (codes.has(0)) {
            const b = new Uint8Array(hasEnd ? 11 : 4)
            b[0] = includeOp.DEFAULT
            b[1] = prop
            b[2] = propDef.def.typeIndex
            if (hasEnd) {
              b[3] = 7 // opts len
              b[4] = 0 // lang code
              b[5] = 0 // fallbackSize
              b[6] = 1 // has end
              writeUint32(b, propDef.opts?.end, 7)
            } else {
              b[3] = 0 // opts len
            }
            result.push(b)
          } else {
            for (const code of codes) {
              const fallBackSize = propDef.opts.fallBacks.length
              const b = new Uint8Array(7 + (hasEnd ? 5 : 0) + fallBackSize)
              b[0] = includeOp.DEFAULT
              b[1] = prop
              b[2] = propDef.def.typeIndex
              let i = 0
              if (hasEnd) {
                b[3] = fallBackSize + 8 // opts
                b[4] = code // say if there is a end option
                b[5] = fallBackSize
                b[6] = 1 // has end
                b[7] = 1 // is string use chars (can be optional)
                writeUint32(b, propDef.opts?.end, 8)
                i = 11
              } else {
                b[3] = fallBackSize + 3 // opts
                b[4] = code // say if there is a end option
                b[5] = fallBackSize
                b[6] = 0 // no end
                i = 7
              }
              for (const fallback of propDef.opts.fallBacks) {
                b[i] = fallback
                i++
              }
              result.push(b)
            }
          }
        } else {
          const buf = new Uint8Array(hasEnd ? 9 : 4)
          buf[0] = includeOp.DEFAULT
          buf[1] = prop
          buf[2] = propDef.def.typeIndex
          if (hasEnd) {
            buf[3] = 5 // opts len
            buf[4] = t === JSON || t === STRING ? 1 : 0
            writeUint32(buf, propDef.opts.end, 5)
          } else {
            buf[3] = 0 // opts len
          }
          result.push(buf)
        }
      }
    }
  }

  return result
}
