const packOne = (nodeType: number, field: number) =>
  ((nodeType & 0xffff) << 8) | (field & 0xff)

const packTwo = (a: number, b: number) => (a << 24) | (b & 0xffffff)

const makeTuple = (
  aType: number,
  aField: number,
  bType: number,
  bField: number,
) => {
  const a = packOne(aType, aField)
  const b = packOne(bType, bField)

  return a < b ? packTwo(a, b) : packTwo(b, a)
}

export default class RefSet {
  #s = new Set<number>()

  add(srcType: number, srcField: number, dstType: number, dstField: number) {
    const t = makeTuple(srcType, srcField, dstType, dstField)

    if (this.#s.has(t)) {
      return false
    }
    this.#s.add(t)

    return true
  }

  clear() {
    this.#s.clear()
  }

  values() {
    return this.#s.values()
  }
}
