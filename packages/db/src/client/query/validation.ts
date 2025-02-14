import { ALIAS, PropDef, PropDefEdge } from '../../server/schema/types.js'
import {
  MAX_IDS_PER_QUERY,
  MIN_ID_VALUE,
  MAX_ID_VALUE,
  MAX_BUFFER_SIZE,
} from './thresholds.js'
import { validOperators, Operator } from './filter/types.js'
import { QueryByAliasObj, QueryDef } from './types.js'

export const isValidId = (id: number): void => {
  if (typeof id != 'number') {
    throw new Error('Id has to be a number')
  } else if (id < MIN_ID_VALUE || id > MAX_ID_VALUE) {
    throw new Error(
      `Invalid Id: The Id should range between ${MIN_ID_VALUE} and ${MAX_ID_VALUE}.)`,
    )
  }
}

export const checkMaxIdsPerQuery = (
  ids: (number | QueryByAliasObj)[],
): void => {
  if (ids.length > MAX_IDS_PER_QUERY) {
    throw new Error(`The number of IDs cannot exceed ${MAX_IDS_PER_QUERY}.`)
  }
}

export const checkMaxBufferSize = (buf: Buffer): void => {
  if (buf.byteLength > MAX_BUFFER_SIZE) {
    throw new Error(
      `The buffer size exceeds the maximum threshold of ${MAX_BUFFER_SIZE} bytes.` +
        `Crrent size is ${buf.byteLength} bytes.`,
    )
  }
}

export const checkTotalBufferSize = (bufers: Buffer[]): void => {
  let totalSize = 0

  for (const buffer of bufers) {
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
  // get schema see if it actualy has the value (can find it on def)
  fields: { [key: string]: PropDefEdge } | { [path: string]: PropDef },
): void => {
  if (Object.keys(fields).length === 0) {
    throw new Error('No fields available to include')
  }
}

export const isValidAlias = (def: QueryDef, id: QueryByAliasObj) => {
  for (const key in id) {
    const prop = def.schema.props[key]
    if (!prop || prop.typeIndex !== ALIAS) {
      throw new Error(`Incorrect alias provided for query "${key}"`)
    }
  }
}

// also wrong
export const hasField = (field: string): void => {
  // get schema see if it actualy has the value (can find it on def)
  if (!field) {
    throw new Error(`Invalid field: ${field}`)
  } else if (typeof field !== 'string' || field.trim() === '') {
    throw new Error('Field must be a non-empty string')
  }
}
export const checkOperator = (operator: Operator | boolean): void => {
  // pass schema value (def) and complete for each prop + operator combination
  if (
    operator !== undefined &&
    typeof operator !== 'boolean' &&
    !validOperators.includes(operator)
  ) {
    throw new Error(`Invalid operator: ${operator}`)
  }
}

export const checkValue = (value: any, operator: Operator): void => {
  // pass schema value (def) and complete for each prop + operator combination
  if (operator === '..' || operator === '!..') {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error(
        `Invalid value for operator ${operator}: expected an array with two elements`,
      )
    }
  }
}
