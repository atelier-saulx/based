import { AuthState } from './types'
import {
  decodeBase64,
  encodeBase64,
  stringToUtf8,
  uft8ToString,
} from '@saulx/utils'

export const decodeAuthState = (authState: string): AuthState => {
  try {
    const str = uft8ToString(decodeBase64(decodeURI(authState)))
    return JSON.parse(str)
  } catch (err) {
    return { error: 'Invalid authState' }
  }
}

export const encodeAuthState = (authState: AuthState): string => {
  return encodeURI(encodeBase64(stringToUtf8(JSON.stringify(authState))))
}
