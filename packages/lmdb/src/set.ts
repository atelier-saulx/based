const storeUint = (buff: Uint8Array, n: number, start: number) => {
  buff[start] = (n >> 24) & 0xff
  buff[start + 1] = (n >> 16) & 0xff
  buff[start + 2] = (n >> 8) & 0xff
  buff[start + 3] = n & 0xff
}

type View = { view?: DataView; arr?: Uint8Array }

const writeFromSetObj = (obj, tree, schema, view: View) => {
  for (const key in obj) {
    const t = tree[key]
    const value = obj[key]
    if (typeof value === 'object') {
      writeFromSetObj(value, t, schema, view)
    } else {
      // if (t.type === 'timestamp') {
      //   view.result[t.index] = BigInt(value)
      // } else {
      // view.result[t.index] = value
      // }
      if (t.type === 'timestamp' || t.type === 'number') {
        if (!view.view) {
          view.view = new DataView(view.arr.buffer)
        }
        view.view.setFloat64(t.start, value)
      } else if (t.type === 'integer') {
        if (view.view) {
          view.view.setUint32(t.start, value)
        } else {
          storeUint(view.arr, value, t.start)
        }
      } else if (t.type === 'boolean') {
        view.arr[t.start] = value ? 1 : 0
      }
    }
  }
}

// just use buffer sadnass
export const createBuffer = (obj, schema, buf?: Buffer) => {
  let arr
  if (!buf) {
    arr = new Uint8Array(schema.dbMap._len)
  } else {
    // use buff offset
  }
  // const result = {}

  // preAllocated

  writeFromSetObj(obj, schema.dbMap.tree, schema, { arr })

  // return createRecord(schema.dbMap.record, result)

  return arr
}
