import 'fast-text-encoding'

Blob.prototype.arrayBuffer = function () {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(this)
    reader.onloadend = () => {
      resolve(reader.result)
    }
  })
}

const noop = () => null

globalThis.localStorage = {
  getItem: noop,
  setItem: noop,
  removeItem: noop,
}
