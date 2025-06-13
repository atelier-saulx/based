import native from '../native.js'
import createDbHash from './dbHash.js'
import { DbServer } from './index.js'
import { SchemaTypeDef } from '@based/schema/def'

export const destructureTreeKey = (key: number) => [
  (key / 4294967296) | 0, // typeId
  (key >>> 31) * 2147483648 + (key & 0x7fffffff), // start_node_id
]

export const makeTreeKey = (typeId: number, start: number) =>
  typeId * 4294967296 + start

export const nodeId2Start = (blockCapacity: number, nodeId: number) =>
  ((nodeId - +!(nodeId % blockCapacity)) / blockCapacity) | 0

const nodeId2BlockI = (nodeId: number, blockCapacity: number) => ((nodeId - 1) - ((nodeId - 1) % blockCapacity)) / blockCapacity

export const makeTreeKeyFromNodeId = (
  typeId: number,
  blockCapacity: number,
  nodeId: number,
) => {
  const tmp = nodeId - +!(nodeId % blockCapacity)
  return typeId * 4294967296 + ((tmp / blockCapacity) | 0) * blockCapacity + 1
}

type Hash = Uint8Array
const HASH_SIZE = 16

type VerifBlock = {
  key: number,
  hash: Hash,
  //file: string,
}

type VerifType = {
  typeId: number,
  blockCapacity: number,
  def: SchemaTypeDef,
  hash: Hash,
  blocks: VerifBlock[],
}

export type VerifTree = {
  types: { [key: number]: VerifType },
  foreach: (cb: (block: VerifBlock, typeDef?: SchemaTypeDef) => void) => void,
  hash: () => Hash,
  update: (key: number, hash: Hash) => void,
  remove: (key: number) => void,
  updateTypes: (schemaTypesParsed: Record<string, SchemaTypeDef>) => void,
}

function makeTypes(schemaTypesParsed: Record<string, SchemaTypeDef>): VerifTree['types'] {
  return Object.preventExtensions(Object.keys(schemaTypesParsed)
    .sort((a, b) => schemaTypesParsed[a].id - schemaTypesParsed[b].id)
    .reduce((obj, key) => {
      const def = schemaTypesParsed[key]
      const typeId = def.id
      obj[typeId] = {
        typeId,
        blockCapacity: def.blockCapacity,
        def,
        hash: new Uint8Array(HASH_SIZE),
        blocks: [],
      }
      return obj
    }, {}))
}

export function createVerifTree(schemaTypesParsed: Record<string, SchemaTypeDef>): VerifTree {
  const h = createDbHash()
  let types = makeTypes(schemaTypesParsed)

  const foreach = (cb: (block: VerifBlock, typeDef?: SchemaTypeDef) => void) => {
    for (const k of Object.keys(types)) {
      const { blocks, def } = types[k]
        for (let block of blocks) {
          if (block) cb(block, def)
        }
    }
  }

  return Object.preventExtensions({
    types,
    foreach,
    hash: () => {
      h.reset()
      foreach((block) => h.update(block.hash))

      return h.digest() as Uint8Array
    },
    update: (key: number, hash: Hash) => {
      const [typeId, start] = destructureTreeKey(key)
      const type = types[typeId]
      if (!type) {
        throw new Error(`type ${typeId} not found`)
      }
      const blockI = nodeId2BlockI(start, type.blockCapacity)
      const block = type.blocks[blockI] ?? (type.blocks[blockI] = Object.preventExtensions({ key, hash }))
      block.hash = hash
    },
    remove: (key: number) => {
      const [typeId, start] = destructureTreeKey(key)
      const type = types[typeId]
      if (!type) {
        throw new Error(`type ${typeId} not found`)
      }
      const blockI = nodeId2BlockI(start, type.blockCapacity)
      delete type.blocks[blockI]
    },
    updateTypes: (schemaTypesParsed: Parameters<typeof createVerifTree>[0]) => {
      const oldTypes = types
      types = makeTypes(schemaTypesParsed)

      for (const k of Object.keys(oldTypes)) {
        const oldType = oldTypes[k]
        const newType = types[k]

        if (newType) {
          newType.hash = oldType.hash
          newType.blocks = oldType.blocks
        }
      }
    }
  })
}

export function foreachBlock(
  db: DbServer,
  def: SchemaTypeDef,
  cb: (start: number, end: number, hash: Uint8Array) => void,
  includeEmptyBlocks: boolean = false
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
    if (res || includeEmptyBlocks) {
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
    const [aTypeId, aStart] = destructureTreeKey(a)
    const [bTypeId, bStart] = destructureTreeKey(b)
    const aId = typeIdMap[aTypeId].id
    const bId = typeIdMap[bTypeId].id
    const td = aId - bId
    if (td != 0) return td
    return aStart - bStart
  })

  for (const mtKey of dirty) {
    const [typeId, start] = destructureTreeKey(mtKey)
    const end = start + typeIdMap[typeId].blockCapacity - 1
    cb(mtKey, typeId, start, end)
  }
}
