import { FunctionType } from '../../types'

export default (name: string, type: FunctionType, path: string) => {
  console.info(name, type, path)
  let fn = require(path)
  if (fn.default) {
    fn = fn.default
  }
  return fn
}
