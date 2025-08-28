import { TypeIndex } from '@based/schema/prop-types'
import { ReaderPropDef, ReaderSchema } from '../types.js'

type ReaderState = {
  buffer: Uint8Array
  byteIndex: number
  bitIndex: number
}

const readBits = (
  state: ReaderState,
  numBits: number,
): { value: number; newState: ReaderState } => {
  let { buffer, byteIndex, bitIndex } = state
  let value = 0
  for (let i = 0; i < numBits; i++) {
    if (byteIndex >= buffer.length) {
      return { value: 0, newState: state }
    }
    const bit = (buffer[byteIndex] >> (7 - bitIndex)) & 1
    value = (value << 1) | bit
    bitIndex++
    if (bitIndex === 8) {
      bitIndex = 0
      byteIndex++
    }
  }
  return { value, newState: { buffer, byteIndex, bitIndex } }
}

const readString = (
  state: ReaderState,
): { value: string; newState: ReaderState } => {
  const { value: length, newState: stateAfterLen } = readBits(state, 16) // Use 2 bytes for string length
  let nextState = stateAfterLen
  const bytes: number[] = []
  for (let i = 0; i < length; i++) {
    const { value: byte, newState } = readBits(nextState, 8)
    bytes.push(byte)
    nextState = newState
  }
  const decoder = new TextDecoder()
  const value = decoder.decode(new Uint8Array(bytes))
  return { value, newState: nextState }
}

const deserializeProp = (
  state: ReaderState,
): { prop: ReaderPropDef; newState: ReaderState } => {
  const prop: Partial<ReaderPropDef> = { readBy: 0 }

  let res1 = readBits(state, 4)
  prop.path = []
  let nextState = res1.newState
  for (let i = 0; i < res1.value; i++) {
    const resPath = readString(nextState)
    prop.path.push(resPath.value)
    nextState = resPath.newState
  }

  let res2 = readBits(nextState, 8)
  prop.typeIndex = res2.value as TypeIndex
  nextState = res2.newState

  let res3 = readBits(nextState, 2)
  prop.meta = res3.value
  nextState = res3.newState

  let res5 = readBits(nextState, 1)
  if (res5.value) {
    prop.locales = {}
    let resLocalesLen = readBits(res5.newState, 4)
    nextState = resLocalesLen.newState
    for (let i = 0; i < resLocalesLen.value; i++) {
      const resKey = readBits(nextState, 6)
      const resVal = readString(resKey.newState)
      prop.locales[resKey.value] = resVal.value
      nextState = resVal.newState
    }
  } else {
    nextState = res5.newState
  }

  let res6 = readBits(nextState, 1)
  if (res6.value) {
    prop.enum = []
    let resEnumLen = readBits(res6.newState, 4)
    nextState = resEnumLen.newState
    for (let i = 0; i < resEnumLen.value; i++) {
      const resEnum = readString(nextState)
      prop.enum.push(resEnum.value)
      nextState = resEnum.newState
    }
  } else {
    nextState = res6.newState
  }

  return { prop: prop as ReaderPropDef, newState: nextState }
}

const deserializeAggregate = (
  state: ReaderState,
): {
  aggregate: NonNullable<ReaderSchema['aggregate']>
  newState: ReaderState
} => {
  const aggregate: any = { aggregates: [] }
  let nextState = state

  const aggLenRes = readBits(nextState, 4)
  nextState = aggLenRes.newState
  for (let i = 0; i < aggLenRes.value; i++) {
    const agg: any = {}
    const pathLenRes = readBits(nextState, 4)
    agg.path = []
    nextState = pathLenRes.newState
    for (let j = 0; j < pathLenRes.value; j++) {
      const pathRes = readString(nextState)
      agg.path.push(pathRes.value)
      nextState = pathRes.newState
    }
    const typeRes = readBits(nextState, 8)
    agg.type = typeRes.value
    nextState = typeRes.newState
    const posRes = readBits(nextState, 8)
    agg.resultPos = posRes.value
    nextState = posRes.newState
    aggregate.aggregates.push(agg)
  }

  const hasGroupByRes = readBits(nextState, 1)
  nextState = hasGroupByRes.newState
  if (hasGroupByRes.value) {
    aggregate.groupBy = {}
    const typeIndexRes = readBits(nextState, 8)
    aggregate.groupBy.typeIndex = typeIndexRes.value
    nextState = typeIndexRes.newState

    const hasStepRangeRes = readBits(nextState, 1)
    nextState = hasStepRangeRes.newState
    if (hasStepRangeRes.value) {
      const stepRangeRes = readBits(nextState, 8)
      aggregate.groupBy.stepRange = stepRangeRes.value
      nextState = stepRangeRes.newState
    }

    const hasStepTypeRes = readBits(nextState, 1)
    nextState = hasStepTypeRes.newState
    if (hasStepTypeRes.value) {
      const stepTypeRes = readBits(nextState, 1)
      aggregate.groupBy.stepType = stepTypeRes.value === 1
      nextState = stepTypeRes.newState
    }

    const hasEnumRes = readBits(nextState, 1)
    nextState = hasEnumRes.newState
    if (hasEnumRes.value) {
      aggregate.groupBy.enum = []
      const enumLenRes = readBits(nextState, 4)
      nextState = enumLenRes.newState
      for (let i = 0; i < enumLenRes.value; i++) {
        const enumRes = readString(nextState)
        aggregate.groupBy.enum.push(enumRes.value)
        nextState = enumRes.newState
      }
    }
  }

  const totalSizeRes = readBits(nextState, 16)
  aggregate.totalResultsSize = totalSizeRes.value
  nextState = totalSizeRes.newState

  return { aggregate, newState: nextState }
}

export const deSerializeSchema = (buffer: Uint8Array): ReaderSchema => {
  const schema: Partial<ReaderSchema> & { readId: number } = {
    props: {},
    main: { props: {}, len: 0 },
    refs: {},
    readId: 0,
  }
  let state: ReaderState = { buffer, byteIndex: 0, bitIndex: 0 }

  let typeRes = readBits(state, 4)
  schema.type = typeRes.value
  let nextState = typeRes.newState

  let resProps = readBits(nextState, 4)
  nextState = resProps.newState
  for (let i = 0; i < resProps.value; i++) {
    const resKey = readBits(nextState, 8)
    const resProp = deserializeProp(resKey.newState)
    schema.props[resKey.value] = resProp.prop
    nextState = resProp.newState
  }

  let resMainLen = readBits(nextState, 8)
  schema.main.len = resMainLen.value
  nextState = resMainLen.newState

  let resMainProps = readBits(nextState, 4)
  nextState = resMainProps.newState
  for (let i = 0; i < resMainProps.value; i++) {
    const resKey = readBits(nextState, 16)
    const resProp = deserializeProp(resKey.newState)
    schema.main.props[resKey.value] = resProp.prop
    nextState = resProp.newState
  }

  const resRefs = readBits(nextState, 4)
  nextState = resRefs.newState

  const hasAggregateRes = readBits(nextState, 1)
  nextState = hasAggregateRes.newState
  if (hasAggregateRes.value) {
    const aggregateRes = deserializeAggregate(nextState)
    schema.aggregate = aggregateRes.aggregate
    nextState = aggregateRes.newState
  }

  const hasHookRes = readBits(nextState, 1)
  nextState = hasHookRes.newState
  if (hasHookRes.value) {
    const hookStringRes = readString(nextState)
    schema.hook = new Function(`return ${hookStringRes.value}`)()
    nextState = hookStringRes.newState
  }
  return schema as ReaderSchema
}
