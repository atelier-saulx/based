import { SchemaReference } from '../types.js'
import { ERRORS } from './errors.js'
import { PropParser, isNotObject, getPropType } from './props.js'

export const reference = new PropParser<SchemaReference>(
  {
    // order is important
    ref(ref, _prop, schema) {
      if (isNotObject(schema.types) || !(ref in schema.types)) {
        throw Error(ERRORS.INVALID_VALUE)
      }
    },

    inverseProp(propKey, prop, schema) {
      const schemaType = schema.types[prop.ref]
      let targetProp = schemaType.props?.[propKey]
      if (isNotObject(targetProp)) {
        throw Error(ERRORS.EXPECTED_OBJ)
      }

      let targetPropType = getPropType(targetProp)
      if (targetPropType === 'set' && 'items' in targetProp) {
        targetProp = targetProp.items
      }

      if ('ref' in targetProp && 'inverseProp' in targetProp) {
        let t = schema.types[targetProp.ref]?.props?.[targetProp.inverseProp]
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
  },
)
