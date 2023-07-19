import { DirectiveNode, print } from 'graphql'

export function parseDirectives(
  rawDirectives: readonly DirectiveNode[]
): Record<string, any> {
  if (!rawDirectives || !rawDirectives.length) {
    return {}
  }

  return rawDirectives.reduce((obj, dir) => {
    const dirName = dir?.name?.value
    const arg = dir?.arguments[0]?.value
    if (arg?.kind === 'ListValue') {
      for (const v of arg?.values) {
        if (v?.kind === 'EnumValue') {
          // FIXME: dirty
          ;(v as any).kind = 'StringValue'
        }
        // TODO: make sure that the  passed string value is a selva type, not graphql type?
      }
    }

    const serialized = !arg
      ? true
      : arg.kind === 'ObjectValue'
      ? JSON.parse(
          print(arg).replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ')
        )
      : JSON.parse(print(arg))
    return Object.assign(obj, { [dirName]: serialized })
  }, {})
}
