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

export type BlockHash = Uint8Array
export const BLOCK_HASH_SIZE = 16

/**
 * The states imply:
 * - 'inmem' = 'fs' | 'inmem'.
 * - 'dirty' = 'fs' | 'inmem' & 'dirty'
 */
export type BlockStatus = 'fs' | 'inmem' | 'dirty'

type IoPromise = null | ReturnType<typeof Promise.withResolvers<void>>

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
  hash: BlockHash
  status: BlockStatus
  /**
   * If set, the block is being loaded and it can be awaited with this promise.
   */
  ioPromise: IoPromise
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

  setDirtyBlocks(dirtyBlocks: Float64Array) {
    for (const key of dirtyBlocks) {
      this.updateBlock(key, new Uint8Array(BLOCK_HASH_SIZE), 'dirty')
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
    this.foreachBlock((block) => (dirty |= ~~(block.status === 'dirty')))
    return !!dirty
  }

  /**
   * Execute cb() for each dirty block.
   * A dirty block is one that is changed in memory but not yet persisted in the
   * file system.
   */
  foreachDirtyBlock(
    cb: (typeId: number, start: number, end: number, block: Block) => void,
  ) {
    this.foreachBlock((block) => {
      if (block.status === 'dirty') {
        const [typeId, start] = destructureTreeKey(block.key)
        const t = this.#types[typeId]
        const end = start + t.blockCapacity - 1
        cb(typeId, start, end, block)
      }
    })
  }

  get hash() {
    this.#h.reset()
    this.foreachBlock((block) => this.#h.update(block.hash))

    return this.#h.digest() as Uint8Array
  }

  updateBlock(
    key: number,
    hash: BlockHash,
    status: BlockStatus = 'inmem',
  ): Block {
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
        status,
        ioPromise: null,
      }))
    block.hash = hash
    block.status = status

    return block
  }

  removeBlock(key: number) {
    const [typeId, start] = destructureTreeKey(key)
    const type = this.#types[typeId]
    if (!type) {
      throw new Error(`type ${typeId} not found`)
    }
    const blockI = nodeId2BlockI(start, type.blockCapacity)
    if (type.blocks[blockI]) {
      const block = type.blocks[blockI]
      block.ioPromise?.resolve(undefined) // Assume we can just resolve it
    }
    delete type.blocks[blockI]
  }

  static blockSdbFile(typeId: number, start: number, end: number) {
    return `${typeId}_${start}_${end}.sdb`
  }

  static setIoPromise(block: Block): Promise<void> {
    const p = (block.ioPromise = Promise.withResolvers<void>())
    p.promise.then(() => (block.ioPromise = null))
    return p.promise
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
