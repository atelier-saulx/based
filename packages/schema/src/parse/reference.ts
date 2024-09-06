import { SchemaReference } from '../types.js'
import { ERRORS } from './errors.js'
import { PropParser, isNotObject, getPropType } from './props.js'

export const reference = new PropParser<SchemaReference>(
  {
    ref(ref, _prop, schema) {
      if (isNotObject(schema.types) || !(ref in schema.types)) {
        throw Error(ERRORS.INVALID_VALUE)
      }
    },
    prop(propKey, prop, schema, rootOrEdgeProps) {
      if (rootOrEdgeProps) {
        if (propKey === undefined) {
          return
        }
        throw Error('ref prop not supported on root or edge props')
      }
      let targetProp = schema.types[prop.ref].props?.[propKey]
      if (!targetProp) {
        // it should throw elsewhere in the parser
        return
      }
      if ('items' in targetProp) {
        targetProp = targetProp.items
      }
      if ('ref' in targetProp && 'prop' in targetProp) {
        let t = schema.types[targetProp.ref]?.props?.[targetProp.prop]
        if ('items' in t) {
          t = t.items
        }
        if (t === prop) {
          return
        }
      }

      throw Error(ERRORS.INVALID_VALUE)
    },
  },
  {
    defaultValue(val) {
      if (typeof val !== 'string') {
        throw Error(ERRORS.EXPECTED_STR)
      }
    },

    edge(val, prop, schema, rootOrEdgeProps) {
      if (rootOrEdgeProps) {
        throw Error('ref edge not supported on root or edge props')
      }
      let targetProp = schema.types[prop.ref].props[prop.prop]
      if ('items' in targetProp) {
        targetProp = targetProp.items
      }
    },
  },
)
