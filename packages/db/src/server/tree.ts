import native from '../native.js'
import { DbServer } from './index.js'
import { SchemaTypeDef } from './schema/types.js'

export type CsmtNodeRange = {
  file: string
  typeId: number
  start: number
  end: number
}

export const makeCsmtKey = (typeId: number, start: number) =>
  typeId * 4294967296 + start

export const destructureCsmtKey = (key: number) => [
  (key / 4294967296) | 0,
  (key >>> 31) * 2147483648 + (key & 0x7fffffff),
]

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
  cb: (start: number, end: number, hash: Buffer) => void,
) {
  const step = def.blockCapacity
  for (let start = 1; start <= def.lastId; start += step) {
    const end = start + step - 1
    const hash = Buffer.allocUnsafe(16)
    native.getNodeRangeHash(def.id, start, end, hash, db.dbCtxExternal)
    cb(start, end, hash)
  }
}

export async function foreachDirtyBlock(
  db: DbServer,
  cb: (mtKey: number, typeId: number, start: number, end: number) => void,
) {
  const typeIdMap = {}
  for (const typeName in db.schemaTypesParsed) {
    const type = db.schemaTypesParsed[typeName]
    const typeId = type.id
    typeIdMap[typeId] = type
  }

  for (const mtKey of db.dirtyRanges) {
    const [typeId, start] = destructureCsmtKey(mtKey)
    const end = start + typeIdMap[typeId].blockCapacity - 1
    cb(mtKey, typeId, start, end)
  }
}
