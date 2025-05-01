import { PathToken } from '@based/functions'
import {
  NUMBER_ZERO,
  NUMBER_NINE,
  LETTER_UPPER_A,
  LETTER_UPPER_Z,
  LETTER_LOWER_A,
  LETTER_LOWER_Z,
  UNDERSCORE,
  HYPHEN,
  DOT,
  PLUS,
  ASTERISK,
  QUESTION_MARK,
  REQUIRED_MODIFIER,
  STATIC,
  COLON,
  PARAM,
  INVALID,
  SLASH,
  EQUALS_SIGN,
  AMPERSAND,
} from './types.js'

/**
 * Checks if the byte represents a character for a parameter name.
 * Valid characters are 0-9 / A-Z / a-z / _ / - / .
 *
 * @param code - The ASCII code of the character.
 */
function isValidParamChar(code: number): boolean {
  return (
    (code >= NUMBER_ZERO && code <= NUMBER_NINE) ||
    (code >= LETTER_UPPER_A && code <= LETTER_UPPER_Z) ||
    (code >= LETTER_LOWER_A && code <= LETTER_LOWER_Z) ||
    code === UNDERSCORE ||
    code === HYPHEN ||
    code === DOT
  )
}

/**
 * Checks if the byte represents a character from a reserved function.
 * Reserved functions are represented by 'db' or 'based'
 *
 * @param code - The ASCII code of the character.
 */
function isReservedName(value: Buffer): boolean {
  return (
    (
      value[0] === 0x64 &&  // 'd'
      value[1] === 0x62     // 'b'
    ) ||
    (
      value[0] === 0x62 &&  // 'b'
      value[1] === 0x61 &&  // 'a'
      value[2] === 0x73 &&  // 's'
      value[3] === 0x65 &&  // 'e'
      value[4] === 0x64)    // 'd'
  )
}

/**
 * Checks if the byte represents a modifier for a parameter name.
 * Valid modifiers are + / * / ?
 *
 * @param code - The ASCII code of the character.
 */
function isValidParamModifier(code: number): boolean {
  return code === PLUS || code === ASTERISK || code === QUESTION_MARK
}

/**
 * Splits a Buffer using a delimiter (byte) and returns the pieces.
 *
 * @param buffer - The Buffer to split.
 * @param delimiter - The ASCII code of the delimiter.
 */
function splitBuffer(buffer: Buffer, delimiter: number): Buffer[] {
  const parts: Buffer[] = []

  if (!buffer?.length) {
    return parts
  }

  let start = 0

  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === delimiter) {
      if (i - start > 0) {
        parts.push(buffer.slice(start, i))
      }

      start = i + 1
    }
  }

  if (buffer.length - start > 0) {
    parts.push(buffer.slice(start))
  }

  return parts
}

/**
 * Parses a segment.
 * If the segment starts with ":", it is treated as a parameter token.
 * Only parameters can have modifiers, otherwise they'll be marked as INVALID.
 * All invalid characters are removed from the final buffer.
 *
 * @param segment - The pattern segment as a Buffer.
 */
function parseToken(segment: Buffer): PathToken {
  let modifier: PathToken['modifier'] = REQUIRED_MODIFIER
  let value: Buffer = Buffer.allocUnsafe(segment?.length)
  let type: number = STATIC

  let i = 0
  let j = 0
  const len = segment.byteLength

  if (segment[i] !== COLON) {
    type = STATIC
    value[j++] = segment[i]

    i++
  } else {
    type = PARAM

    i++
  }

  while (i < len) {
    if (
      isValidParamChar(segment[i]) ||
      (segment[i] === COLON && isReservedName(value))
    ) {
      value[j++] = segment[i]
    } else if (
      isValidParamModifier(segment[i]) &&
      type === PARAM &&
      i === len - 1
    ) {
      modifier = segment[i] as PathToken['modifier']
    } else {
      type = INVALID
      value.fill(0)

      break
    }

    i++
  }

  value = value.slice(0, j)

  return { type, value, modifier } as PathToken
}

/**
 * Splits the Buffer using "/" (47) in an array of tokens, empty's as ignored.
 *
 * @param pattern - The pattern as a Buffer.
 * @returns An array of tokens.
 */
export function tokenizePattern(pattern: Buffer): PathToken[] {
  const parts = splitBuffer(pattern, SLASH)
  const tokens: PathToken[] = []

  if (!parts.length) {
    return tokens
  }

  for (const part of parts) {
    tokens.push(parseToken(part))
  }

  return tokens
}

/**
 * Checks if the path  as a Buffer matches the specified pattern also as Buffer.
 *
 * @param pattern - The pattern ("/users/:userId?")
 * @param path - The path to test ("/users/123")
 */
export function pathMatcher(tokens: PathToken[], path: Buffer): boolean {
  if (!tokens?.length || path?.byteLength === 0 || path?.[0] !== SLASH) {
    return false
  }

  let tokenIndex = 0
  let i = 1
  const len = path.byteLength
  let token = tokens[i - 1]
  let lastIndex = 1
  let tokenSize = token.value.length
  let tokenValueIndex = 0

  if (token.type === STATIC && len <= tokenSize && path !== token.value) {
    return false
  }

  while (i < len) {
    if (path[i] === SLASH) {
      tokenIndex++
      i++
      lastIndex = i
      token = tokens[tokenIndex]

      if (path[i] === SLASH) {
        return false
      }
    }

    if (i === len && !token) {
      return true
    }

    if (i < len && !token) {
      const previousModifier = tokens[tokenIndex - 1].modifier
      if (previousModifier === ASTERISK || previousModifier === PLUS) {
        return true
      }

      if (path[i] === QUESTION_MARK) {
        return true
      }

      return false
    }

    if (i === len && token?.type === PARAM) {
      if (token.modifier === QUESTION_MARK || token.modifier === ASTERISK) {
        return true
      }

      if (token.modifier === PLUS || token.modifier === REQUIRED_MODIFIER) {
        return false
      }
    }

    if (i === len - 1 && tokens.length - 1 > tokenIndex) {
      const nextModifier = tokens[tokenIndex + 1]?.modifier

      if (
        nextModifier === undefined ||
        nextModifier === REQUIRED_MODIFIER ||
        nextModifier === PLUS
      ) {
        return false
      }
    }

    if (token?.type === INVALID) {
      return false
    }

    if (token?.type === STATIC) {
      if (path[i] !== token.value[i - lastIndex]) {
        return false
      }

      if (path[i] === token.value[tokenValueIndex] && tokenSize) {
        tokenSize--
        tokenValueIndex++
        i++
        continue
      }
    }

    i++
  }

  if (tokenSize && token?.type === STATIC) {
    return false
  }

  return true
}

/**
 * Extract the path values matching the specified pattern as a Buffer.
 *
 * @param pattern - The pattern ("/users/:userId?")
 * @param path - The path to test ("/users/123")
 */
export function pathExtractor(
  tokens: PathToken[],
  path: Buffer,
): Record<string, string | string[] | boolean> {
  if (!tokens?.length || path?.byteLength === 0 || path?.[0] !== SLASH) {
    return null
  }

  let tokenIndex = 0
  let i = 1
  const len = path.byteLength
  let token = tokens[i - 1]
  let tokenValue = token.value.toString()
  const extractions: Record<string, string | string[] | boolean> = {}
  let collected: string = ''
  let isToCollect: boolean = false
  let query: boolean = false
  let queryValue: string = ''

  if (i === len) {
    extractions[tokenValue] = ''

    return extractions
  }

  for (const { type, value, modifier } of tokens) {
    if (type === PARAM) {
      tokenValue = value.toString()

      if (modifier === PLUS || modifier === ASTERISK) {
        extractions[tokenValue] = []
      } else {
        extractions[tokenValue] = ''
      }
    }
  }

  while (i < len) {
    if (i === 1 && path[i] === QUESTION_MARK) {
      extractions[tokenValue] = ''
    }

    if (path[i] !== SLASH) {
      collected += String.fromCharCode(path[i]) || ''
    }

    if (query) {
      if (i === len - 1 && collected && !queryValue) {
        extractions[collected] = true

        collected = ''
      }

      if (path[i] === QUESTION_MARK) {
        collected = ''
      }

      if (path[i + 1] === EQUALS_SIGN) {
        i++
        extractions[collected] = ''
        queryValue = collected

        collected = ''
      }

      if (path[i + 1] === AMPERSAND || (i === len - 1 && collected)) {
        i++
        extractions[queryValue] = collected
        collected = ''
      }

      i++
      continue
    }

    if (path[i] === QUESTION_MARK && !query) {
      query = true
      collected = ''
      i++
      continue
    }

    i++

    if (path[i] === SLASH) {
      isToCollect = true
      i++
    }

    if (i === len) {
      isToCollect = true
    }

    if (isToCollect) {
      isToCollect = false

      if (token.type === PARAM) {
        if (token.modifier === PLUS || token.modifier === ASTERISK) {
          ;(extractions[tokenValue] as string[]).push(collected)
        } else {
          extractions[tokenValue] = collected
        }
      }

      collected = ''
    }

    if (!collected && tokenIndex + 1 < tokens.length) {
      tokenIndex++
      token = tokens[tokenIndex]
    }
  }

  return extractions
}
