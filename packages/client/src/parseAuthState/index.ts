import { AuthState } from '../types'
import {
  base64EncArr,
  strToUTF8Arr,
  base64DecToArr,
  UTF8ArrToStr,
} from './base64'

export const decodeAuthState = (authState: string): AuthState => {
  try {
    const str = UTF8ArrToStr(base64DecToArr(decodeURI(authState)))
    return JSON.parse(str)
  } catch (err) {
    return { error: 'Invalid authState' }
  }
}

export const encodeAuthState = (authState: AuthState): string => {
  return encodeURI(base64EncArr(strToUTF8Arr(JSON.stringify(authState))))
}
