import { SchemaTypeDef } from '@based/schema/def'

export const applyHooks = (
  hooks:
    | SchemaTypeDef['propHooks']['create']
    | SchemaTypeDef['propHooks']['update'],
  payload: any,
) => {
  for (const [fn, path] of hooks) {
    let val = payload
    let obj: any
    let key: string
    for (key of path) {
      obj = val
      val = val?.[key]
    }
    if (val !== undefined) {
      obj[key] = fn(val, obj)
    }
  }
}
