import {
  MAX_IDS_PER_QUERY,
  MIN_ID_VALUE,
  MAX_ID_VALUE,
  MAX_BUFFER_SIZE,
} from './threshoulds.js'


export const isValidId = (id: number): void => {
  if (typeof id != 'number' ) {
    throw new Error('Id has to be a number')
  }
  else if (id < MIN_ID_VALUE || id > MAX_ID_VALUE) {
    throw new Error(`Invalid Id: The Id should range between ${MIN_ID_VALUE} and ${MAX_ID_VALUE}.)`)
  }
}

export const checkMaxIdsPerQuery = (ids: number[]):void => {
  if (ids.length > MAX_IDS_PER_QUERY) {
    throw new Error(`The number of IDs cannot exceed ${MAX_IDS_PER_QUERY}.`)
  }
}

// TODO: Should be validated in zig?
export const checkMaxBufferSize = (buff: Buffer):void => {
  if (buff.byteLength > MAX_BUFFER_SIZE) {
    throw new Error(`The buffer size exceeds the maximum threshold of ${MAX_BUFFER_SIZE} bytes.` +
      `Crrent size is ${buff.byteLength} bytes.`)
  }
}

// TODO: Yet, to analyze if it performs!!!
// TODO: Should be validated in zig?
export const checkTotalBufferSize = (buffers: ArrayBufferLike[]):void => {
  let totalSize = 0

  for (const buff of buffers){
    totalSize += buff.byteLength

    if ( totalSize > MAX_BUFFER_SIZE) {
      throw new Error(`The total buffer size exceeds the maximum threshold of ${MAX_BUFFER_SIZE} bytes.` +
        `Crrent size is ${totalSize} bytes.`)
    }
  }
}
