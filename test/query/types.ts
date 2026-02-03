import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('query types', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        isNice: 'boolean',
      },
      everything: {
        s: 'string',
        n: 'number',
        i8: 'int8',
        u8: 'uint8',
        i16: 'int16',
        u16: 'uint16',
        i32: 'int32',
        u32: 'uint32',
        b: 'boolean',
        txt: 'text',
        js: 'json',
        ts: 'timestamp',
        bin: 'binary',
        als: 'alias',
        // vec: 'vector',
        // col: 'colvec',
        card: 'cardinality',
        myEnum: ['a', 'b'],
        nested: {
          props: {
            a: 'string',
          },
        },
        myRef: { type: 'reference', ref: 'user', prop: 'backRef' },
        myRefs: {
          type: 'references',
          items: { ref: 'user', prop: 'backRefs' },
        },
      },
    },
  })

  await db.create('user', {
    isNice: true,
  })

  const query = db.query2('user')
  const { data } = await query.get()

  if (data.length > 0) {
    const user = data[0]
    // Should be strictly boolean, not boolean | null | undefined
    const isNice: boolean = user.isNice
    const id: number = user.id
    // @ts-expect-error
    const wrong: string = user.isNice
    // @ts-expect-error
    const unknown = user.something
  }

  const query2 = db.query2('everything')
  const res = await query2.get()
  const everything = res.data[0]

  if (res.data.length > 0) {
    const s: string = everything.s
    const n: number = everything.n
    const i8: number = everything.i8
    const u8: number = everything.u8
    const i16: number = everything.i16
    const u16: number = everything.u16
    const i32: number = everything.i32
    const u32: number = everything.u32
    const b: boolean = everything.b
    const txt: string = everything.txt
    const js: any = everything.js
    const ts: number = everything.ts
    const bin: Uint8Array = everything.bin
    const als: string = everything.als
    const card: number = everything.card
    const myEnum: 'a' | 'b' = everything.myEnum
    const nestedA: string = everything.nested.a
    const myRef: number = everything.myRef
    const myRefs: number[] = everything.myRefs
    const id: number = everything.id

    // @ts-expect-error
    const wrongEnum: 'c' = everything.myEnum
    // @ts-expect-error
    const wrongRef: string = everything.myRef
    // @ts-expect-error
    const wrongRefs: number = everything.myRefs
  }

  {
    const query = db.query2('everything').include('myEnum')
    const { data } = await query.get()
    const res = data[0]
    const myEnum: 'a' | 'b' = res.myEnum
    const id: number = res.id
    // @ts-expect-error
    const n: number = res.n
  }

  {
    const query = db.query2('everything').include('*')
    const { data } = await query.get()
    const res = data[0]
    const n: number = res.n
    const s: string = res.s
    const myEnum: 'a' | 'b' = res.myEnum
    // @ts-expect-error
    const myRef = res.myRef
  }
  {
    const query = db.query2('everything').include('**')
    const { data } = await query.get()
    const res = data[0]

    // references
    const myRef: number = res.myRef
    const myRefs: number[] = res.myRefs
    const id: number = res.id

    // Scalars should be missing
    // @ts-expect-error
    const n: number = res.n
    // @ts-expect-error
    const s: string = res.s
    // @ts-expect-error
    const myEnum: 'a' | 'b' = res.myEnum
  }

  {
    // Combine explicit field + wildcard
    const query = db.query2('everything').include('myEnum', '**')
    const { data } = await query.get()
    const res = data[0]

    const myEnum: 'a' | 'b' = res.myEnum
    const myRef: number = res.myRef
    const myRefs: number[] = res.myRefs

    // Other scalars missing
    // @ts-expect-error
    const n: number = res.n
  }

  {
    // Multiple explicit fields
    const query = db.query2('everything').include('n', 's', 'nested')
    const { data } = await query.get()
    const res = data[0]

    const n: number = res.n
    const s: string = res.s
    const nestedA: string = res.nested.a

    // Missing
    // @ts-expect-error
    const myEnum: 'a' | 'b' = res.myEnum
  }

  {
    // Scalar wildcard + explicit ref
    const query = db.query2('everything').include('*', 'myRefs')
    const { data } = await query.get()
    const res = data[0]

    const n: number = res.n
    const myRefs: number[] = res.myRefs

    // Excluded ref
    // @ts-expect-error
    const myRef: number = res.myRef
  }

  {
    // Target specific id
    const query = db.query2('everything', 1).include('*', 'myRefs')
    const { data } = await query.get()

    // Check it's a single item (not array)
    const n: number = data.n
    const myRefs: number[] = data.myRefs

    // @ts-expect-error
    data.map

    // @ts-expect-error
    const myRef: number = data.myRef
  }
})

await test('query types', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        isNice: 'boolean',
      },
    },
  })

  const id = await db.create('user', {
    isNice: true,
  })

  const {
    data: { name, isNice },
  } = await db.query2('user', id).get()

  console.log({ name, isNice })

  const { data } = await db.query2('user').get()

  for (const { name, isNice } of data) {
    console.log({ name, isNice })
  }
})
