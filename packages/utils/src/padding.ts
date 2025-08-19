export const padLeft = (str: string, len: number, char: string): string => {
  const l = str.length
  for (let i = 0; i < len - l; i++) {
    str = char + str
  }
  return str
}

export const padRight = (str: string, len: number, char: string): string => {
  const l = str.length
  for (let i = 0; i < len - l; i++) {
    str = str + char
  }
  return str
}
