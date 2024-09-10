import { EXPECTED_BOOL, EXPECTED_OBJ, EXPECTED_STR } from './errors.js'

export const expectObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    throw Error(EXPECTED_OBJ)
  }
}

export const expectString = (obj) => {
  if (typeof obj !== 'string') {
    throw Error(EXPECTED_STR)
  }
}

export const expectBoolean = (v) => {
  if (v !== true && v !== false) {
    throw Error(EXPECTED_BOOL)
  }
}
