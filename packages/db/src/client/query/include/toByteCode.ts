import { DbClient } from '../../index.js'
import {
  IntermediateByteCode,
  QueryDef,
  QueryDefType,
  includeOp,
} from '../types.js'
import { walkDefs } from './walk.js'
import { langCodesMap, typeIndexMap } from '@based/schema'
import { writeUint16, writeUint32 } from '@based/utils'
import { getEnd } from './utils.js'

const EMPTY_BUFFER = new Uint8Array(0)

export const includeToBuffer = (
  db: DbClient,
  def: QueryDef,
): IntermediateByteCode[] => {
  const result: Uint8Array[] = []

  if (
    !def.include.stringFields.size &&
    !def.include.props.size &&
    !def.references.size &&
    !def.include.main.len
  ) {
    return result
  }

  let mainBuffer: Uint8Array | undefined

  if (def.include.stringFields) {
    for (const [field, include] of def.include.stringFields.entries()) {
      walkDefs(db, def, { field, opts: include.opts })
    }
  }

  if (def.include.main.len > 0) {
    // const len =
    //   def.type === QueryDefType.Edge
    //     ? def.target.ref.edgeMainLen
    //     : def.schema.mainLen

    console.warn('TODO: includeToBuffer handle edges here?')
    const len = def.schema.size
    if (def.include.main.len === len) {
      // Get all main fields
      mainBuffer = EMPTY_BUFFER
      let i = 2
      for (const value of def.include.main.include.values()) {
        value[0] = value[1].main.start
        i += 4
      }
    } else {
      const size = def.include.main.include.size
      mainBuffer = new Uint8Array(size * 4 + 2)
      writeUint16(mainBuffer, def.include.main.len, 0)
      let i = 2
      let m = 0
      for (const value of def.include.main.include.values()) {
        const propDef = value[1]
        writeUint16(mainBuffer, propDef.main.start, i)
        writeUint16(mainBuffer, propDef.main.size, i + 2)
        value[0] = m
        i += 4
        m += propDef.main.size
      }
    }
  }

  const propSize = def.include.props.size ?? 0

  if (mainBuffer) {
    if (mainBuffer.byteLength !== 0) {
      const buf = new Uint8Array(5)
      buf[0] = includeOp.PARTIAL
      buf[1] = 0 // field name 0
      buf[2] = typeIndexMap.microbuffer
      writeUint16(buf, mainBuffer.byteLength, 3)
      result.push(buf, mainBuffer)
    } else {
      const buf = new Uint8Array(4)
      buf[0] = includeOp.DEFAULT
      buf[1] = 0 // field name 0
      buf[2] = typeIndexMap.microbuffer
      buf[3] = 0 // opts len
      result.push(buf)
    }
  }

  if (propSize) {
    for (const [prop, propDef] of def.include.props.entries()) {
      const typeIndex = propDef.opts?.raw
        ? typeIndexMap.binary
        : propDef.def.typeIndex
      if (!propDef.opts?.fallBacks) {
        continue
      }
      if (propDef.opts.meta) {
        if (propDef.opts.codes) {
          if (propDef.opts.codes.has(0)) {
            console.warn('TODO: handle locales!')
            // TODO use locales for 0 make this NICE
            // for (const code in def.schema.locales) {
            //   const buf = new Uint8Array(4)
            //   buf[0] = includeOp.META
            //   buf[1] = prop
            //   buf[2] = typeIndex
            //   buf[3] = langCodesMap.get(code) ?? 0
            //   result.push(buf)
            // }
          } else {
            for (const code of propDef.opts.codes) {
              const buf = new Uint8Array(4)
              buf[0] = includeOp.META
              buf[1] = prop
              buf[2] = typeIndex
              buf[3] = code
              result.push(buf)
            }
          }
        } else {
          const buf = new Uint8Array(4)
          buf[0] = includeOp.META
          buf[1] = prop
          buf[2] = typeIndex
          buf[3] = 0
          result.push(buf)
        }
      }

      if (propDef.opts.meta !== 'only') {
        const hasEnd = propDef.opts?.end
        if (typeIndex === typeIndexMap.text) {
          const codes = propDef.opts?.codes
          if (!codes) continue
          if (codes.has(0)) {
            const b = new Uint8Array(hasEnd ? 12 : 4)
            b[0] = includeOp.DEFAULT
            b[1] = prop
            b[2] = typeIndex
            if (hasEnd) {
              b[3] = 8 // opts len
              b[4] = 0 // lang code
              b[5] = 0 // fallbackSize
              b[6] = 1 // has end
              b[7] = propDef.opts?.bytes ? 0 : 1 // is string
              writeUint32(b, getEnd(propDef.opts), 8)
            } else {
              b[3] = 0 // opts len
            }
            result.push(b)
          } else {
            for (const code of codes) {
              const fallBackSize = propDef.opts.fallBacks.length
              const endCode = getEnd(propDef.opts, code)
              const b = new Uint8Array(7 + (endCode ? 5 : 0) + fallBackSize)
              b[0] = includeOp.DEFAULT
              b[1] = prop
              b[2] = typeIndex
              let i = 0
              if (endCode) {
                b[3] = fallBackSize + 8 // opts
                b[4] = code // say if there is a end option
                b[5] = fallBackSize
                b[6] = 1 // has end
                b[7] = propDef.opts?.bytes ? 0 : 1 // is string use chars (can be optional)
                writeUint32(b, endCode, 8)
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
          buf[2] = typeIndex
          if (hasEnd) {
            buf[3] = 5 // opts len
            buf[4] =
              propDef.opts?.bytes ||
              (typeIndex !== typeIndexMap.json &&
                typeIndex !== typeIndexMap.string)
                ? 0
                : 1
            writeUint32(buf, getEnd(propDef.opts), 5)
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
