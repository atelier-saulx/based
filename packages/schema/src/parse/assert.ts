import { parse, type SemVer } from '@std/semver'
import {
  EXPECTED_ARR,
  EXPECTED_BOOL,
  EXPECTED_FN,
  EXPECTED_NUM,
  EXPECTED_OBJ,
  EXPECTED_STR,
} from './errors.js'

export const expectVersion = (obj: any): SemVer => {
  try {
    return parse(obj)
  } catch (e) {
    throw Error('invalid semver version')
  }
}

export const expectObject = (obj: any, msg?: string) => {
  if (typeof obj !== 'object' || obj === null) {
    throw Error(msg || EXPECTED_OBJ)
  }
}

export const expectArray = (obj: any) => {
  if (!Array.isArray(obj)) {
    throw Error(EXPECTED_ARR)
  }
}

export const expectFloat32Array = (arr: any) => {
  if (!(arr instanceof Float32Array)) {
    throw Error(EXPECTED_ARR)
  }
}

export const expectString = (obj: any) => {
  if (typeof obj !== 'string') {
    throw Error(EXPECTED_STR)
  }
}

export const expectBoolean = (v: any) => {
  if (v !== true && v !== false) {
    throw Error(EXPECTED_BOOL)
  }
}

export const expectFunction = (v: any) => {
  if (typeof v !== 'function') {
    throw Error(EXPECTED_FN)
  }
}

export const expectNumber = (v: any) => {
  if (typeof v !== 'number') {
    throw Error(EXPECTED_NUM)
  }
}

export const expectPositiveNumber = (v: any) => {
  expectNumber(v)
  if (v < 0) {
    throw Error('Expected positive number')
  }
}
