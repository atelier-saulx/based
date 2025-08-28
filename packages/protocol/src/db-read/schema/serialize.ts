import { ReaderSchema } from '../types.js'

const writeBits = (state, value, numBits) => {
  let { buffer, byteIndex, bitIndex } = state
  // Fast path for byte-aligned writes
  if (bitIndex === 0 && numBits % 8 === 0) {
    const numBytes = numBits / 8
    for (let i = 0; i < numBytes; i++) {
      buffer[byteIndex + i] = (value >> (8 * (numBytes - 1 - i))) & 0xff
    }
    byteIndex += numBytes
    return { buffer, byteIndex, bitIndex }
  }

  // Slower path for unaligned writes
  for (let i = numBits - 1; i >= 0; i--) {
    const bit = (value >> i) & 1
    if (bit === 1) {
      buffer[byteIndex] |= 1 << (7 - bitIndex)
    }
    bitIndex++
    if (bitIndex === 8) {
      bitIndex = 0
      byteIndex++
    }
  }
  return { buffer, byteIndex, bitIndex }
}

const writeString = (state, str) => {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(str)
  let nextState = writeBits(state, encoded.length, 16) // Use 2 bytes for string length
  // Fast path for byte-aligned string copy
  if (nextState.bitIndex === 0) {
    nextState.buffer.set(encoded, nextState.byteIndex)
    nextState.byteIndex += encoded.length
  } else {
    // Slower path if not aligned
    for (const byte of encoded) {
      nextState = writeBits(nextState, byte, 8)
    }
  }
  return nextState
}

const serializeProp = (state, prop) => {
  let nextState = writeBits(state, prop.path.length, 4)
  for (const p of prop.path) {
    nextState = writeString(nextState, p)
  }
  nextState = writeBits(nextState, prop.typeIndex, 8)
  nextState = writeBits(nextState, prop.meta, 2)

  if (prop.locales) {
    nextState = writeBits(nextState, 1, 1)
    const keys = Object.keys(prop.locales)
    nextState = writeBits(nextState, keys.length, 4)
    for (const key of keys) {
      nextState = writeBits(nextState, parseInt(key), 6)
      nextState = writeString(nextState, prop.locales[key])
    }
  } else {
    nextState = writeBits(nextState, 0, 1)
  }

  if (prop.enum) {
    nextState = writeBits(nextState, 1, 1)
    nextState = writeBits(nextState, prop.enum.length, 4)
    for (const e of prop.enum) {
      nextState = writeString(nextState, e)
    }
  } else {
    nextState = writeBits(nextState, 0, 1)
  }
  return nextState
}

const serializeAggregate = (state, aggregate) => {
  let nextState = writeBits(state, aggregate.aggregates.length, 4)
  for (const agg of aggregate.aggregates) {
    nextState = writeBits(nextState, agg.path.length, 4)
    for (const p of agg.path) {
      nextState = writeString(nextState, p)
    }
    nextState = writeBits(nextState, agg.type, 8)
    nextState = writeBits(nextState, agg.resultPos, 8)
  }

  if (aggregate.groupBy) {
    nextState = writeBits(nextState, 1, 1)
    const { groupBy } = aggregate
    nextState = writeBits(nextState, groupBy.typeIndex, 8)

    if (groupBy.stepRange !== undefined) {
      nextState = writeBits(nextState, 1, 1)
      nextState = writeBits(nextState, groupBy.stepRange, 8)
    } else {
      nextState = writeBits(nextState, 0, 1)
    }

    if (groupBy.stepType !== undefined) {
      nextState = writeBits(nextState, 1, 1)
      nextState = writeBits(nextState, groupBy.stepType ? 1 : 0, 1)
    } else {
      nextState = writeBits(nextState, 0, 1)
    }

    if (groupBy.enum) {
      nextState = writeBits(nextState, 1, 1)
      nextState = writeBits(nextState, groupBy.enum.length, 4)
      for (const e of groupBy.enum) {
        nextState = writeString(nextState, e)
      }
    } else {
      nextState = writeBits(nextState, 0, 1)
    }
  } else {
    nextState = writeBits(nextState, 0, 1)
  }

  nextState = writeBits(nextState, aggregate.totalResultsSize, 16)
  return nextState
}

// max size is now 2kb
const SHARED_BUFFER = new Uint8Array(2096)
export const serialize = (schema: ReaderSchema) => {
  let state = { buffer: SHARED_BUFFER, byteIndex: 0, bitIndex: 0 }

  state = writeBits(state, schema.type, 4)

  const propsKeys = Object.keys(schema.props)
  state = writeBits(state, propsKeys.length, 4)
  for (const key of propsKeys) {
    state = writeBits(state, parseInt(key), 8)
    state = serializeProp(state, schema.props[key])
  }

  state = writeBits(state, schema.main.len, 8)
  const mainPropsKeys = Object.keys(schema.main.props)
  state = writeBits(state, mainPropsKeys.length, 4)
  for (const key of mainPropsKeys) {
    state = writeBits(state, parseInt(key), 16)
    state = serializeProp(state, schema.main.props[key])
  }

  const refsKeys = Object.keys(schema.refs)
  state = writeBits(state, refsKeys.length, 4)

  if (schema.aggregate) {
    state = writeBits(state, 1, 1)
    state = serializeAggregate(state, schema.aggregate)
  } else {
    state = writeBits(state, 0, 1)
  }

  if (schema.hook) {
    state = writeBits(state, 1, 1) // hook exists flag
    const hookStr =
      typeof schema.hook === 'function' ? schema.hook.toString() : schema.hook
    state = writeString(state, hookStr)
  } else {
    state = writeBits(state, 0, 1)
  }
  return state.buffer.slice(0, state.byteIndex + (state.bitIndex > 0 ? 1 : 0))
}
