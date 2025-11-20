import {DbServer} from '../index.js'
import createDbHash from './dbHash.js'
import { SchemaTypeDef } from '@based/schema/def'

export const destructureTreeKey = (key: number) => [
  (key / 4294967296) | 0, // typeId
  (key >>> 31) * 2147483648 + (key & 0x7fffffff), // start_node_id
]

export const makeTreeKey = (typeId: number, start: number) =>
  typeId * 4294967296 + start

export const nodeId2Start = (blockCapacity: number, nodeId: number) =>
  ((nodeId - +!(nodeId % blockCapacity)) / blockCapacity) | 0

const nodeId2BlockI = (nodeId: number, blockCapacity: number) =>
  (nodeId - 1 - ((nodeId - 1) % blockCapacity)) / blockCapacity

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

/**
 * Block state.
 * Type and a node id range.
 */
export type Block = {
  /**
   * key = typeId + startNodeId
   * Made with makeTreeKey(t, i) and can be destructured with destructureTreeKey(k).
   */
  key: number
  /**
   * Last acquired hash of the block.
   * This is normally updated at load and save time but never during read/modify ops.
   */
  hash: Hash
  /**
   * If false the block is offloaded to fs;
   * true doesn't necessarily mean that the block still exists because it could have been deleted.
   */
  inmem: boolean
  /**
   * The block needs to be saved.
   */
  dirty: boolean
  /**
   * If set, the block is being loaded and it can be awaited with this promise.
   */
  loadPromise: null | Promise<void>
}

/**
 * Container for a whole type.
 */
type Type = {
  typeId: number /*!< typeId as in the schema. */
  blockCapacity: number /*!< Max number of nodes per block. */
  blocks: Block[]
}

/**
 * An object that keeps track of all blocks of nodes existing in the database.
 */
export class BlockMap {
  #types: { [key: number]: Type }
  #h = createDbHash()

  constructor(schemaTypesParsed: Record<string, SchemaTypeDef>) {
    this.#types = BlockMap.#makeTypes(schemaTypesParsed)
  }

  static #makeTypes(schemaTypesParsed: Record<string, SchemaTypeDef>): {
    [key: number]: Type
  } {
    return Object.preventExtensions(
      Object.keys(schemaTypesParsed)
        .sort(
          (a: string, b: string) =>
            schemaTypesParsed[a].id - schemaTypesParsed[b].id,
        )
        .reduce(
          (
            obj: { [key: number]: Type },
            key: string,
          ): { [key: number]: Type } => {
            const def = schemaTypesParsed[key]
            const typeId = def.id
            obj[typeId] = {
              typeId,
              blockCapacity: def.blockCapacity,
              blocks: [],
            }
            return obj
          },
          {},
        ),
    )
  }

  *types() {
    for (const k of Object.keys(this.#types)) {
      yield this.#types[k]
    }
  }

  *blocks(type: Type) {
    const { blocks } = type
    for (const block of blocks) {
      yield block
    }
  }

  updateDirtyBlocks(dirtyBlocks: Float64Array) {
    for (const key of dirtyBlocks) {
      this.getBlock(key).dirty = true
    }
  }

  foreachBlock(cb: (block: Block) => void): void {
    for (const k of Object.keys(this.#types)) {
      const { blocks } = this.#types[k]
      for (let block of blocks) {
        if (block) cb(block)
      }
    }
  }

  get isDirty() {
    let dirty = 0
    this.foreachBlock((block) => dirty |= ~~block.dirty)
    return !!dirty
  }

  /**
   * Execute cb() for each dirty block.
   * A dirty block is one that is changed in memory but not yet persisted in the
   * file system.
   */
  foreachDirtyBlock(
    db: DbServer,
    cb: (typeId: number, start: number, end: number, block: Block) => void,
  ) {
    const typeIdMap: { [key: number]: SchemaTypeDef } = {}
    for (const typeName in db.schemaTypesParsed) {
      const type = db.schemaTypesParsed[typeName]
      const typeId = type.id
      typeIdMap[typeId] = type
    }

    this.foreachBlock((block) => {
      if (block.dirty) {
        const [typeId, start] = destructureTreeKey(block.key)
        const end = start + typeIdMap[typeId].blockCapacity - 1
        cb(typeId, start, end, block)
      }
    })
  }

  get hash() {
    this.#h.reset()
    this.foreachBlock((block) => this.#h.update(block.hash))

    return this.#h.digest() as Uint8Array
  }

  update(key: number, hash: Hash, inmem: boolean = true) {
    const [typeId, start] = destructureTreeKey(key)
    const type = this.#types[typeId]
    if (!type) {
      throw new Error(`type ${typeId} not found`)
    }
    const blockI = nodeId2BlockI(start, type.blockCapacity)
    const block =
      type.blocks[blockI] ??
      (type.blocks[blockI] = Object.preventExtensions({
        key,
        hash,
        inmem,
        dirty: false,
        loadPromise: null,
      }))
    block.hash = hash
    block.inmem = inmem
  }

  remove(key: number) {
    const [typeId, start] = destructureTreeKey(key)
    const type = this.#types[typeId]
    if (!type) {
      throw new Error(`type ${typeId} not found`)
    }
    const blockI = nodeId2BlockI(start, type.blockCapacity)
    delete type.blocks[blockI]
  }

  static blockSdbFile(typeId: number, start: number, end: number) {
    return `${typeId}_${start}_${end}.sdb`
  }

  getBlock(key: number) {
    const [typeId, start] = destructureTreeKey(key)
    const type = this.#types[typeId]
    if (!type) {
      throw new Error(`type ${typeId} not found`)
    }
    const blockI = nodeId2BlockI(start, type.blockCapacity)
    return type.blocks[blockI]
  }

  getBlockFile(block: Block) {
    const [typeId, start] = destructureTreeKey(block.key)
    const type = this.#types[typeId]
    if (!type) {
      throw new Error(`type ${typeId} not found`)
    }
    const end = start + type.blockCapacity - 1
    return BlockMap.blockSdbFile(typeId, start, end)
  }

  updateTypes(schemaTypesParsed: Record<string, SchemaTypeDef>) {
    const oldTypes = this.#types
    const newTypes = BlockMap.#makeTypes(schemaTypesParsed)

    for (const k of Object.keys(oldTypes)) {
      const oldType = oldTypes[k]
      const newType = newTypes[k]

      if (newType) {
        newType.hash = oldType.hash
        newType.blocks = oldType.blocks
      }
    }

    this.#types = newTypes
  }
}
