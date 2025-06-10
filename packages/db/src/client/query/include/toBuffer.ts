import { DbClient } from '../../index.js'
import { QueryDef, QueryDefType } from '../types.js'
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
    for (const f of def.include.stringFields) {
      walkDefs(db, def, f)
    }
  }

  if (def.include.main.len > 0) {
    // if (def.target.)

    const len =
      def.type === QueryDefType.Edge
        ? def.target.ref.edgeMainLen
        : def.schema.mainLen

    if (def.include.main.len === len) {
      // GET ALL MAIN FIELDS
      let m = 0
      for (const key in def.include.main.include) {
        const v = def.include.main.include[key]
        const len = v[1].len
        v[0] = m
        m += len
      }
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
        const b = new Uint8Array(4)
        b[0] = prop
        b[1] = propDef.typeIndex
        b[2] = 0
        b[3] = 0
        result.push(b)
      } else {
        for (const code of codes) {
          const fallBackSize = fallBacks.size
          const b = new Uint8Array(4 + fallBackSize)
          b[0] = prop
          b[1] = propDef.typeIndex
          b[2] = code
          b[3] = fallBackSize
          let i = 0
          for (const fallback of fallBacks) {
            b[i + 4] = fallback
            i++
          }
          result.push(b)
        }
      }
    }
  }

  const propSize = def.include.props.size ?? 0

  if (mainBuffer) {
    len = mainBuffer.byteLength + 3 + propSize * 2
    includeBuffer = new Uint8Array(len)
    includeBuffer[0] = 0
    includeBuffer[1] = mainBuffer.byteLength
    includeBuffer[2] = mainBuffer.byteLength >>> 8
    const offset = 3 + mainBuffer.byteLength
    includeBuffer.set(mainBuffer, 3)
    if (propSize) {
      let i = 0
      for (const [prop, propDef] of def.include.props.entries()) {
        includeBuffer[i + offset] = prop
        includeBuffer[i + offset + 1] = propDef.typeIndex
        i += 2
      }
    }
  } else if (propSize) {
    const buf = new Uint8Array(propSize * 2)
    let i = 0
    for (const [prop, propDef] of def.include.props.entries()) {
      buf[i] = prop
      buf[i + 1] = propDef.typeIndex
      i += 2
    }
    includeBuffer = buf
  }

  if (includeBuffer) {
    def.include.props.forEach((v, k) => {
      def.include.propsRead[k] = 0
    })
    result.push(includeBuffer)
  }

  return result
}
