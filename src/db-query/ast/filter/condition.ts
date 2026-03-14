import { PropDef } from '../../../schema/defs/index.js'
import {
  FilterConditionByteSize,
  FilterConditionAlignOf,
  writeFilterCondition,
  PropTypeEnum,
  FilterOpCompareEnum as OpEnum,
  LangCode,
  LangCodeEnum,
} from '../../../zigTsExports.js'

export const conditionByteSize = (propSize: number, size: number) => {
  return size + FilterConditionByteSize + FilterConditionAlignOf + 1 + propSize
}

export const createCondition = (
  prop: {
    start: number
    id: number
    size: number
    type: PropTypeEnum
    isEdge: boolean
  },
  op: OpEnum,
  size: number = prop.size,
  propSize: number = prop.size,
  lang: LangCodeEnum = LangCode.none,
) => {
  const conditionBuffer = new Uint8Array(conditionByteSize(propSize, size))
  conditionBuffer[0] = 255 // Means condition header is not aligned

  // @ts-ignore
  console.log('!!', prop.path, prop.isEdge)

  const offset =
    writeFilterCondition(
      conditionBuffer,
      {
        op: {
          prop: prop.type,
          compare: op,
        },
        lang,
        start: prop.start || 0,
        prop: prop.id,
        fieldSchema: 0,
        len: propSize,
        offset: 255, // Means value is not aligned
        size: size + propSize,
        useEdge: prop.isEdge,
      },
      FilterConditionAlignOf + 1,
    ) + propSize

  return { condition: conditionBuffer, offset }
}
