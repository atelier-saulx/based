import {
  convertToTimestamp,
  ENCODER,
  writeDoubleLE,
  writeUint16,
  writeUint32,
  writeUint64,
} from '@based/utils'
import { NOT_COMPRESSED } from '@based/protocol'
import native from '../native.js'
import { typeIndexMap, type LeafDef, type TypeDef } from '@based/schema'
import { BLOCK_CAPACITY_DEFAULT } from '../types.js'

const selvaFieldType: Readonly<Record<string, number>> = {
  NULL: 0,
  MICRO_BUFFER: 1,
  STRING: 2,
  TEXT: 3,
  REFERENCE: 4,
  REFERENCES: 5,
  ALIAS: 8,
  // ALIASES: 9,
  COLVEC: 10,
}

const selvaTypeMap = new Uint8Array(32) // 1.2x faster than JS array
selvaTypeMap[typeIndexMap.microbuffer] = selvaFieldType.MICRO_BUFFER
selvaTypeMap[typeIndexMap.vector] = selvaFieldType.MICRO_BUFFER
selvaTypeMap[typeIndexMap.binary] = selvaFieldType.STRING
selvaTypeMap[typeIndexMap.cardinality] = selvaFieldType.STRING
selvaTypeMap[typeIndexMap.json] = selvaFieldType.STRING
selvaTypeMap[typeIndexMap.string] = selvaFieldType.STRING
selvaTypeMap[typeIndexMap.text] = selvaFieldType.TEXT
selvaTypeMap[typeIndexMap.reference] = selvaFieldType.REFERENCE
selvaTypeMap[typeIndexMap.references] = selvaFieldType.REFERENCES
selvaTypeMap[typeIndexMap.alias] = selvaFieldType.ALIAS
// selvaTypeMap[ALIASES] = selvaFieldType.ALIASES
selvaTypeMap[typeIndexMap.colvec] = selvaFieldType.COLVEC

const EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT = 0x01

function blockCapacity(blockCapacity: number): Uint8Array {
  const buf = new Uint8Array(Uint32Array.BYTES_PER_ELEMENT)
  const view = new DataView(buf.buffer)
  view.setUint32(0, blockCapacity, true)
  return buf
}

function sepPropCount(props: LeafDef[]): number {
  return props.filter((prop) => !('main' in prop)).length
}

function makeEdgeConstraintFlags(prop: LeafDef): number {
  let flags = 0

  flags |=
    'dependent' in prop && prop.dependent
      ? EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT
      : 0x00

  return flags
}

const microBuffer = (mainBuf?: Uint8Array) => {
  const buf = new Uint8Array(4)
  const view = new DataView(buf.buffer)
  buf[0] = selvaFieldType.MICRO_BUFFER
  view.setUint16(1, mainBuf.byteLength, true)
  buf[3] = 1 // has default
  return [...buf, ...mainBuf]
}

const propDefBuffer = (prop: LeafDef): number[] => {
  const selvaType = selvaTypeMap[prop.typeIndex]

  if (prop.type === 'vector') {
    const buf = new Uint8Array(4)
    const view = new DataView(buf.buffer)
    buf[0] = selvaType
    view.setUint16(1, prop.size * prop.baseSize, true)
    buf[3] = 0 // has no default
    return [...buf]
  }

  if (prop.type === 'colvec') {
    const buf = new Uint8Array(5)
    const view = new DataView(buf.buffer)
    buf[0] = selvaType
    view.setUint16(1, prop.size, true) // elements
    view.setUint16(3, prop.baseSize, true) // element size
    return [...buf]
  }

  if ('target' in prop) {
    const buf = new Uint8Array(11)
    const view = new DataView(buf.buffer)
    const dstType = prop.target.typeDef

    buf[0] = selvaType // field type
    buf[1] = makeEdgeConstraintFlags(prop) // flags
    view.setUint16(2, dstType.id, true) // dst_node_type
    buf[4] = prop.target.id // inverse_field
    view.setUint16(5, prop.edgesDef?.id ?? 0, true) // edge_node_type
    view.setUint32(7, prop.typeDef.capped ?? 0, true)

    return [...buf]
  }

  if (
    prop.type === 'string' ||
    prop.type === 'binary' ||
    prop.type === 'cardinality' ||
    prop.type === 'json'
  ) {
    if ('main' in prop && prop.main.size < 50) {
      return [selvaType, prop.main.size]
    }
    return [selvaType, 0]
  }

  return [selvaType]
}

// TODO rewrite
export function schemaToSelvaBuffer(schema: {
  [key: string]: TypeDef
}): ArrayBuffer[] {
  return Object.values(schema).map((t) => {
    const props = Object.values(t.dbProps)
    const rest: LeafDef[] = []
    const nrFields = 1 + sepPropCount(props)
    let refFields = 0
    let virtualFields = 0

    if (nrFields >= 251) {
      throw new Error('Too many fields')
    }

    const mainBuf = new Uint8Array(Math.min(1, t.size))
    for (const prop of props) {
      if ('main' in prop) {
        if ('default' in prop && prop.default) {
          switch (prop.type) {
            case 'int8':
            case 'uint8':
            case 'boolean':
              mainBuf[prop.main.start] = Number(prop.default)
              break
            case 'enum':
              mainBuf[prop.main.start] = prop.enumMap[prop.default]
              break
            case 'int16':
            case 'uint16':
              writeUint16(mainBuf, prop.default, prop.main.start)
              break
            case 'int32':
            case 'uint32':
              writeUint32(mainBuf, prop.default, prop.main.start)
              break
            case 'number':
              writeDoubleLE(mainBuf, prop.default, prop.main.start)
              break
            case 'timestamp':
              writeUint64(
                mainBuf,
                convertToTimestamp(prop.default),
                prop.main.start,
              )
              break
            case 'binary':
            case 'string':
              if (prop.default instanceof Uint8Array) {
                mainBuf.set(prop.default, prop.main.start)
              } else {
                const value = prop.default.normalize('NFKD')
                mainBuf[prop.main.start] = 0 // lang
                mainBuf[prop.main.start + 1] = NOT_COMPRESSED
                const { written: l } = ENCODER.encodeInto(
                  value,
                  mainBuf.subarray(prop.main.start + 2),
                )
                let crc = native.crc32(
                  mainBuf.subarray(
                    prop.main.start + 2,
                    prop.main.start + 2 + l,
                  ),
                )
                writeUint32(mainBuf, crc, prop.main.start + 2 + l)
              }
              break
          }
        }
      } else {
        if (prop.type === 'reference' || prop.type === 'references') {
          refFields++
        } else if (prop.type === 'alias' || prop.type === 'colvec') {
          // We assume that these are always the last props!
          virtualFields++
        }
        rest.push(prop)
      }
    }

    rest.sort((a, b) => a.id - b.id)
    return Uint8Array.from([
      ...blockCapacity(t.blockCapacity || BLOCK_CAPACITY_DEFAULT), // u32 blockCapacity
      nrFields, // u8 nrFields
      1 + refFields, // u8 nrFixedFields
      virtualFields, // u8 nrVirtualFields
      7, // u8 version (generally follows the sdb version)
      ...microBuffer(mainBuf),
      ...rest.map((f) => propDefBuffer(f)).flat(1),
    ]).buffer
  })
}
