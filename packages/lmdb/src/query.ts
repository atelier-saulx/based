import { BasedDb, FieldDef, SchemaTypeDef, getDbiHandler } from './index.js'
import dbZig from './db.js'

type Operation = '=' | 'has'

/*
-> 0 next field -> FIELD
// -> base 62
-> 1 =
-> 2 !=
-> 3 >
-> 4 <
-> 5 refCheck (get id + field after) -> FIELD
-> 6 go back to previous id (start next operation)
// can also look like 6 -> 6 (2 back)
———————————————
-> 7 has [len][len] x4 HAS  // 0,2,3
———————————————
-> 8 exist 
-> 9 !exist
———————————————
// ————— number
// boolean 0|1
// int default 0
// enum default 0 (undefined)
// number + timestamp 1 extra byte for extra info e.g. undefined
*/

const operationToByte = (op: Operation) => {
  if (op === '=') {
    return 1
  }
  if (op === 'has') {
    return 7
  }
  return 0
}

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export class Query {
  db: BasedDb
  type: SchemaTypeDef
  id: number | void
  conditions: Buffer[]
  constructor(db: BasedDb, target: string) {
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
    } else {
      const field = <FieldDef>this.type.dbMap.tree[filter[0]]

      if (field.seperate === true) {
        if (field.type === 'references') {
          const op = operationToByte(filter[1])
          let buf: Buffer

          if (op === 7) {
            // 1 byte [operation] (= 1)
            // 2 bytes [size of filter]
            // 2 bytes [index to read]
            // 4 bytes [equal integer]

            const matches = filter[2]
            const len = matches.length
            buf = Buffer.alloc(5 + len * 4)
            buf[0] = 0
            buf[1] = CHARS[field.index % 62].charCodeAt(0)
            buf[2] = op
            buf.writeInt16LE(len, 3)
            for (let i = 0; i < len; i++) {
              buf.writeInt32LE(matches[i], i * 4 + 5)
            }
          }

          this.conditions ??= []
          this.conditions.push(buf)
        }
      } else {
        if (field.type === 'integer') {
          const op = operationToByte(filter[1])
          let buf: Buffer
          if (op === 1) {
            // 1 byte [operation] (= 1)
            // 2 bytes [size of filter]
            // 2 bytes [index to read]
            // 4 bytes [equal integer]
            buf = Buffer.alloc(9)
            buf[0] = op
            buf.writeInt16LE(4, 1)
            // only for head
            buf.writeInt16LE(field.start, 3)
            buf.writeInt32LE(filter[2], 5)
          }

          // 0 2 -> go to dbi 2

          this.conditions ??= []
          this.conditions.push(buf)
        }
      }

      return this
    }
  }
  get(): number[] {
    // run filter

    if (this.conditions) {
      // 0-9
      // [30] [0] [00]
      // this.prefix
    }

    // typePrefix field shard

    // type [16bit integer u]
    // field [8bit integer u]
    // shard [16 bit integer u]
    //

    // 0-9
    // [30] [0] [00]

    // console.log('???', this.db.dbiIndex.get(this.type.dbMap.dbi[0]).toString())

    console.log(
      '---> conditions',
      new Uint8Array(Buffer.concat(this.conditions)),
    )

    const x = dbZig.getQuery(
      this.conditions.length > 1
        ? Buffer.concat(this.conditions)
        : this.conditions[0],
      this.type.dbMap.prefix,
      this.type.meta.lastId,
    )

    console.log(this.type.dbMap.prefix)

    const arr = new Array(x.byteLength / 4)

    for (let i = 0; i < x.byteLength; i += 4) {
      arr[i / 4] = x.readUint32LE(i)
    }

    return arr
  }
}

export const query = (db: BasedDb, target: string) => {
  const q = new Query(db, target)

  return q
}
