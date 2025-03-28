import { PropDef, REVERSE_SIZE_MAP, SchemaTypeDef } from './types.js'
import { DEFAULT_MAP } from './defaultMap.js'
import { VALIDATION_MAP } from './validation.js'

export const readFromPacked = (packed: Uint8Array): SchemaTypeDef => {
  const size = (packed[0] | (packed[1] << 8)) >>> 0

  const props: any = []
  const b = packed.subarray(2, 2 + size)

  let collectMain = false
  const mainProps = []
  const typeId = b.subarray(0, 2)
  const typeIdNr = (typeId[0] | (typeId[1] << 8)) >>> 0

  for (let i = 2; i < b.length; i++) {
    const prop = b[i]
    if (collectMain) {
      if (prop === 0) {
        collectMain = false
      } else {
        mainProps.push({
          prop: 0,
          typeIndex: b[i],
        })
      }
    } else {
      if (prop == 0) {
        collectMain = true
      } else {
        props.push({ prop, typeIndex: b[i + 1] })
        i++
      }
    }
  }

  const decoder = new TextDecoder()
  const fields: any = []
  const f = packed.subarray(2 + size, packed.length)
  for (let i = 0; i < f.length; i++) {
    const size = f[i]
    fields.push(decoder.decode(f.subarray(i + 1, i + 1 + size)))
    i += size
  }

  for (let i = 0; i < mainProps.length; i++) {
    mainProps[i].path = fields[i + 1]
  }

  for (let i = 0; i < props.length; i++) {
    props[i].path = fields[i + 1 + mainProps.length]
  }

  // Fixed len strings not supported
  // Refs also not supported
  // Text not supported yet
  // Ref not supported yet
  //   compression: 1 (0)

  const result: SchemaTypeDef = {
    cnt: 0,
    checksum: 0,
    total: 0,
    type: fields[0],
    lastId: 0,
    blockCapacity: 0,
    mainLen: mainProps.length,
    buf: b,
    propNames: f,
    packed,

    props: {},

    reverseProps: {}, // in a bit
    id: typeIdNr,
    idUint8: typeId,

    separate: [],
    main: {},

    tree: {},

    // not nessecary...
    hasSeperateSort: false,
    seperateSort: {
      size: 0,
      buffer: new Uint8Array([]),
      bufferTmp: new Uint8Array([]),
      props: [],
    },
    hasSeperateTextSort: false,
    seperateTextSort: {
      localeToIndex: new Map(),
      localeStringToIndex: new Map(),
      noUndefined: new Uint8Array([]),
      size: 0,
      buffer: new Uint8Array([]),
      bufferTmp: new Uint8Array([]),
      props: [],
    },

    mainEmpty: new Uint8Array([]),
    mainEmptyAllZeroes: true,
    // need this...
    locales: {},
    localeSize: 0,
  }

  let s = 0
  for (const p of mainProps) {
    const len = REVERSE_SIZE_MAP[p.typeIndex]
    const prop: PropDef = {
      prop: p.prop,
      separate: false,
      __isPropDef: true,
      validation: VALIDATION_MAP[p.typeIndex],
      start: s,
      default: DEFAULT_MAP[p.typeIndex], // tmp
      typeIndex: p.typeIndex,
      path: p.path.split('.'),
      len,
    }
    result.props[p.path] = prop
    result.main[prop.start] = prop
    s += len
  }

  for (const p of props) {
    const prop: PropDef = {
      prop: p.prop,
      separate: true,
      __isPropDef: true,
      validation: VALIDATION_MAP[p.typeIndex],
      start: 0,
      typeIndex: p.typeIndex,
      default: DEFAULT_MAP[p.typeIndex], // tmp
      path: p.path.split('.'),
      len: 0,
      compression: 1,
    }
    result.props[p.path] = prop
    result.reverseProps[prop.prop] = prop
  }

  // make this into a typeDef
  //   return {
  //     type: fields[0],
  //     fields,
  //     typeId,
  //     props,
  //     mainProps,
  //   }

  return result
}
