import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - integers', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        myInt8: { type: 'int8' }, // -128 to 127
        myUint8: { type: 'uint8' }, // 0 to 255
        myInt16: { type: 'int16' }, // -32768 to 32767
        myUint16: { type: 'uint16' }, // 0 to 65535
        myInt32: { type: 'int32' },
        myUint32: { type: 'uint32' },
      },
    },
  })

  // Int8 (-128 to 127)
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myInt8: '1' }),
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

  // Extended validation (General invalid types for integers)
  await throws(() => db.create('thing', { myInt8: NaN }), 'int8 fail NaN')
  await throws(
    () => db.create('thing', { myInt8: Infinity }),
    'int8 fail Infinity',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myInt8: true }),
    'int8 fail boolean',
  )
  await throws(
    // @ts-expect-error
    () => db.create('thing', { myInt8: [] }),
    'int8 fail array',
  )

  // Test float fail for others
  await throws(() => db.create('thing', { myUint8: 1.5 }), 'uint8 fail float')
  await throws(() => db.create('thing', { myInt16: 1.5 }), 'int16 fail float')
  await throws(() => db.create('thing', { myUint16: 1.5 }), 'uint16 fail float')
  await throws(() => db.create('thing', { myInt32: 1.5 }), 'int32 fail float')
  await throws(() => db.create('thing', { myUint32: 1.5 }), 'uint32 fail float')
})
