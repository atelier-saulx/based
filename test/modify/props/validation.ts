import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation', async (t) => {
  const db = await testDb(t, {
    locales: { en: true },
    types: {
      thing: {
        name: { type: 'string', min: 2, max: 5 },
        myString: { type: 'string' },
        score: { type: 'number', min: 10, max: 20 },
        myNumber: { type: 'number' },
        isActive: { type: 'boolean' },
        myEnum: { enum: ['a', 'b'] },
        myJson: { type: 'json' },
        myText: { type: 'text' },
        myTs: { type: 'timestamp', min: 1000, max: 2000 },
        myInt8: { type: 'int8' }, // -128 to 127
        myUint8: { type: 'uint8' }, // 0 to 255
        myInt16: { type: 'int16' }, // -32768 to 32767
        myUint16: { type: 'uint16' }, // 0 to 65535
        myInt32: { type: 'int32' },
        myUint32: { type: 'uint32' },
        myBlob: { type: 'binary', maxBytes: 10 },
        myAlias: { type: 'alias' },
      },
    },
  })

  // String
  await throws(
    () => db.create('thing', { name: 123 as any }),
    'string should fail with number',
  )
  await throws(
    () => db.create('thing', { name: 'a' }),
    'string should fail if too short',
  )
  await throws(
    () => db.create('thing', { name: 'aaaaaa' }),
    'string should fail if too long',
  )
  await db.create('thing', { name: 'abc' })

  // Number
  await throws(
    () => db.create('thing', { score: '123' as any }),
    'number should fail with string',
  )
  await throws(
    () => db.create('thing', { score: 9 }),
    'number should fail if too small',
  )
  await throws(
    () => db.create('thing', { score: 21 }),
    'number should fail if too large',
  )
  await db.create('thing', { score: 15 })

  // Boolean
  await throws(
    () => db.create('thing', { isActive: 'true' as any }),
    'boolean should fail with string',
  )
  await throws(
    () => db.create('thing', { isActive: 1 as any }),
    'boolean should fail with number',
  )
  await db.create('thing', { isActive: true })

  // Enum
  await throws(
    () => db.create('thing', { myEnum: 'c' as any }),
    'enum should fail with invalid value',
  )
  await db.create('thing', { myEnum: 'b' })

  // Json
  // Passed undefined is checked in separate.ts but undefined in object usually means "ignore" or "delete".
  // Explicit null might be allowed as valid JSON.
  // Validation for JSON is loose (just checks serialization usually).
  // No explicit tests for JSON structure as checking JSON validity is tricky via TS object (which is already valid if passed).

  // Text
  await throws(
    () => db.create('thing', { myText: 123 as any }),
    'text should fail with number',
  )
  await throws(
    () => db.create('thing', { myText: { en: 123 as any } }),
    'text value should fail with number',
  )
  await throws(
    () => db.create('thing', { myText: { de: 'hello' } as any }),
    'text should fail with invalid locale',
  )
  await db.create('thing', { myText: { en: 'works' } })

  // Timestamp
  await throws(() => db.create('thing', { myTs: 500 }), 'timestamp too small')
  await throws(() => db.create('thing', { myTs: 3000 }), 'timestamp too large')
  await db.create('thing', { myTs: 1500 })

  // Int8 (-128 to 127)
  await throws(
    () => db.create('thing', { myInt8: '1' as any }),
    'int8 fail string',
  )
  await throws(() => db.create('thing', { myInt8: 1.5 }), 'int8 fail float')
  await throws(() => db.create('thing', { myInt8: 128 }), 'int8 overflow')
  await throws(() => db.create('thing', { myInt8: -129 }), 'int8 underflow')
  await db.create('thing', { myInt8: 127 })

  // Uint8 (0 to 255)
  await throws(() => db.create('thing', { myUint8: -1 }), 'uint8 negative')
  await throws(() => db.create('thing', { myUint8: 256 }), 'uint8 overflow')
  await db.create('thing', { myUint8: 255 })

  // Int16 (-32768 to 32767)
  await throws(() => db.create('thing', { myInt16: 32768 }), 'int16 overflow')
  await throws(() => db.create('thing', { myInt16: -32769 }), 'int16 underflow')
  await db.create('thing', { myInt16: 32767 })

  // Uint16 (0 to 65535)
  await throws(() => db.create('thing', { myUint16: 65536 }), 'uint16 overflow')
  await db.create('thing', { myUint16: 65535 })

  // Int32
  await throws(
    () => db.create('thing', { myInt32: 2147483648 }),
    'int32 overflow',
  )
  await db.create('thing', { myInt32: 2147483647 })

  // Uint32
  await throws(
    () => db.create('thing', { myUint32: 4294967296 }),
    'uint32 overflow',
  )
  await db.create('thing', { myUint32: 4294967295 })

  // Binary
  await throws(
    () => db.create('thing', { myBlob: 'not a buffer' as any }),
    'binary fail with string',
  )
  await throws(
    () => db.create('thing', { myBlob: new Uint8Array(20) }),
    'binary maxBytes',
  )
  await db.create('thing', { myBlob: new Uint8Array(5) })

  // Alias
  await throws(
    () => db.create('thing', { myAlias: 123 as any }),
    'alias fail with number',
  )
  const id1 = await db.create('thing', { myAlias: 'cool-alias' })

  // Alias collision (should throw?)
  // db aliases are unique.
  // Although not strictly "prop validation" logic (it's uniqueness constraint), alias implies unique.
  // But strict type validation is what we tested above.
  // Let's stop at type validation as requested.
})
