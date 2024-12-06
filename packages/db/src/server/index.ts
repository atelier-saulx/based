import { hashObjectIgnoreKeyOrder, stringHash } from '@saulx/hash'
import native from '../native.js'
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse, Schema } from '@based/schema'
import { SchemaTypeDef } from './schema/types.js'
import { genId } from './schema/utils.js'
import { createSchemaTypeDef } from './schema/typeDef.js'
import { schemaToSelvaBuffer } from './schema/selvaBuffer.js'
import { createTree } from './csmt/index.js'

const SCHEMA_FILE = 'schema.json'
const WRITELOG_FILE = 'writelog.json'
const COMMON_SDB_FILE = 'common.sdb'
const DEFAULT_BLOCK_CAPACITY = 100_000

type Writelog = {
  ts: number
  types: { [t: number]: { lastId: number; blockCapacity: number } }
  hash?: string
  commonDump: string
  rangeDumps: {
    [t: number]: {
      // TODO add type
      file: string
      hash: string
      start: number
      end: number
    }[]
  }
}

type CsmtNodeRange = {
  file: string
  typeId: number
  start: number
  end: number
}

const makeCsmtKey = (typeId: number, start: number) =>
  typeId * 4294967296 + start
const destructureCsmtKey = (key: number) => [
  (key / 4294967296) | 0,
  (key >>> 31) * 2147483648 + (key & 0x7fffffff),
]
const makeCsmtKeyFromNodeId = (
  typeId: number,
  blockCapacity: number,
  nodeId: number,
) => {
  const tmp = nodeId - +!(nodeId % blockCapacity)
  return typeId * 4294967296 + ((tmp / blockCapacity) | 0) * blockCapacity + 1
}
const block_sdb_file = (typeId: number, start: number, end: number) =>
  `${typeId}_${start}_${end}.sdb`

export class DbServer {
  modifyBuf: SharedArrayBuffer
  dbCtxExternal: any
  schema: Schema & { lastId: number } = { lastId: 0, types: {} }
  schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}
  fileSystemPath: string
  maxModifySize: number
  merkleTree: ReturnType<typeof createTree>

  dirtyRanges = new Set<number>()
  private csmtHashFun = native.createHash()
  private createCsmtHashFun = () => {
    // We can just reuse it as long as we only have one tree.
    this.csmtHashFun.reset()
    return this.csmtHashFun
  }

  constructor({
    path,
    maxModifySize = 100 * 1e3 * 1e3,
  }: {
    path: string
    maxModifySize?: number
  }) {
    this.maxModifySize = maxModifySize
    this.fileSystemPath = path
  }

  async start({ clean }: { clean?: boolean }) {
    const path = this.fileSystemPath
    const id = stringHash(path) >>> 0
    const noop = () => {}

    if (clean) {
      await rm(path, { recursive: true, force: true }).catch(noop)
    }

    await mkdir(path, { recursive: true }).catch(noop)

    // not doing this yet
    // this.modifyBuf = new SharedArrayBuffer(this.maxModifySize)
    this.dbCtxExternal = native.start(path, false, id)

    let writelog: Writelog = null
    try {
      writelog = JSON.parse(
        (await readFile(join(path, WRITELOG_FILE))).toString(),
      )

      // Load the common dump
      native.loadCommon(join(path, writelog.commonDump), this.dbCtxExternal)

      // Load all range dumps
      for (const typeId in writelog.rangeDumps) {
        const dumps = writelog.rangeDumps[typeId]
        for (const dump of dumps) {
          const fname = dump.file
          const err = native.loadRange(join(path, fname), this.dbCtxExternal)
          if (err) {
            console.log(`Failed to load a range. file: "${fname}": ${err}`)
          }
        }
      }

      const schema = await readFile(join(path, SCHEMA_FILE))
      if (schema) {
        // Prop need to not call setting in selva
        this.putSchema(JSON.parse(schema.toString()), true)
      }
    } catch (err) {}

    // The merkle tree should be empty at start.
    if (!this.merkleTree || this.merkleTree.getRoot()) {
      this.merkleTree = createTree(this.createCsmtHashFun)
    }

    for (const key in this.schemaTypesParsed) {
      const def = this.schemaTypesParsed[key]
      const [total, lastId] = native.getTypeInfo(def.id, this.dbCtxExternal)

      def.total = total
      def.lastId = writelog?.types[def.id].lastId || lastId
      def.blockCapacity =
        writelog?.types[def.id].blockCapacity || DEFAULT_BLOCK_CAPACITY

      this.foreachBlock(def, (start, end, hash) => {
        //console.log(`load range ${def.id}:${start}-${end} hash:`, hash)

        const mtKey = makeCsmtKey(def.id, start)
        const file: string =
          writelog.rangeDumps[def.id].find((v) => v.start === start)?.file || ''
        const data: CsmtNodeRange = {
          file,
          typeId: def.id,
          start,
          end,
        }
        this.merkleTree.insert(mtKey, hash, data)
      })
    }

    if (writelog?.hash) {
      const oldHash = Buffer.from(writelog.hash, 'hex')
      const newHash = this.merkleTree.getRoot()?.hash
      if (!oldHash.equals(newHash)) {
        console.error(
          `WARN: CSMT hash mismatch: ${writelog.hash} != ${newHash.toString('hex')}`,
        )
      }
    }
  }

  private foreachBlock(
    def: SchemaTypeDef,
    cb: (start: number, end: number, hash: Buffer) => void,
  ) {
    const step = def.blockCapacity
    for (let start = 1; start <= def.lastId; start += step) {
      const end = start + step - 1
      const hash = Buffer.allocUnsafe(16)
      native.getNodeRangeHash(def.id, start, end, hash, this.dbCtxExternal)
      cb(start, end, hash)
    }
  }

  private foreachDirtyBlock(
    cb: (mtKey: number, typeId: number, start: number, end: number) => void,
  ) {
    const typeIdMap = {}
    for (const typeName in this.schemaTypesParsed) {
      const type = this.schemaTypesParsed[typeName]
      const typeId = type.id
      typeIdMap[typeId] = type
    }

    for (const mtKey of this.dirtyRanges) {
      const [typeId, start] = destructureCsmtKey(mtKey)
      const end = start + typeIdMap[typeId].blockCapacity - 1
      cb(mtKey, typeId, start, end)
    }
  }

  updateMerkleTree(): void {
    this.foreachDirtyBlock((mtKey, typeId, start, end) => {
      const oldLeaf = this.merkleTree.search(mtKey)
      const hash = Buffer.allocUnsafe(16)
      native.getNodeRangeHash(typeId, start, end, hash, this.dbCtxExternal)

      if (oldLeaf) {
        if (oldLeaf.hash.equals(hash)) {
          return
        }
        try {
          this.merkleTree.delete(mtKey)
        } catch (err) {}
      }

      const data: CsmtNodeRange = {
        file: '', // not saved yet
        typeId,
        start,
        end,
      }
      this.merkleTree.insert(mtKey, hash, data)
    })
  }

  markNodeDirty(schema: SchemaTypeDef, nodeId: number): void {
    this.dirtyRanges.add(
      makeCsmtKeyFromNodeId(schema.id, schema.blockCapacity, nodeId),
    )
  }

  putSchema(schema: Schema, fromStart: boolean = false): Schema {
    if (!fromStart) {
      parse(schema)
    }

    const { lastId } = this.schema
    this.schema = {
      lastId,
      ...schema,
    }

    this.updateTypeDefs()

    if (!fromStart) {
      writeFile(
        join(this.fileSystemPath, SCHEMA_FILE),
        JSON.stringify(this.schema),
      ).catch((err) => console.error(SCHEMA_FILE, err))
      let types = Object.keys(this.schemaTypesParsed)
      const s = schemaToSelvaBuffer(this.schemaTypesParsed)
      for (let i = 0; i < s.length; i++) {
        //  TYPE SELVA user Uint8Array(6) [ 1, 17, 23, 0, 11, 0 ]
        const type = this.schemaTypesParsed[types[i]]
        // TODO should not crash!
        try {
          native.updateSchemaType(type.id, s[i], this.dbCtxExternal)
        } catch (err) {
          console.error('Cannot update schema on selva', type.type, err, s[i])
        }
      }
    }

    return this.schema
  }

  updateTypeDefs() {
    for (const field in this.schema.types) {
      const type = this.schema.types[field]
      if (
        this.schemaTypesParsed[field] &&
        this.schemaTypesParsed[field].checksum ===
          hashObjectIgnoreKeyOrder(type) // bit weird..
      ) {
        continue
      } else {
        if (!type.id) {
          type.id = genId(this)
        }
        const def = createSchemaTypeDef(field, type, this.schemaTypesParsed)
        def.blockCapacity = DEFAULT_BLOCK_CAPACITY // TODO This should come from somewhere else
        this.schemaTypesParsed[field] = def
      }
    }
  }

  modify(buf: Buffer) {
    return native.modify(buf, this.dbCtxExternal)
  }
  getQueryBuf(buf: Buffer) {
    return native.getQueryBuf(buf, this.dbCtxExternal)
  }

  async save() {
    let err: number
    const ts = Date.now()

    err = native.saveCommon(
      join(this.fileSystemPath, COMMON_SDB_FILE),
      this.dbCtxExternal,
    )
    if (err) {
      console.error(`Save common failed: ${err}`)
    }

    this.foreachDirtyBlock((mtKey, typeId, start, end) => {
      const file = block_sdb_file(typeId, start, end)
      const path = join(this.fileSystemPath, file)
      const hash = Buffer.allocUnsafe(16)
      err = native.saveRange(path, typeId, start, end, this.dbCtxExternal, hash)
      if (err) {
        console.error(`Save ${typeId}:${start}-${end} failed: ${err}`)
        return // TODO What to do with the merkle tree in this situation?
      }

      const data: CsmtNodeRange = {
        file,
        typeId,
        start,
        end,
      }
      try {
        this.merkleTree.delete(mtKey)
      } catch (err) {}
      this.merkleTree.insert(mtKey, hash, data)
    })
    this.dirtyRanges.clear()

    const types: Writelog['types'] = {}
    for (const key in this.schemaTypesParsed) {
      const def = this.schemaTypesParsed[key]
      types[def.id] = { lastId: def.lastId, blockCapacity: def.blockCapacity }
    }

    const dumps: Writelog['rangeDumps'] = {}
    for (const key in this.schemaTypesParsed) {
      const def = this.schemaTypesParsed[key]
      dumps[def.id] = []
    }
    this.merkleTree.visitLeafNodes((leaf) => {
      const [typeId] = destructureCsmtKey(leaf.key)
      const data: CsmtNodeRange = leaf.data
      dumps[typeId].push({ ...data, hash: leaf.hash.toString('hex') })
    })

    const data: Writelog = {
      ts,
      types,
      commonDump: COMMON_SDB_FILE,
      rangeDumps: dumps,
    }
    const mtRoot = this.merkleTree.getRoot()
    if (mtRoot) {
      data.hash = mtRoot.hash.toString('hex')
    }
    await writeFile(
      join(this.fileSystemPath, WRITELOG_FILE),
      JSON.stringify(data),
    )
  }

  async stop(noSave?: boolean) {
    if (!noSave) {
      await this.save()
    }
    native.stop(this.dbCtxExternal)
  }

  async destroy() {
    await native.stop(true)
    await rm(this.fileSystemPath, { recursive: true }).catch((err) =>
      console.warn('Error removing dump folder', err.message),
    )
  }
}
