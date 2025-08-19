import { createDecode } from './decode.js'
import { createEncode } from './encode.js'
import { padLeft } from '../padding.js'

export const createEncoder = (
  chars: string[],
  encodeChars: string[] = ['$']
): {
  charMap: { [key: string]: string }
  reverseCharMap: { [key: string]: string }
  encode: (str: string) => string
  decode: (str: string) => string
} => {
  let charLen = 1
  const isLong = chars.length > 36
  const realChars = [...chars, ...encodeChars]

  const replacement = realChars.map((v, i) => {
    if (v.length > charLen) {
      charLen = v.length
    }
    if (i > 25) {
      return String(i - 26)
    }
    return String.fromCharCode(97 + i)
  })

  const charMap: { [key: string]: string } = {}
  const reverseCharMap: { [key: string]: string } = {}
  for (let i = 0; i < realChars.length; i++) {
    charMap[realChars[i]] =
      encodeChars.length === 1
        ? encodeChars[0] + replacement[i]
        : replacement[i]

    reverseCharMap[replacement[i]] = realChars[i]
  }

  let longest = 1
  if (isLong) {
    for (const key in reverseCharMap) {
      if (key.length > longest) {
        longest = key.length
      }
    }
    for (const key in reverseCharMap) {
      if (key.length < longest) {
        const nKey = padLeft(key, longest, '0')
        const c = reverseCharMap[key]
        if (encodeChars.length > 1) {
          charMap[c] = nKey
        } else {
          charMap[c] = encodeChars[0] + nKey
        }
        delete reverseCharMap[key]
        reverseCharMap[nKey] = c
      }
    }
  }

  return {
    charMap,
    reverseCharMap,
    encode: createEncode(charLen, charMap, encodeChars),
    decode: createDecode(isLong, longest, encodeChars, reverseCharMap),
  }
}
