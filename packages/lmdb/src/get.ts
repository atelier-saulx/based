type View = { view?: DataView; arr?: Uint8Array; resul?: any }

const readUint = (buff: Uint8Array, start: number): number => {
  return (
    ((buff[start] << 24) |
      (buff[start + 1] << 16) |
      (buff[start + 2] << 8) |
      buff[start + 3]) >>>
    0
  )
}

const readFromBuffer = (view: View, tree: any): any => {
  const obj = {}
  for (const key in tree) {
    const t = tree[key]
    if (t.type === 'boolean') {
      obj[key] = view.arr[t.start] ? true : false
    } else if (t.type === 'number' || t.type === 'timestamp') {
      if (!view.view) {
        view.view = new DataView(view.arr.buffer)
      }
      obj[key] = view.view.getFloat64(t.start)
    } else if (t.type === 'string') {
    } else if (t.type === 'integer') {
      if (view.view) {
        obj[key] = view.view.getUint32(t.start)
      } else {
        obj[key] = readUint(view.arr, t.start)
      }
    } else {
      obj[key] = readFromBuffer(view, tree[key])
    }
  }
  return obj
}

export const parseBuffer = (arr: Uint8Array, schema) => {
  return readFromBuffer({ arr }, schema.dbMap.tree)
}
