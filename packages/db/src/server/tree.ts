import native from '../native.js'
import { createTree } from './csmt/tree.js'
import { DbServer } from './index.js'
import { SchemaTypeDef } from '@based/schema/def'

export type CsmtNodeRange = {
  file: string
  typeId: number
  start: number
  end: number
}

// This is a special start id set for every type to somewhat lock the order of the csmt.
// While the id is valid, it's never a true start id of a block.
export const specialBlock = 2147483647

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

export function initCsmt(db: DbServer) {
  const types = Object.keys(db.schemaTypesParsed)
    .sort((a, b) => db.schemaTypesParsed[a].id - db.schemaTypesParsed[b].id)
    .reduce((obj, key) => {
      obj[key] = db.schemaTypesParsed[key]
      return obj
    }, {})

  db.merkleTree = createTree(db.createCsmtHashFun)

  // Insert specialBlocks for types.
  // This should ensure that the insertion order of the actual node ranges is
  // always deterministic.
  for (const key in types) {
    const { id: typeId } = types[key]
    const data: CsmtNodeRange = {
      file: '',
      typeId: typeId,
      start: 0,
      end: 0,
    }
    try {
      db.merkleTree.insert(
        makeCsmtKey(typeId, specialBlock),
        db.merkleTree.emptyHash,
        data,
      )
    } catch (_) {}
  }

  return types
}

export function foreachBlock(
  db: DbServer,
  def: SchemaTypeDef,
  cb: (start: number, end: number, hash: Uint8Array) => void,
) {
  const step = def.blockCapacity
  for (let start = 1; start <= def.lastId; start += step) {
    const end = start + step - 1
    const hash = new Uint8Array(16)
    const res = native.getNodeRangeHash(
      def.id,
      start,
      end,
      hash,
      db.dbCtxExternal,
    )
    if (res) {
      cb(start, end, hash)
    }
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
