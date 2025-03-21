import native from '../native.js'
import { DbServer } from './index.js'
import { SchemaTypeDef } from '@based/schema/def'

export type CsmtNodeRange = {
  file: string
  typeId: number
  start: number
  end: number
}

export const destructureCsmtKey = (key: number) => [
  (key / 4294967296) | 0, // typeId
  (key >>> 31) * 2147483648 + (key & 0x7fffffff), // start_node_id
]

export const makeCsmtKey = (typeId: number, start: number) =>
  typeId * 4294967296 + start

export const makeCsmtKeyFromNodeId = (
  typeId: number,
  blockCapacity: number,
  nodeId: number,
) => {
  const tmp = nodeId - +!(nodeId % blockCapacity)
  return typeId * 4294967296 + ((tmp / blockCapacity) | 0) * blockCapacity + 1
}

export async function foreachBlock(
  db: DbServer,
  def: SchemaTypeDef,
  cb: (start: number, end: number, hash: Uint8Array) => void,
) {
  const step = def.blockCapacity
  for (let start = 1; start <= def.lastId; start += step) {
    const end = start + step - 1
    const hash = new Uint8Array(16)
    native.getNodeRangeHash(def.id, start, end, hash, db.dbCtxExternal)
    cb(start, end, hash)
  }
}

export async function foreachDirtyBlock(
  db: DbServer,
  cb: (mtKey: number, typeId: number, start: number, end: number) => void,
) {
  const typeIdMap: { [key: number]: SchemaTypeDef } = {}
  for (const typeName in db.schemaTypesParsed) {
    const type = db.schemaTypesParsed[typeName]
    const typeId = type.id
    typeIdMap[typeId] = type
  }

  // FDN-791 CSMT is unstable (not history independent)
  // For now we just sort the dirty data by type and start
  // to make the insertion order more deterministic.
  // This doesn't solve the issue completely because
  // we might mess the order later with updates.
  const dirty = [...db.dirtyRanges].sort((a, b) => {
    const [aTypeId, aStart] = destructureCsmtKey(a)
    const [bTypeId, bStart] = destructureCsmtKey(b)
    const aId = typeIdMap[aTypeId].id
    const bId = typeIdMap[bTypeId].id
    const td = aId - bId
    if (td != 0) return td
    return aStart - bStart
  })

  for (const mtKey of dirty) {
    const [typeId, start] = destructureCsmtKey(mtKey)
    const end = start + typeIdMap[typeId].blockCapacity - 1
    cb(mtKey, typeId, start, end)
  }
}
