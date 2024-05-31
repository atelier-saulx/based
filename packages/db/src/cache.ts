export const store: {
  slabs: Map<number, Buffer>
  cnt: number
} = {
  slabs: new Map(),
  cnt: 0,
}

export const createSlab = (size: number): number => {
  const buf = Buffer.allocUnsafe(size)
  buf.writeUint32LE(0, 0)
  store.cnt++
  if (store.cnt >= 4294967295) {
    console.warn('out of space for cnt reindex some mem....')
    // let lastNr = 0
    // store.slabs.forEach((key, ) => {
    // })
  }
  store.slabs.set(store.cnt, buf)
  return store.cnt
}

export const removeSlab = (address: number) => {
  store.slabs.delete(address)
}

// export const
