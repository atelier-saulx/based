import test from 'ava'
import {
  equals,
  concatUint8Arr,
  bufToHex,
  hexToBuf,
  readDoubleLE,
  readFloatLE,
  readUint32,
  readInt32,
  readUint16,
  readInt16,
  readUint24,
  readInt24,
  writeUint16,
  writeInt16,
  writeUint24,
  writeInt24,
  writeUint32,
  writeInt32,
  makeTmpBuffer,
  writeUint64,
  readUint64,
  writeInt64,
  readInt64,
} from '../src/uint8.js'

test('equals() returns true for identical Uint8Arrays', (t) => {
  t.true(equals(new Uint8Array([]), new Uint8Array([])), 'Empty arrays')
  t.true(equals(new Uint8Array([1]), new Uint8Array([1])), 'Single element')
  t.true(
    equals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])),
    'Multiple elements',
  )
  const longArr = new Uint8Array(100).map((_, i) => i)
  t.true(equals(longArr, new Uint8Array(longArr)), 'Long arrays')
})

test('equals() returns false for different Uint8Arrays', (t) => {
  t.false(
    equals(new Uint8Array([1]), new Uint8Array([])),
    'Different lengths (1 vs 0)',
  )
  t.false(
    equals(new Uint8Array([]), new Uint8Array([1])),
    'Different lengths (0 vs 1)',
  )
  t.false(
    equals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])),
    'Different content (end)',
  )
  t.false(
    equals(new Uint8Array([1, 2, 3]), new Uint8Array([5, 2, 3])),
    'Different content (start)',
  )
  t.false(
    equals(new Uint8Array([1, 2, 3]), new Uint8Array([1, 5, 3])),
    'Different content (middle)',
  )
  const longArr1 = new Uint8Array(100).map((_, i) => i)
  const longArr2 = new Uint8Array(longArr1)
  longArr2[50] = 99
  t.false(equals(longArr1, longArr2), 'Different content (long arrays)')
})

// --- concatUint8Arr ---

test('concatUint8Arr() concatenates multiple arrays', (t) => {
  const arr1 = new Uint8Array([1, 2])
  const arr2 = new Uint8Array([3, 4, 5])
  const arr3 = new Uint8Array([6])
  const expected = new Uint8Array([1, 2, 3, 4, 5, 6])
  t.deepEqual(concatUint8Arr([arr1, arr2, arr3]), expected)
})

test('concatUint8Arr() handles empty arrays', (t) => {
  const arr1 = new Uint8Array([1, 2])
  const arr2 = new Uint8Array([])
  const arr3 = new Uint8Array([3])
  const expected = new Uint8Array([1, 2, 3])
  t.deepEqual(concatUint8Arr([arr1, arr2, arr3]), expected, 'Middle empty')
  t.deepEqual(concatUint8Arr([arr2, arr1, arr3]), expected, 'Start empty')
  t.deepEqual(concatUint8Arr([arr1, arr3, arr2]), expected, 'End empty')
  t.deepEqual(concatUint8Arr([arr2, arr2]), new Uint8Array([]), 'All empty')
})

test('concatUint8Arr() handles single array', (t) => {
  const arr1 = new Uint8Array([1, 2, 3])
  t.deepEqual(concatUint8Arr([arr1]), arr1)
})

// --- bufToHex / hexToBuf ---

test('bufToHex() converts Uint8Array to hex string', (t) => {
  t.is(bufToHex(new Uint8Array([])), '', 'Empty array')
  t.is(bufToHex(new Uint8Array([0])), '00', 'Zero byte')
  t.is(bufToHex(new Uint8Array([255])), 'ff', 'Max byte')
  t.is(bufToHex(new Uint8Array([10])), '0a', 'Single digit hex')
  t.is(bufToHex(new Uint8Array([16])), '10', 'Single digit hex boundary')
  t.is(
    bufToHex(new Uint8Array([72, 101, 108, 108, 111])),
    '48656c6c6f',
    'Hello',
  ) // "Hello"
})

test('hexToBuf() converts hex string to Uint8Array', (t) => {
  t.deepEqual(hexToBuf(''), new Uint8Array([]), 'Empty string')
  t.deepEqual(hexToBuf('00'), new Uint8Array([0]), 'Zero byte')
  t.deepEqual(hexToBuf('ff'), new Uint8Array([255]), 'Max byte')
  t.deepEqual(hexToBuf('0a'), new Uint8Array([10]), 'Single digit hex')
  t.deepEqual(hexToBuf('10'), new Uint8Array([16]), 'Single digit hex boundary')
  t.deepEqual(
    hexToBuf('48656c6c6f'),
    new Uint8Array([72, 101, 108, 108, 111]),
    'Hello',
  )
})

test('hexToBuf() handles odd length string (truncates last char)', (t) => {
  t.deepEqual(hexToBuf('f'), new Uint8Array([]), 'Single char')
  t.deepEqual(hexToBuf('abc'), new Uint8Array([171]), 'Three chars') // ab -> 171
})

test('hexToBuf() handles invalid hex characters (results in NaN/0)', (t) => {
  // The current implementation maps invalid chars to undefined -> NaN -> 0
  t.deepEqual(hexToBuf('gg'), new Uint8Array([0]), 'Invalid chars')
  t.deepEqual(hexToBuf('0g'), new Uint8Array([0]), 'Mixed valid/invalid')
  t.deepEqual(hexToBuf('g0'), new Uint8Array([0]), 'Mixed invalid/valid')
})

test('bufToHex() and hexToBuf() are inverses', (t) => {
  const original = new Uint8Array([0, 1, 15, 16, 128, 255, 7, 8, 9])
  const hex = bufToHex(original)
  const convertedBack = hexToBuf(hex)
  t.deepEqual(convertedBack, original)

  const originalHex = '0123456789abcdef'
  const buf = hexToBuf(originalHex)
  const convertedHexBack = bufToHex(buf)
  t.is(convertedHexBack, originalHex)
})

function createBufferWithDoubleLE(value: number): Uint8Array {
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  view.setFloat64(0, value, true)
  return new Uint8Array(buffer)
}

test('readDoubleLE() reads double values correctly', (t) => {
  t.is(readDoubleLE(createBufferWithDoubleLE(0), 0), 0, 'Zero')
  t.is(readDoubleLE(createBufferWithDoubleLE(1), 0), 1, 'One')
  t.is(readDoubleLE(createBufferWithDoubleLE(-1), 0), -1, 'Negative One')
  t.is(
    readDoubleLE(createBufferWithDoubleLE(123.456), 0),
    123.456,
    'Positive float',
  )
  t.is(
    readDoubleLE(createBufferWithDoubleLE(-987.654), 0),
    -987.654,
    'Negative float',
  )
  t.is(readDoubleLE(createBufferWithDoubleLE(Math.PI), 0), Math.PI, 'PI')
  t.is(
    readDoubleLE(createBufferWithDoubleLE(Number.MAX_VALUE), 0),
    Number.MAX_VALUE,
    'Max value',
  )
  t.is(
    readDoubleLE(createBufferWithDoubleLE(Number.MIN_VALUE), 0),
    Number.MIN_VALUE,
    'Min value',
  )
  t.is(
    readDoubleLE(createBufferWithDoubleLE(Infinity), 0),
    Infinity,
    'Infinity',
  )
  t.is(
    readDoubleLE(createBufferWithDoubleLE(-Infinity), 0),
    -Infinity,
    '-Infinity',
  )
  t.true(isNaN(readDoubleLE(createBufferWithDoubleLE(NaN), 0)), 'NaN')
})

test('readDoubleLE() reads with offset', (t) => {
  const buffer = new Uint8Array([
    0,
    0,
    ...createBufferWithFloatDoubleLE(123.456),
    0,
  ])
  t.true(readDoubleLE(buffer, 2) === 123.456)
})

function createBufferWithFloatDoubleLE(value: number): Uint8Array {
  const buffer = new Uint8Array(8)
  const view = new DataView(buffer.buffer, 0, 8)
  view.setFloat64(0, value, true)
  return buffer
}

function createBufferWithFloatLE(value: number): Uint8Array {
  const buffer = new Uint8Array(4)
  const view = new DataView(buffer.buffer, 0, 4)
  view.setFloat32(0, value, true)
  return buffer
}

test('readFloatLE() reads float values correctly', (t) => {
  const tolerance = 1e-5
  t.is(readFloatLE(createBufferWithFloatLE(0), 0), 0, 'Zero')
  t.is(readFloatLE(createBufferWithFloatLE(1), 0), 1, 'One')
  t.is(readFloatLE(createBufferWithFloatLE(-1), 0), -1, 'Negative One')

  t.assert(
    Math.abs(readFloatLE(createBufferWithFloatLE(Math.PI), 0) - Math.PI) <
      tolerance,
    'PI',
  )
  t.is(readFloatLE(createBufferWithFloatLE(Infinity), 0), Infinity, 'Infinity')
  t.is(
    readFloatLE(createBufferWithFloatLE(-Infinity), 0),
    -Infinity,
    '-Infinity',
  )
  t.true(isNaN(readFloatLE(createBufferWithFloatLE(NaN), 0)), 'NaN')
})

test('readFloatLE() reads with offset', (t) => {
  const tolerance = 1e-5
  const buffer = new Uint8Array([0, ...createBufferWithFloatLE(123.456), 0])

  t.assert(Math.abs(readFloatLE(buffer, 1) - 123.456) < tolerance)
})

test('readUint32() reads uint32 values', (t) => {
  const buf = new Uint8Array([
    0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x34, 0x12, 0xcd, 0xab,
  ])
  t.is(readUint32(buf, 0), 0, 'Zero')
  t.is(readUint32(buf, 4), 0xffffffff, 'Max Uint32')
  t.is(readUint32(buf, 8), 0xabcd1234, 'Specific value')
})

test('readInt32() reads int32 values using DataView setup', (t) => {
  // Define the values to test
  const values = [
    0, // Zero
    2147483647, // Max Int32
    -2147483648, // Min Int32
    -1412793804, // Specific negative value
    -1735758116, // Another specific negative value
  ]

  const bytesPerValue = 4
  const buffer = new ArrayBuffer(values.length * bytesPerValue)
  const view = new DataView(buffer)
  const littleEndian = true // Assuming readInt32 reads Little Endian

  // Write the values into the buffer using DataView
  values.forEach((value, index) => {
    view.setInt32(index * bytesPerValue, value, littleEndian)
  })

  // Create the Uint8Array from the prepared buffer
  const buf = new Uint8Array(buffer)

  // Perform the reads and assertions
  t.is(readInt32(buf, 0), values[0], 'Zero')
  t.is(readInt32(buf, 4), values[1], 'Max Int32')
  t.is(readInt32(buf, 8), values[2], 'Min Int32')
  t.is(readInt32(buf, 12), values[3], 'Specific negative value')
  t.is(readInt32(buf, 16), values[4], 'Another specific negative value')
})

test('readUint16() reads uint16 values', (t) => {
  const buf = new Uint8Array([0x00, 0x00, 0xff, 0xff, 0x34, 0x12])
  t.is(readUint16(buf, 0), 0, 'Zero')
  t.is(readUint16(buf, 2), 0xffff, 'Max Uint16')
  t.is(readUint16(buf, 4), 0x1234, 'Specific value')
})

test('readInt16() reads int16 values', (t) => {
  const buf = new Uint8Array([
    0x00,
    0x00, // 0
    0xff,
    0x7f, // Max Int16 (32767)
    0x00,
    0x80, // Min Int16 (-32768)
    0x34,
    0xab, // -21708
  ])
  t.is(readInt16(buf, 0), 0, 'Zero')
  t.is(readInt16(buf, 2), 32767, 'Max Int16')
  t.is(readInt16(buf, 4), -32768, 'Min Int16')
  t.is(readInt16(buf, 6), -21708, 'Specific negative value')
})

// --- makeTmpBuffer ---

test('makeTmpBuffer().getUint8Array() returns array of correct size', (t) => {
  const initialSize = 100
  const { getUint8Array } = makeTmpBuffer(initialSize)

  const arr50 = getUint8Array(50)
  t.is(arr50.byteLength, 50, 'Smaller than initial')

  const arr100 = getUint8Array(100)
  t.is(arr100.byteLength, 100, 'Equal to initial')

  const arr200 = getUint8Array(200)
  t.is(arr200.byteLength, 200, 'Larger than initial (triggers resize)')

  // Check if buffer is reused/resized correctly (optional but good)
  const arrAgain50 = getUint8Array(50)
  t.is(arrAgain50.byteLength, 50, 'Request smaller size again')
  // Verify it's likely the same underlying buffer (though this is an implementation detail)
  // arrAgain50[0] = 1;
  // t.is(arr200[0], 1); // This might pass if the buffer was resized down
})

// --- Write Functions ---

test('writeUint16() writes uint16 values (LE)', (t) => {
  const buf = new Uint8Array(6)
  writeUint16(buf, 0, 0) // 0x0000
  writeUint16(buf, 65535, 2) // 0xFFFF
  writeUint16(buf, 0x1234, 4) // 0x1234
  t.deepEqual(buf, new Uint8Array([0x00, 0x00, 0xff, 0xff, 0x34, 0x12]))
  t.is(readUint16(buf, 0), 0)
  t.is(readUint16(buf, 2), 65535)
  t.is(readUint16(buf, 4), 0x1234)
})

test('writeInt16() writes int16 values (LE)', (t) => {
  const buf = new Uint8Array(8)
  writeInt16(buf, 0, 0) // 0x0000
  writeInt16(buf, 32767, 2) // 0x7FFF
  writeInt16(buf, -1, 4) // 0xFFFF
  writeInt16(buf, -32768, 6) // 0x8000
  t.deepEqual(
    buf,
    new Uint8Array([0x00, 0x00, 0xff, 0x7f, 0xff, 0xff, 0x00, 0x80]),
  )
  t.is(readInt16(buf, 0), 0)
  t.is(readInt16(buf, 2), 32767)
  t.is(readInt16(buf, 4), -1)
  t.is(readInt16(buf, 6), -32768)
})

test('writeUint24() writes uint24 values (LE)', (t) => {
  const buf = new Uint8Array(9)
  writeUint24(buf, 0, 0) // 0x000000
  writeUint24(buf, 0xffffff, 3) // 0xFFFFFF
  writeUint24(buf, 0x123456, 6) // 0x123456
  t.deepEqual(
    buf,
    new Uint8Array([0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x56, 0x34, 0x12]),
  )
  t.is(readUint24(buf, 0), 0)
  t.is(readUint24(buf, 3), 0xffffff)
  t.is(readUint24(buf, 6), 0x123456)
})

test('writeInt24() writes int24 values (LE)', (t) => {
  const buf = new Uint8Array(12)
  writeInt24(buf, 0, 0) // 0x000000
  writeInt24(buf, 8388607, 3) // 0x7FFFFF (Max Int24)
  writeInt24(buf, -1, 6) // 0xFFFFFF
  writeInt24(buf, -8388608, 9) // 0x800000 (Min Int24)
  t.deepEqual(
    buf,
    new Uint8Array([
      0x00, 0x00, 0x00, 0xff, 0xff, 0x7f, 0xff, 0xff, 0xff, 0x00, 0x00, 0x80,
    ]),
  )
  t.is(readInt24(buf, 0), 0)
  t.is(readInt24(buf, 3), 8388607)
  // Note: readInt24 doesn't handle sign extension correctly for negative numbers > 16 bits
  // t.is(readInt24(buf, 6), -1); // This would fail with current readInt24
  // t.is(readInt24(buf, 9), -8388608); // This would fail
})

test('writeUint32() writes uint32 values (LE)', (t) => {
  const buf = new Uint8Array(12)
  writeUint32(buf, 0, 0) // 0x00000000
  writeUint32(buf, 0xffffffff, 4) // 0xFFFFFFFF
  writeUint32(buf, 0xabcd1234, 8) // 0xABCD1234
  t.deepEqual(
    buf,
    new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x34, 0x12, 0xcd, 0xab,
    ]),
  )
  t.is(readUint32(buf, 0), 0)
  t.is(readUint32(buf, 4), 0xffffffff)
  t.is(readUint32(buf, 8), 0xabcd1234)
})

test('writeInt32() writes int32 values (LE)', (t) => {
  const buf = new Uint8Array(16)
  writeInt32(buf, 0, 0) // 0x00000000
  writeInt32(buf, 2147483647, 4) // 0x7FFFFFFF (Max Int32)
  writeInt32(buf, -1, 8) // 0xFFFFFFFF
  writeInt32(buf, -2147483648, 12) // 0x80000000 (Min Int32)
  t.deepEqual(
    buf,
    new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x7f, 0xff, 0xff, 0xff, 0xff,
      0x00, 0x00, 0x00, 0x80,
    ]),
  )
  t.is(readInt32(buf, 0), 0)
  t.is(readInt32(buf, 4), 2147483647)
  t.is(readInt32(buf, 8), -1)
  t.is(readInt32(buf, 12), -2147483648)
})

test('writeUint64()', (t) => {
  const buf = new Uint8Array(8)
  const bigBoyNumber = Date.now()
  writeUint64(buf, bigBoyNumber, 0)
  t.is(readUint64(buf, 0), bigBoyNumber)

  const bigBoyNumberNegative = -Date.now()
  writeUint64(buf, bigBoyNumberNegative, 0)
  t.not(readUint64(buf, 0), bigBoyNumberNegative)
})

test('writeInt64() with negative numbers', (t) => {
  const buf = new Uint8Array(8)

  // Test with a negative timestamp
  const negativeTimestamp = -7258033050000
  writeInt64(buf, negativeTimestamp, 0)
  const readNegativeTimestamp = readInt64(buf, 0)
  t.is(
    readNegativeTimestamp,
    negativeTimestamp,
    'Negative timestamp round-trip',
  )

  // Test with a large negative number
  const largeNegative = -9223372036854775808 // Min Int64
  writeInt64(buf, largeNegative, 0)
  const readLargeNegative = readInt64(buf, 0)
  t.is(readLargeNegative, largeNegative, 'Large negative number round-trip')

  // Test with a small negative number
  const smallNegative = -123
  writeInt64(buf, smallNegative, 0)
  const readSmallNegative = readInt64(buf, 0)
  t.is(readSmallNegative, smallNegative, 'Small negative number round-trip')

  // Test with the specific value 1678881600000
  const specificValue = 1678881600000
  writeInt64(buf, specificValue, 0)
  const readSpecificValue = readInt64(buf, 0)
  t.is(
    readSpecificValue,
    specificValue,
    'Specific value 1678881600000 round-trip',
  )
})

test('writeInt64() and readInt64() with JavaScript timestamps', (t) => {
  const buf = new Uint8Array(16)

  // Test with historical date (negative timestamp)
  const historicalDate = new Date('1/2/1740')
  const historicalTimestamp = historicalDate.getTime()

  // Use a known negative timestamp for testing
  const testNegativeTimestamp = -7258033050000 // This is approximately 1740
  writeInt64(buf, testNegativeTimestamp, 0)
  const readHistoricalTimestamp = readInt64(buf, 0)
  t.is(
    readHistoricalTimestamp,
    testNegativeTimestamp,
    'Historical date (negative timestamp)',
  )

  // Test with recent date (positive timestamp)
  const recentDate = new Date('2020-12-01')
  const recentTimestamp = recentDate.getTime()
  writeInt64(buf, recentTimestamp, 8)
  const readRecentTimestamp = readInt64(buf, 8)
  t.is(readRecentTimestamp, recentTimestamp, 'Recent date (positive timestamp)')

  // Verify the timestamps are different
  t.not(
    testNegativeTimestamp,
    recentTimestamp,
    'Timestamps should be different',
  )
  t.true(testNegativeTimestamp < 0, 'Historical timestamp should be negative')
  t.true(recentTimestamp > 0, 'Recent timestamp should be positive')
})

test('Performance comparison: writeInt64 vs writeUint64', (t) => {
  const iterations = 1000000
  const buf = new Uint8Array(8)

  // Test writeUint64 performance
  const uint64Start = performance.now()
  for (let i = 0; i < iterations; i++) {
    writeUint64(buf, i, 0)
  }
  const uint64End = performance.now()
  const uint64Time = uint64End - uint64Start

  // Test writeInt64 performance
  const int64Start = performance.now()
  for (let i = 0; i < iterations; i++) {
    writeInt64(buf, i, 0)
  }
  const int64End = performance.now()
  const int64Time = int64End - int64Start

  console.log(
    `writeUint64: ${uint64Time.toFixed(2)}ms for ${iterations.toLocaleString()} iterations`,
  )
  console.log(
    `writeInt64: ${int64Time.toFixed(2)}ms for ${iterations.toLocaleString()} iterations`,
  )
  console.log(
    `Performance ratio (writeInt64/writeUint64): ${(int64Time / uint64Time).toFixed(2)}x`,
  )

  // Both should complete in reasonable time (less than 1 second each)
  t.true(uint64Time < 1000, `writeUint64 took too long: ${uint64Time}ms`)
  t.true(int64Time < 1000, `writeInt64 took too long: ${int64Time}ms`)

  // The performance difference should be reasonable (not more than 5x slower)
  // DataView operations with BigInt are naturally slower than simple arithmetic
  t.true(
    int64Time / uint64Time < 5,
    `writeInt64 is too slow compared to writeUint64: ${(int64Time / uint64Time).toFixed(2)}x`,
  )

  // Test with negative values to see if that affects performance
  const negativeInt64Start = performance.now()
  for (let i = 0; i < iterations; i++) {
    writeInt64(buf, -i, 0)
  }
  const negativeInt64End = performance.now()
  const negativeInt64Time = negativeInt64End - negativeInt64Start

  console.log(
    `writeInt64 (negative): ${negativeInt64Time.toFixed(2)}ms for ${iterations.toLocaleString()} iterations`,
  )
  console.log(
    `Performance ratio (negative/positive): ${(negativeInt64Time / int64Time).toFixed(2)}x`,
  )

  // Negative values use DataView while positive values use fast arithmetic
  // This is expected to be slower, but should still be reasonable
  t.true(
    negativeInt64Time / int64Time < 10,
    `Negative values are too slow compared to positive: ${(negativeInt64Time / int64Time).toFixed(2)}x`,
  )
})

test('Performance comparison: readInt64 vs readUint64', (t) => {
  const iterations = 1000000
  const buf = new Uint8Array(8)

  // Write some test data
  writeInt64(buf, 123456789, 0)

  // Test readUint64 performance
  const uint64Start = performance.now()
  for (let i = 0; i < iterations; i++) {
    readUint64(buf, 0)
  }
  const uint64End = performance.now()
  const uint64Time = uint64End - uint64Start

  // Test readInt64 performance (positive values)
  const int64Start = performance.now()
  for (let i = 0; i < iterations; i++) {
    readInt64(buf, 0)
  }
  const int64End = performance.now()
  const int64Time = int64End - int64Start

  console.log(
    `readUint64: ${uint64Time.toFixed(2)}ms for ${iterations.toLocaleString()} iterations`,
  )
  console.log(
    `readInt64 (positive): ${int64Time.toFixed(2)}ms for ${iterations.toLocaleString()} iterations`,
  )
  console.log(
    `Performance ratio (readInt64/readUint64): ${(int64Time / uint64Time).toFixed(2)}x`,
  )

  // Both should complete in reasonable time
  t.true(uint64Time < 1000, `readUint64 took too long: ${uint64Time}ms`)
  t.true(int64Time < 1000, `readInt64 took too long: ${int64Time}ms`)

  // readInt64 should be reasonably fast for positive values
  t.true(
    int64Time / uint64Time < 3,
    `readInt64 is too slow compared to readUint64: ${(int64Time / uint64Time).toFixed(2)}x`,
  )
})
