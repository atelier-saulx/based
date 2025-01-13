import { PropDef, PropDefEdge } from '../../server/schema/types.js'
import {
  MAX_IDS_PER_QUERY,
  MIN_ID_VALUE,
  MAX_ID_VALUE,
  MAX_BUFFER_SIZE,
} from './thresholds.js'
import { validOperators, Operator } from './filter/operators.js'

export const isValidId = (id: number): void => {
  if (typeof id != 'number') {
    throw new Error('Id has to be a number')
  } else if (id < MIN_ID_VALUE || id > MAX_ID_VALUE) {
    throw new Error(
      `Invalid Id: The Id should range between ${MIN_ID_VALUE} and ${MAX_ID_VALUE}.)`,
    )
  }
}

export const checkMaxIdsPerQuery = (ids: number[]): void => {
  if (ids.length > MAX_IDS_PER_QUERY) {
    throw new Error(`The number of IDs cannot exceed ${MAX_IDS_PER_QUERY}.`)
  }
}

export const checkMaxBufferSize = (buff: Buffer): void => {
  if (buff.byteLength > MAX_BUFFER_SIZE) {
    throw new Error(
      `The buffer size exceeds the maximum threshold of ${MAX_BUFFER_SIZE} bytes.` +
        `Crrent size is ${buff.byteLength} bytes.`,
    )
  }
}

export const checkTotalBufferSize = (buffers: Buffer[]): void => {
  let totalSize = 0

  for (const buffer of buffers) {
    totalSize += buffer.byteLength

    if (totalSize > MAX_BUFFER_SIZE) {
      throw new Error(
        `The total buffer size exceeds the maximum threshold of ${MAX_BUFFER_SIZE} bytes.` +
          `Crrent size is ${totalSize} bytes.`,
      )
    }
  }
}

export const hasFields = (
  fields: { [key: string]: PropDefEdge } | { [path: string]: PropDef },
): void => {
  if (Object.keys(fields).length === 0) {
    throw new Error('No fields available to include')
  }
}

export const hasField = (field: string): void => {
  if (!field) {
    throw new Error(`Invalid field: ${field}`)
  } else if (typeof field !== 'string' || field.trim() === '') {
    throw new Error('Field must be a non-empty string')
  }
  // // TODO: checar se é mesmo def.fields direto ou props e mudar tipo de any->def
  // else if (!def.fields.includes(field)) {
  //   throw new Error(`Field '${field}' does not exist in the definition`)
  // }
}
// Besides do checking, it also normalizes it to boolean,
// shall change to a better name?
export const checkOperator = (operator: Operator | boolean): Operator => {
  if (operator === undefined) {
    return '='
  } else if (typeof operator === 'boolean') {
    return '='
  } else if (!validOperators.includes(operator)) {
    throw new Error(`Invalid operator: ${operator}`)
  }
  return operator
}

// Besides do checking, it also normalizes it when boolean,
// shall change to a better name?
export const checkValue = (value: any, operator: Operator): any => {
  if (operator === '..' || operator === '!..') {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error(
        `Invalid value for operator ${operator}: expected an array with two elements`,
      )
    }
    return value
  } else if (operator === '=' && value === undefined) {
    return true
  }
  return value
}
