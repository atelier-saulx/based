import {
  MAX_IDS_PER_QUERY,
  MIN_ID_VALUE,
  MAX_ID_VALUE,
  MAX_BUFFER_SIZE,
} from './thresholds.js'

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

export const hasFields = (fields: any): void => {
  if (Object.keys(fields).length === 0) {
    throw new Error('No fields available to include')
  }
}

export const hasField = (field: any): void => {
  if (!field) {
    throw new Error(`Field '${field}' does not exist in the definition`)
  }
}
