const cycleChars = (encodeChars: string[], encodeCharIndex: number): string => {
  if (encodeCharIndex % 2) {
    return encodeChars[encodeChars.length - encodeCharIndex]
  }
  return encodeChars[encodeCharIndex]
}

export const createEncode = (
  charLen: number,
  charMap: { [key: string]: string },
  encodeChars: string[]
): ((str: string) => string) => {
  if (encodeChars.length > 1 && charLen === 1) {
    const encodeCharsLen = encodeChars.length
    return (input: string) => {
      let encodeCharIndex = 0
      let str = ''
      for (let i = 0; i < input.length; i++) {
        const c = input.charAt(i)
        if (charMap[c]) {
          encodeCharIndex += 1
          if (encodeCharIndex >= encodeCharsLen) {
            encodeCharIndex = 0
          }
          str += cycleChars(encodeChars, encodeCharIndex) + charMap[c]
        } else {
          str += c
        }
      }
      return str
    }
  }

  if (encodeChars.length > 1) {
    const encodeCharsLen = encodeChars.length
    return (input: string) => {
      let encodeCharIndex = 0
      let str = ''
      for (let i = 0; i < input.length; i++) {
        let added = false
        for (let j = charLen - 1; j > -1; j--) {
          if (i + j > input.length - 1) {
            continue
          }
          let s: string = ''
          for (let n = 0; n < j + 1; n++) {
            s += input.charAt(i + n)
          }
          if (charMap[s]) {
            encodeCharIndex += 1
            if (encodeCharIndex >= encodeCharsLen) {
              encodeCharIndex = 0
            }
            str += cycleChars(encodeChars, encodeCharIndex) + charMap[s]
            i += s.length - 1
            j = -1
            added = true
          }
        }
        if (!added) {
          str += input.charAt(i)
        }
      }
      return str
    }
  }

  if (charLen === 1) {
    return (input: string) => {
      let str = ''
      for (let i = 0; i < input.length; i++) {
        const c = input.charAt(i)
        if (charMap[c]) {
          str += charMap[c]
        } else {
          str += c
        }
      }
      return str
    }
  }

  return (input: string) => {
    let str = ''
    for (let i = 0; i < input.length; i++) {
      let added = false
      for (let j = charLen - 1; j > -1; j--) {
        if (i + j > input.length - 1) {
          continue
        }
        let s: string = ''
        for (let n = 0; n < j + 1; n++) {
          s += input.charAt(i + n)
        }
        if (charMap[s]) {
          str += charMap[s]
          i += s.length - 1
          j = -1
          added = true
        }
      }
      if (!added) {
        str += input.charAt(i)
      }
    }
    return str
  }
}
