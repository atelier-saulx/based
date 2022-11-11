import { FunctionType } from '../../types'

export default (name: string, type: FunctionType, path: string) => {
  let fn = require(path)
  if (fn.default) {
    fn = fn.default
  }
  return fn
}
