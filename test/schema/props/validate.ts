import test from '../../shared/test.js'
import {
  number,
  uint8,
  int8,
  enum_ as enumProp,
  boolean,
} from '../../../src/schema/defs/props/fixed.js'
import { AutoSizedUint8Array } from '../../../src/utils/AutoSizedUint8Array.js'

const assertThrows = (fn: () => void, re: RegExp) => {
  try {
    fn()
  } catch (e) {
    if (re.test(e.message)) return
    throw new Error(`Expected error matching ${re}, got "${e.message}"`)
  }
  throw new Error(`Expected error matching ${re}, but function did not throw`)
}

await test('Fixed props validation: throws on invalid input', async (t) => {
  const autoBuf = new AutoSizedUint8Array()
  const writeBuf = new Uint8Array(10)

  // Number validation
  // @ts-ignore
  const numProp = new number({ type: 'number', min: 10, max: 20 }, ['test'], {})

  assertThrows(() => numProp.pushValue(autoBuf, 5), /smaller than min/)
  assertThrows(() => numProp.pushValue(autoBuf, 25), /larger than max/)
  assertThrows(() => numProp.pushValue(autoBuf, 'string'), /Invalid type/)

  assertThrows(() => numProp.write(writeBuf, 5, 0), /smaller than min/)
  assertThrows(() => numProp.write(writeBuf, 25, 0), /larger than max/)
  assertThrows(() => numProp.write(writeBuf, 'string', 0), /Invalid type/)

  // Uint8 validation
  // @ts-ignore
  const u8Prop = new uint8({ type: 'uint8' }, ['test'], {})
  assertThrows(() => u8Prop.pushValue(autoBuf, 256), /Value out of range/)
  assertThrows(() => u8Prop.pushValue(autoBuf, -1), /Value out of range/)

  assertThrows(() => u8Prop.write(writeBuf, 256, 0), /Value out of range/)
  assertThrows(() => u8Prop.write(writeBuf, -1, 0), /Value out of range/)

  // Int8 validation
  // @ts-ignore
  const i8Prop = new int8({ type: 'int8' }, ['test'], {})
  assertThrows(() => i8Prop.pushValue(autoBuf, 128), /Value out of range/)
  assertThrows(() => i8Prop.pushValue(autoBuf, -129), /Value out of range/)

  assertThrows(() => i8Prop.write(writeBuf, 128, 0), /Value out of range/)
  assertThrows(() => i8Prop.write(writeBuf, -129, 0), /Value out of range/)

  // Enum validation
  // @ts-ignore
  const enProp = new enumProp({ type: 'enum', enum: ['a', 'b'] }, ['test'], {})
  assertThrows(() => enProp.pushValue(autoBuf, 'c'), /Invalid enum value/)
  assertThrows(() => enProp.write(writeBuf, 'c', 0), /Invalid enum value/)

  // Boolean validation
  // @ts-ignore
  const boolProp = new boolean({ type: 'boolean' }, ['test'], {})
  assertThrows(() => boolProp.pushValue(autoBuf, 123), /Invalid type/)
  assertThrows(() => boolProp.write(writeBuf, 123, 0), /Invalid type/)
})
