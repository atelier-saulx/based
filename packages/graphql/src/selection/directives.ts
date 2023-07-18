import { GetOptions } from '../types'

export function tryDirectiveOptions(
  getOptions: GetOptions,
  directives: Record<string, any>
): boolean {
  if (directives.default) {
    getOptions.$default = directives.default
    return true
  } else if (directives.inherit) {
    getOptions.$inherit =
      directives.inherit === true ? true : { $type: directives.inherit }
    return true
  }

  return false
}
