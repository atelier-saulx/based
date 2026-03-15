export const canBitwiseLowerCase = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i)
    const isUppercaseLetter = charCode >= 65 && charCode <= 90
    const isNoOp = (charCode | 32) === charCode
    if (!isUppercaseLetter && !isNoOp) {
      return false
    }
  }
  return true
}
