import { throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - validation - integers', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        myInt8: { type: 'int8', min: -10, max: 10 },
        myUint8: { type: 'uint8', min: 10, max: 20 },
        myInt16: { type: 'int16', min: 1000, max: 2000 },
        myUint16: { type: 'uint16', min: 1000, max: 2000 },
        myInt32: { type: 'int32', min: 100000, max: 200000 },
        myUint32: { type: 'uint32', min: 100000, max: 200000 },
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
  await db.create('thing', { myInt8: 10 })
  // This check fails because -11 is < -10, so it should throw
  await throws(() => db.create('thing', { myInt8: -11 }), 'int8 below min')
  await throws(() => db.create('thing', { myInt8: 11 }), 'int8 above max')

  // Uint8 (0 to 255)
  await throws(() => db.create('thing', { myUint8: -1 }), 'uint8 negative')
  // Uint8 (min 10 max 20)
  await db.create('thing', { myUint8: 10 })
  await throws(() => db.create('thing', { myUint8: 9 }), 'uint8 below min')
  await throws(() => db.create('thing', { myUint8: 21 }), 'uint8 above max')

  // Int16 (-32768 to 32767)
  // Int16 (min 1000 max 2000)
  await db.create('thing', { myInt16: 1000 })
  await throws(() => db.create('thing', { myInt16: 999 }), 'int16 below min')
  await throws(() => db.create('thing', { myInt16: 2001 }), 'int16 above max')

  // Uint16 (0 to 65535)
  // Uint16 (min 1000 max 2000)
  await db.create('thing', { myUint16: 1000 })
  await throws(() => db.create('thing', { myUint16: 999 }), 'uint16 below min')
  await throws(() => db.create('thing', { myUint16: 2001 }), 'uint16 above max')

  // Int32
  // Int32 (min 100000 max 200000)
  await db.create('thing', { myInt32: 100000 })
  await throws(() => db.create('thing', { myInt32: 99999 }), 'int32 below min')
  await throws(() => db.create('thing', { myInt32: 200001 }), 'int32 above max')

  // Uint32 (min 100000 max 200000)
  await db.create('thing', { myUint32: 100000 })
  await throws(
    () => db.create('thing', { myUint32: 99999 }),
    'uint32 below min',
  )
  await throws(
    () => db.create('thing', { myUint32: 200001 }),
    'uint32 above max',
  )

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
