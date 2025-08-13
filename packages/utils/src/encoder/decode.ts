export const createDecode = (
  isLong: boolean,
  longest: number,
  encodeChars: string[] = ['$'],
  reverseCharMap: { [key: string]: string }
): ((str: string) => string) => {
  if (encodeChars.length > 1 && isLong) {
    // only isLong for now...
    return (input: string) => {
      let str = ''
      for (let i = 0; i < input.length; i++) {
        const c = input[i]
        if (encodeChars.includes(c)) {
          let fInput = ''
          for (let j = 0; j < longest; j++) {
            fInput += input[i + j + 1]
          }
          const f = reverseCharMap[fInput]
          str += f
          i += longest
        } else {
          str += c
        }
      }
      return str
    }
  }

  if (encodeChars.length > 1) {
    return (input: string) => {
      let str = ''
      for (let i = 0; i < input.length; i++) {
        const c = input[i]
        if (encodeChars.includes(c)) {
          const f = reverseCharMap[input[i + 1]]
          str += f
          i++
        } else {
          str += c
        }
      }
      return str
    }
  }

  const char = encodeChars[0]

  if (isLong) {
    return (input: string) => {
      let str = ''
      for (let i = 0; i < input.length; i++) {
        const c = input[i]
        if (c === char) {
          let fInput = ''
          for (let j = 0; j < longest; j++) {
            fInput += input[i + j + 1]
          }
          const f = reverseCharMap[fInput]
          str += f
          i += longest
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
      const c = input[i]
      if (c === char) {
        const f = reverseCharMap[input[i + 1]]
        str += f
        i++
      } else {
        str += c
      }
    }
    return str
  }
}
