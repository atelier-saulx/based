```ts
if (field.type === 'reference') {
  console.log('REF!', field)
  console.log('REF')
  // --------------- SINGLE REF ----------------------
  let r
  const refField = field
  let refQueryField: RefQueryField
  if (!query.refIncludes) {
    query.refIncludes = {}
  }
  if (!query.refIncludes[refField.start]) {
    refQueryField = {
      mainIncludes: {},
      mainLen: 0,
      fields: [],
      schema: query.db.schemaTypesParsed[refField.allowedType],
      ref: refField,
      __isRef: true,
    }
    query.refIncludes[refField.start] = refQueryField
  } else {
    refQueryField = query.refIncludes[refField.start]
  }
  if (addPathToIntermediateTree(refField, includeTree, refField.path)) {
    // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1]   ([0][0] | [0][255][offset][offset][len][len][0]) [1][2]
    if (!includesMain) {
      query.mainIncludes = {}
      includesMain = true
      arr.push(0)
    }
    query.mainLen += refField.len
    query.mainIncludes[refField.start] = [0, refField]
    r = true
  }
  const fDef = refField.allowedType
  const refSchema = query.db.schemaTypesParsed[fDef]
  // wrong....
  const fieldP = field.path[1]
  console.info('???', { fieldP })
  const x = refSchema.fields[fieldP]
  if (x) {
    if (x.seperate) {
      refQueryField.fields.push(x)
    } else {
      refQueryField.mainLen += x.len
      refQueryField.mainIncludes[x.start] = [0, x]
    }
  }
  return r // result
  // --------------- END SINGLE REF ----------------------
}
```

```ts
import { Query } from './query.js'
import { QueryIncludeDef } from './types.js'

// type __r

// offset

// { includeTree, mainLen, mainIncludes } // maybe better mainInclude

// type SingleRef = { [start: string]: [number]
// mainLen: number = 0
// mainIncludes: { [start: string]: [number, FieldDef] }

// ;[
// 1, 0, 0, 0,
// 255,
// id: 1, 0, 0, 0,
// field 0,
// country code: 97, 97, 0,  // give info of start
// userId: 62, 2, 0, 0,
// select ref 0, 254, 3, 0, [start 3]
// field 0,
// user.age 66, 0, 0, 0
// field 1,
// 6, 0, 77, 114, 32, 53, 55, 51,
// ]

// }

export const createSingleRefBuffer = (include: QueryIncludeDef) => {
  // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1] ([0][len][len][offset][offset][len][len]) [1][2]

  if (!include.refIncludes) {
    include.refIncludes = {}
  }

  // ---> fix multiple refs
  const fields = include.includeArr.filter((v) => v !== 0)

  // only do main to start...
  let refsingleBuffer: Buffer
  let size = 6
  let i = 0

  size += fields?.length ?? 0

  if (include.mainLen) {
    size += 1

    if (include.mainLen !== include.schema.mainLen) {
      size += 3
      // MAIN SELECT FIELDS SIZE
      size += Object.keys(include.mainIncludes).length * 4
      // MAIN SIZE
      size += 4
    } else {
      // LATEr (just 0)
    }

    // -------- START WRITING
    refsingleBuffer = Buffer.allocUnsafe(size)

    // SIZE [0,1]

    // TYPE [2,3]
    refsingleBuffer[2] = include.schema.prefix[0]
    refsingleBuffer[3] = include.schema.prefix[1]

    i += 6

    if (include.mainLen !== include.schema.mainLen) {
      // REF [4,5]
      refsingleBuffer.writeUint16LE(include.fromRef.start, 4)

      // MAIN FIELD [6]
      refsingleBuffer[6] = 0

      // MAIN SELECTIVE FIELDS [7,8]
      refsingleBuffer.writeUint16LE(
        Object.keys(include.mainIncludes).length * 4,
        7,
      )

      // MAIN LEN [9,10,11,12] // can be 16...
      refsingleBuffer.writeUint32LE(include.mainLen, 9)

      // MAIN SELECT [13 ....]
      i = 9 + 4
      let m = 0
      for (const key in include.mainIncludes) {
        const v = include.mainIncludes[key]
        refsingleBuffer.writeUint16LE(v[1].start, i)
        const len = v[1].len
        v[0] = m
        refsingleBuffer.writeUint16LE(len, i + 2)
        i += 4
        m += len
      }
    } else {
      // INCLUDE ALL
      // later
    }

    i++
    refsingleBuffer[i] = 0
  }

  for (const f of fields) {
    refsingleBuffer[i] = f
    i++
  }

  refsingleBuffer.writeUint16LE(size - 6)

  return refsingleBuffer
}

/*
TODO FIRST INCLUDE make it nice
  support for nested fields


MULTI SINGLE REFS writer, admin
NESTED REF (RECURSIVE)
*/
```
