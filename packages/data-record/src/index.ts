import { CompiledRecordDef } from './compiler.js'
import { serialize, deserialize, getNode } from './serializer.js'
import { isPointerType, SIZES, TYPES } from './types.js'
import { readValue } from './accessors.js'

export {
  RecordDef,
  CompiledRecordDef,
  compile,
  generateRecordDef,
  generateCHeader,
} from './compiler.js'
export { serialize, deserialize } from './serializer.js'
export {
  readValue,
  writeValue,
  readString,
  writeString,
  createReader,
  createStringReader,
  createWriter,
} from './accessors.js'

export * from './mach.js'

export * from './types.js'

export function allocRecord(
  compiledDef: CompiledRecordDef,
  opts?: { unpool?: boolean; heapSize?: number }
): Buffer {
  const heapSize = opts?.heapSize || 0
  const size = compiledDef.size + heapSize

  if (!Number.isInteger(heapSize) || heapSize < 0) {
    throw new Error('heapSize must be an integer')
  }

  if (opts?.unpool) {
    return Buffer.allocUnsafeSlow(size).fill(0)
  }
  return Buffer.alloc(size)
}

export function calcHeapSize(compiledDef: CompiledRecordDef, obj: any): number {
  let size = 0

  for (const [
    _offet,
    _typeSize,
    _arrSize,
    typeCode,
    path,
    fullName,
  ] of compiledDef.fieldList) {
    if (isPointerType(typeCode)) {
      const node = getNode(obj, path, fullName)

      const typeSize = SIZES[typeCode.charAt(1)] || 1
      if (typeCode === TYPES.record_p) {
        // The values should be already Buffers
        size += node
          ? compiledDef.align(
              Array.isArray(node)
                ? node.reduce((acc, cur) => acc + cur.length, 0)
                : node.length
            )
          : 0
      } else {
        size += node ? compiledDef.align(node.length * typeSize) : 0
      }
    }
  }

  return size
}

export function createRecord(compiledDef: CompiledRecordDef, obj: any): Buffer {
  const buf = allocRecord(compiledDef, {
    heapSize: calcHeapSize(compiledDef, obj),
  })

  serialize(compiledDef, buf, obj)

  return buf
}

export function deserializeRecordPArray<T = Object>(
  compiledDef: CompiledRecordDef,
  buf: Buffer,
  path: string,
  subDef: CompiledRecordDef
): T[] {
  const subBuf = readValue<Buffer>(compiledDef, buf, path)
  const elemSize = subDef.size

  return Array.from(Array(subBuf.length / elemSize), (_, i) =>
    subBuf.slice(i * elemSize, (i + 1) * elemSize)
  ).map((elem) => deserialize(subDef, elem))
}
