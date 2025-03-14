import { DbClient } from '../../index.js'
import { QueryDef, QueryDefType } from '../types.js'
import { walkDefs } from './walk.js'

const EMPTY_BUFFER = Buffer.alloc(0)

export const includeToBuffer = (db: DbClient, def: QueryDef): Buffer[] => {
  const result: Buffer[] = []

  if (
    !def.include.stringFields.size &&
    !def.include.props.size &&
    !def.references.size &&
    !def.include.main.len &&
    !def.include.langTextFields.size
  ) {
    return result
  }

  let mainBuffer: Buffer
  let len = 0
  let includeBuffer: Buffer

  if (def.include.stringFields) {
    for (const f of def.include.stringFields) {
      walkDefs(db, def, f)
    }
  }

  // main

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
      mainBuffer = Buffer.allocUnsafe(size * 4 + 2)
      mainBuffer.writeUint16LE(def.include.main.len, 0)
      let i = 2
      let m = 0
      for (const key in def.include.main.include) {
        const v = def.include.main.include[key]
        mainBuffer.writeUint16LE(v[1].start, i)
        const len = v[1].len
        v[0] = m
        mainBuffer.writeUint16LE(len, i + 2)
        i += 4
        m += len
      }
    }
  }

  if (def.include.langTextFields.size) {
    for (const [
      prop,
      { codes, def: propDef },
    ] of def.include.langTextFields.entries()) {
      def.include.propsRead[prop] = 0
      if (codes.has(0)) {
        const b = Buffer.allocUnsafe(3)
        b[0] = prop
        b[1] = propDef.typeIndex
        b[2] = 0
        result.push(b)
      } else {
        for (const code of codes) {
          const b = Buffer.allocUnsafe(3)
          b[0] = prop
          b[1] = propDef.typeIndex
          b[2] = code
          result.push(b)
        }
      }
    }
  }

  const propSize = def.include.props.size ?? 0

  if (mainBuffer) {
    len = mainBuffer.byteLength + 3 + propSize * 2
    includeBuffer = Buffer.allocUnsafe(len)
    includeBuffer[0] = 0
    includeBuffer.writeInt16LE(mainBuffer.byteLength, 1)
    const offset = 3 + mainBuffer.byteLength
    mainBuffer.copy(includeBuffer, 3)
    if (propSize) {
      let i = 0
      for (const [prop, propDef] of def.include.props.entries()) {
        includeBuffer[i + offset] = prop
        includeBuffer[i + offset + 1] = propDef.typeIndex
        i += 2
      }
    }
  } else if (propSize) {
    const buf = Buffer.allocUnsafe(propSize * 2)
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

  if (def.type === QueryDefType.Edge) {
    console.log(new Uint8Array(Buffer.concat(result)))
  }

  return result
}
