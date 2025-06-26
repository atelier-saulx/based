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

export const nodeId2BlockI = (nodeId: number, blockCapacity: number) => ((nodeId - 1) - ((nodeId - 1) % blockCapacity)) / blockCapacity

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

export type VerifBlock = {
  key: number,
  hash: Hash,
  inmem: boolean,
}

type VerifType = {
  typeId: number,
  blockCapacity: number,
  hash: Hash,
  blocks: VerifBlock[],
}

export class VerifTree {
  #types: { [key: number]: VerifType }
  #h = createDbHash()

  constructor(schemaTypesParsed: Record<string, SchemaTypeDef>) {
    this.#types = VerifTree.#makeTypes(schemaTypesParsed)
  }

  static #makeTypes(schemaTypesParsed: Record<string, SchemaTypeDef>): { [key: number]: VerifType }  {
    return Object.preventExtensions(Object.keys(schemaTypesParsed)
      .sort((a, b) => schemaTypesParsed[a].id - schemaTypesParsed[b].id)
      .reduce((obj, key) => {
        const def = schemaTypesParsed[key]
        const typeId = def.id
        obj[typeId] = {
          typeId,
          blockCapacity: def.blockCapacity,
          hash: new Uint8Array(HASH_SIZE),
          blocks: [],
        }
        return obj
      }, {}))
  }

  *types() {
    for (const k of Object.keys(this.#types)) {
      yield this.#types[k]
    }
  }

  foreachBlock(cb: (block: VerifBlock) => void): void {
    for (const k of Object.keys(this.#types)) {
      const { blocks } = this.#types[k]
      for (let block of blocks) {
        if (block) cb(block)
      }
    }
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
    const block = type.blocks[blockI] ?? (type.blocks[blockI] = Object.preventExtensions({ key, hash, inmem }))
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

  getBlockFile(block: VerifBlock) {
    const [typeId, start] = destructureTreeKey(block.key)
    const type = this.#types[typeId]
    if (!type) {
      throw new Error(`type ${typeId} not found`)
    }
    const end = start + type.blockCapacity - 1
    return VerifTree.blockSdbFile(typeId, start, end)
  }

  updateTypes(schemaTypesParsed: Record<string, SchemaTypeDef>) {
    const oldTypes = this.#types
    const newTypes = VerifTree.#makeTypes(schemaTypesParsed)

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
