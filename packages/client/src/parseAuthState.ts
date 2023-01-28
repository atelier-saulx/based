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

/*
  Websocket Protocol
      token          = 1*<any CHAR except CTLs or separators>
      separators     = "(" | ")" | "<" | ">" | "@"
                    | "," | ";" | ":" | "\" | <">
                    | "/" | "[" | "]" | "?" | "="
                    | "{" | "}" | SP | HT 
      exclude " | '
*/
// | HT (what is this?)

// can also encode the json - no base64

export const encodeAuthState = (
  authState: AuthState,
  noSeparators: boolean = false
): string => {
  if (noSeparators) {
    const b64 = encodeBase64(stringToUtf8(JSON.stringify(authState)))
    return encodeURI(b64)
  }
  return encodeURI(encodeBase64(stringToUtf8(JSON.stringify(authState))))
}
