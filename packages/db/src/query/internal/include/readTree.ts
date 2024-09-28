// export const convertToIncludeTree = (tree: SchemaPropTree | PropDef) => {
//   const arr = []
//   for (const key in tree) {
//     const item = tree[key]
//     if (item.__isPropDef === true) {
//       arr.push(key, item)
//     } else {
//       arr.push(key, convertToIncludeTree(item))
//     }
//   }
//   return arr
// }

export const addPathToIntermediateTree = (
  field: any,
  includeTree: any,
  path: string[],
): boolean => {
  const len = path.length - 1
  let t = includeTree
  for (let i = 0; i <= len; i++) {
    const key = path[i]
    if (i === len) {
      if (t[key]) {
        return false
      }
      t[key] = field
    } else {
      if (!(key in t)) {
        t[key] = {}
      }
      t = t[key]
    }
  }
  return true
}
