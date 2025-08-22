import { MICRO_BUFFER } from '@based/schema/def'
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
    !def.include.main.len &&
    !def.include.langTextFields.size
  ) {
    return result
  }

  let mainBuffer: Uint8Array
  let len = 0
  let includeBuffer: Uint8Array

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

  if (def.include.langTextFields.size) {
    for (const [
      prop,
      { codes, def: propDef, fallBacks },
    ] of def.include.langTextFields.entries()) {
      def.include.propsRead[prop] = 0
      if (codes.has(0)) {
        const b = new Uint8Array(5)
        b[0] = includeOp.DEFAULT
        b[1] = prop
        b[2] = propDef.typeIndex
        b[3] = 0
        b[4] = 0
        result.push(b)
      } else {
        for (const code of codes) {
          const fallBackSize = fallBacks.length
          const b = new Uint8Array(5 + fallBackSize)
          b[0] = includeOp.DEFAULT
          b[1] = prop
          b[2] = propDef.typeIndex
          b[3] = code
          b[4] = fallBackSize
          let i = 0
          for (const fallback of fallBacks) {
            b[i + 5] = fallback
            i++
          }
          result.push(b)
        }
      }
    }
  }

  const propSize = def.include.props.size ?? 0

  let offset = 0
  if (mainBuffer) {
    if (mainBuffer.byteLength !== 0) {
      len = mainBuffer.byteLength + 5 + propSize * 3
      includeBuffer = new Uint8Array(len)
      includeBuffer[0] = includeOp.PARTIAL
      includeBuffer[1] = 0
      includeBuffer[2] = MICRO_BUFFER // add this in types
      includeBuffer[3] = mainBuffer.byteLength
      includeBuffer[4] = mainBuffer.byteLength >>> 8
      offset = 5 + mainBuffer.byteLength
      includeBuffer.set(mainBuffer, 5)
    } else {
      len = (propSize + 1) * 3
      includeBuffer = new Uint8Array(len)
      includeBuffer[0] = includeOp.DEFAULT
      includeBuffer[1] = 0
      includeBuffer[2] = MICRO_BUFFER
      offset = 3
    }
  } else if (propSize) {
    includeBuffer = new Uint8Array(propSize * 3)
  }

  if (propSize) {
    let i = 0
    for (const [prop, propDef] of def.include.props.entries()) {
      includeBuffer[i + offset] = includeOp.DEFAULT
      includeBuffer[i + offset + 1] = prop
      includeBuffer[i + offset + 2] = propDef.def.typeIndex
      i += 2
    }
  }

  if (includeBuffer) {
    def.include.props.forEach((v, k) => {
      def.include.propsRead[k] = 0
    })
    result.push(includeBuffer)
  }

  return result
}
