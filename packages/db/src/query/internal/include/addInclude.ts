import { BasedDb } from '../../../index.js'
import { ID_FIELD_DEF } from '../../../schema/schema.js'
import { QueryDef } from '../types.js'
import { addRefInclude } from './addRefInclude.js'
import { parseInclude } from './parseInclude.js'

const EMPTY_BUFFER = Buffer.alloc(0)

export const addInclude = (db: BasedDb, def: QueryDef): Buffer[] => {
  if (!def.include.stringFields.size && !def.include.props.size) {
    return [EMPTY_BUFFER]
  }

  //   const includeTreeIntermediate = {
  //     id: ID_FIELD_DEF,
  //   }

  let includesMain = false
  let mainBuffer: Buffer
  let len = 0
  let includeBuffer: Buffer

  // includeTreeIntermediate

  for (const f of def.include.stringFields) {
    if (parseInclude(db, def, f, includesMain)) {
      includesMain = true
    }
  }

  if (includesMain) {
    if (def.include.main.len === def.schema.mainLen) {
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

  if (mainBuffer) {
    len = mainBuffer.byteLength + 1 + 2 + def.include.props.size
    includeBuffer = Buffer.allocUnsafe(len)
    includeBuffer[0] = 0
    includeBuffer.writeInt16LE(mainBuffer.byteLength, 1)
    const offset = 3 + mainBuffer.byteLength
    mainBuffer.copy(includeBuffer, 3)
    let i = 0
    for (const prop of def.include.props) {
      includeBuffer[i + offset] = prop
      i++
    }
  } else {
    const buf = Buffer.allocUnsafe(def.include.props.size)
    let i = 0
    for (const prop of def.include.props) {
      buf[i] = prop
      i++
    }
    includeBuffer = buf
  }

  // include.includeTree = convertToIncludeTree(includeTreeIntermediate)

  const result: Buffer[] = [includeBuffer]

  def.references.forEach((refs, key) => {
    result.push(...addRefInclude(db, refs))
  })

  return result
}
