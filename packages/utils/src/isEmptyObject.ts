export const isEmptyObject = (obj: { [key: string]: any }) => {
  for (const key in obj) {
    return false
  }
  return true
}
