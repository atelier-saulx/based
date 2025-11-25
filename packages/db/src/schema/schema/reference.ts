import { parseBase, type Base } from './base.js'
import {
  assert,
  assertExpectedProps,
  deleteUndefined,
  isBoolean,
  isString,
  type RequiredIfStrict,
} from './shared.js'
import { parseProp, type SchemaProp } from './prop.js'
import type { SchemaReferences } from './references.js'
import type { SchemaOut } from './schema.js'

type EdgeExcludedProps = 'prop' | `$${string}`

export type SchemaReference<strict = false> = Base &
  RequiredIfStrict<{ type: 'reference' }, strict> & {
    ref: string
  } & {
    prop: string
    dependent?: boolean
    [edge: `$${string}`]:
      | Exclude<SchemaProp<strict>, SchemaReferences<strict>>
      | (Omit<SchemaReferences<strict>, 'items'> & {
          items: Omit<SchemaReference<strict>, EdgeExcludedProps>
        })
  }

let parsingEdges: boolean
export const parseReference = (
  def: Record<string, unknown>,
  locales: SchemaOut['locales'],
  fromReferences = false,
): SchemaReference<true> => {
  assert(isString(def.ref), 'Ref should be string')

  if (parsingEdges) {
    return parseBase<SchemaReference<true>>(def, {
      type: 'reference',
      ref: def.ref,
    } as SchemaReference<true>)
  }

  assert(isString(def.prop), 'Prop should be string')
  assert(
    def.dependent === undefined || isBoolean(def.dependent),
    'Dependent should be boolean',
  )

  const result: SchemaReference<true> = {
    type: 'reference',
    ref: def.ref,
    prop: def.prop,
    dependent: def.dependent,
  }

  parsingEdges = true
  for (const key in def) {
    if (key.startsWith('$')) {
      result[key] = parseProp(def[key], locales)
    }
  }
  parsingEdges = false
  if (fromReferences) {
    deleteUndefined(result)
    assertExpectedProps(result, def)
    return result
  }

  return parseBase<SchemaReference<true>>(def, result)
}

export const postParseRefs = (
  types: SchemaOut['types'],
  type: keyof SchemaOut['types'],
  prop: SchemaProp<true>,
  path: string[],
) => {
  if (prop.type === 'reference') {
    assert(prop.ref in types, `Ref type ${prop.ref} should be defined`)
    let inverse: any = types[prop.ref]
    for (const key of prop.prop.split('.')) {
      let next = 'props' in inverse ? inverse.props?.[key] : inverse[key]
      if (!next) {
        inverse.props ??= {}
        next = inverse.props[key] = {}
      }
      inverse = next
    }
    const dotPath = path.join('.')
    if (!inverse.type) {
      inverse.type = 'references'
      inverse.items = {
        type: 'reference',
        ref: type,
        prop: dotPath,
      }
    }
    if (inverse.items) {
      inverse = inverse.items
    }

    for (const key in inverse) {
      if (key[0] === '$') {
        prop[key] = inverse[key]
      }
    }

    for (const key in prop) {
      if (key[0] === '$') {
        inverse[key] = prop[key]
      }
    }

    assert(inverse.ref === type, `Ref should be ${type}`)
    assert(inverse.prop === dotPath, `Prop should be ${dotPath}`)
  } else if ('items' in prop) {
    postParseRefs(types, type, prop.items, path)
  } else if ('props' in prop) {
    for (const k in prop.props) {
      postParseRefs(types, type, prop.props[k], [...path, k])
    }
  }
}
