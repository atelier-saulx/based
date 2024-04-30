import { BasedDb, FieldDef, SchemaTypeDef } from './index.js'
import dbZig from './db.js'
import { setByPath } from '@saulx/utils'

type Operation =
  | '='
  | 'has'
  | '<'
  | '>'
  | '!='
  | 'like'
  | '>='
  | '<='
  | 'exists'
  | '!exists'

// TIMESTAMP: 'now + 1w'

// TODO
// write down each operation
// use char codes in parsed schema
// type parsed schema

// const opToByte = {
//   string: {
//     '=': 2,
//   },
// }

// clean this up

const operationToByte = (op: Operation) => {
  if (op === '=') {
    return 1
  }
  // 2 is non fixed length check
  if (op === '>') {
    return 3
  }
  if (op === '<') {
    return 4
  }

  if (op === 'has') {
    return 7
  }
  return 0
}

export class Query {
  db: BasedDb
  type: SchemaTypeDef
  id: number | void
  conditions: Map<number, Buffer[]>
  offset: number
  limit: number
  includeFields: string[]
  totalConditionSize: number = 0
  constructor(db: BasedDb, target: string, previous?: Query) {
    this.db = db
    let typeDef = this.db.schemaTypesParsed[target]
    if (typeDef) {
      this.type = typeDef
    } else {
      // is ID check prefix
    }
  }

  filter(filter: [string, Operation, any]) {
    if (this.id) {
      // bla
    } else {
      const field = <FieldDef>this.type.tree[filter[0]]
      let fieldIndexChar = field.field
      let buf: Buffer

      if (field.seperate === true) {
        if (field.type === 'string') {
          const op = operationToByte(filter[1])
          if (op === 1) {
            const matches = Buffer.from(filter[2])
            buf = Buffer.allocUnsafe(3 + matches.byteLength)
            buf[0] = 2
            buf.writeInt16LE(matches.byteLength, 1)
            buf.set(matches, 3)
          } else if (op === 7) {
            // TODO MAKE HAS
          }
        } else if (field.type === 'references') {
          const op = operationToByte(filter[1])
          const matches = filter[2]
          const len = matches.length
          buf = Buffer.alloc(3 + len * 4)
          if (op === 1) {
            buf[0] = 2
            buf.writeInt16LE(len * 4, 1)
            for (let i = 0; i < len; i++) {
              buf.writeInt32LE(matches[i], i * 4 + 3)
            }
          } else if (op === 7) {
            buf[0] = op
            buf.writeInt16LE(len, 1)
            for (let i = 0; i < len; i++) {
              buf.writeInt32LE(matches[i], i * 4 + 3)
            }
          }
        }
      } else {
        if (field.type === 'integer') {
          const op = operationToByte(filter[1])
          if (op === 1 || op === 3 || op === 4) {
            buf = Buffer.alloc(9)
            buf[0] = op
            buf.writeInt16LE(4, 1)
            buf.writeInt16LE(field.start, 3)
            buf.writeInt32LE(filter[2], 5)
          }
        }
      }
      this.conditions ??= new Map()
      let arr = this.conditions.get(fieldIndexChar)
      if (!arr) {
        this.totalConditionSize += 3
        arr = []
        this.conditions.set(fieldIndexChar, arr)
      }
      this.totalConditionSize += buf.byteLength
      arr.push(buf)
      return this
    }
  }

  range(offset: number, limit: number): Query {
    this.offset = offset
    this.limit = limit
    return this
  }

  include(fields: string[]) {
    // step 1
    return this
  }

  get(): { items: number[]; total: number; offset: number; limit: number } {
    let includeBuffer: Buffer
    let len = 0

    if (!this.includeFields) {
      len = 1
      const fields = this.type.fields
      for (const f in fields) {
        const field = fields[f]
        if (field.seperate) {
          len++
        }
      }
      includeBuffer = Buffer.allocUnsafe(len)
      includeBuffer[0] = 0
      let i = 0
      for (const f in fields) {
        const field = fields[f]
        if (field.seperate) {
          i++
          includeBuffer[i] = field.field
        }
      }
    }

    if (this.conditions) {
      const conditions = Buffer.allocUnsafe(this.totalConditionSize)
      let lastWritten = 0
      this.conditions.forEach((v, k) => {
        conditions[lastWritten] = k
        let sizeIndex = lastWritten + 1
        lastWritten += 3
        let conditionSize = 0
        for (const condition of v) {
          conditionSize += condition.byteLength
          conditions.set(condition, lastWritten)
          lastWritten += condition.byteLength
        }
        conditions.writeInt16LE(conditionSize, sizeIndex)
      })

      const start = this.offset ?? 0
      const end = this.limit ?? 1e3

      console.log({
        conditions: new Uint8Array(conditions),
        include: new Uint8Array(includeBuffer),
      })

      const result: Buffer = this.db.native.getQuery(
        conditions,
        this.type.prefixString,
        this.type.lastId,
        start,
        end, // def 1k ?
        includeBuffer
      )

      // will be actual results!

      // const arr = new Array(result.byteLength / 4)

      const arr = []
      let lastTarget
      // console.log(new Uint8Array(result))
      let i = 0
      while (i < result.byteLength) {
        // read
        const index = result[i]
        i++

        // read from tree
        if (index === 255) {
          lastTarget = {
            // last id is what we want...
            id: result.readUint32LE(i),
          }
          arr.push(lastTarget)

          i += 4
        } else if (index === 0) {
          for (const f in this.type.fields) {
            const field = this.type.fields[f]
            if (!field.seperate) {
              if (field.type === 'integer' || field.type === 'reference') {
                setByPath(
                  lastTarget,
                  field.path,
                  result.readUint32LE(i + field.start)
                )
              } else if (field.type === 'number') {
                setByPath(
                  lastTarget,
                  field.path,
                  result.readFloatLE(i + field.start)
                )
              }
            }
          }
          i += this.type.mainLen
        } else {
          // lets go

          const size = result.readUInt16LE(i)
          i += 2

          for (const f in this.type.fields) {
            const field = this.type.fields[f]
            if (field.seperate) {
              if (field.field === index) {
                if (field.type === 'string') {
                  setByPath(
                    lastTarget,
                    field.path,
                    result.toString('utf8', i, size + i)
                  )
                } else if (field.type === 'references') {
                  const x = new Array(size / 4)
                  for (let j = i; j < size / 4; j += 4) {
                    x[j / 4] = result.readUint32LE(j)
                  }
                  setByPath(lastTarget, field.path, x)
                }
                break
              }
            }
          }

          // lullz
          i += size
        }
      }

      return {
        items: arr,
        total: this.type.total,
        offset: start,
        limit: end,
      }
    } else {
    }
  }

  subscribe(fn: (value: any, checksum: number, err: Error) => void) {
    console.log('hello sub')
    // sub will all wil fire on any field
    // maybe start with this?
    // this is also where we will create diffs
    // idea use  PROXY object as a view to the buffer
  }
}

export const query = (db: BasedDb, target: string) => new Query(db, target)
