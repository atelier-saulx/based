import {
  SchemaAnyProp,
  SchemaBoolean,
  SchemaEnum,
  SchemaNumber,
  SchemaReferenceOneWay,
  SchemaReference,
  SchemaSetOneWay,
  SchemaSet,
  SchemaString,
  SchemaTimestamp,
  SchemaText,
} from '../types.js'
import { expectObject, expectString } from './assert.js'
import {
  EXPECTED_ARR,
  EXPECTED_BOOL,
  EXPECTED_NUM,
  EXPECTED_PRIMITIVE,
  EXPECTED_STR,
  EXPECTED_VALUE_IN_ENUM,
  INVALID_VALUE,
  MIN_MAX,
  OUT_OF_RANGE,
  TEXT_REQUIRES_LOCALES,
  UNKNOWN_PROP,
} from './errors.js'
import { Parser } from './index.js'
import { getPropType } from './utils.js'

type PropsFns<PropType> = Record<
  string,
  (val, prop: PropType, ctx: Parser) => void
>

const shared: PropsFns<SchemaAnyProp> = {
  type() {},
  required(val) {
    if (typeof val !== 'boolean') {
      throw Error(EXPECTED_BOOL)
    }
  },
}

function propParser<PropType extends SchemaAnyProp>(
  required: PropsFns<PropType>,
  optional: PropsFns<PropType>,
) {
  return (prop, ctx: Parser) => {
    for (const key in required) {
      required[key](prop[key], prop, ctx)
    }
    for (const key in prop) {
      const val = prop[key]
      if (key in optional) {
        optional[key](val, prop, ctx)
      } else if (key in shared) {
        shared[key](val, prop, ctx)
      } else if (!(key in required)) {
        throw Error(UNKNOWN_PROP)
      }
    }
  }
}

const p: Record<string, ReturnType<typeof propParser>> = {}

p.boolean = propParser<SchemaBoolean>(
  {},
  {
    defaultValue(val) {
      if (typeof val !== 'boolean') {
        throw Error(EXPECTED_BOOL)
      }
    },
  },
)

p.enum = propParser<SchemaEnum>(
  {
    enum(items) {
      if (!Array.isArray(items)) {
        throw Error(EXPECTED_ARR)
      }
      for (const item of items) {
        if (typeof item === 'object') {
          throw Error(EXPECTED_PRIMITIVE)
        }
      }
    },
  },
  {
    defaultValue(val, prop) {
      if (!prop.enum.includes(val)) {
        throw Error(EXPECTED_VALUE_IN_ENUM)
      }
    },
  },
)

p.number = propParser<SchemaNumber>(
  {
    min(val) {
      if (typeof val !== 'number') {
        throw Error(EXPECTED_NUM)
      }
    },
    max(val, prop) {
      if (typeof val !== 'number') {
        throw Error(EXPECTED_NUM)
      }
      if (prop.min > val) {
        throw Error(MIN_MAX)
      }
    },
    step(val) {
      if (typeof val !== 'number' && val !== 'any') {
        throw Error(INVALID_VALUE)
      }
    },
  },
  {
    defaultValue(val, prop) {
      if (typeof val !== 'number') {
        throw Error(EXPECTED_NUM)
      }
      if (val > prop.max || val < prop.min) {
        throw Error(OUT_OF_RANGE)
      }

      if (prop.step !== 'any') {
        const min =
          typeof prop.min !== 'number' || prop.min === Infinity ? 0 : prop.min
        const v = val - min

        if (~~(v / prop.step) * prop.step !== v) {
          throw Error(INVALID_VALUE)
        }
      }
    },
  },
)

p.reference = propParser<SchemaReference & SchemaReferenceOneWay>(
  {
    ref(ref, _prop, { schema }) {
      schema.types[ref].props
    },
    prop(propKey, prop, { schema, inType }) {
      if (inType) {
        expectString(propKey)
        let targetProp = schema.types[prop.ref].props[propKey]
        if ('items' in targetProp) {
          targetProp = targetProp.items
        }
        if ('ref' in targetProp && 'prop' in targetProp) {
          let t = schema.types[targetProp.ref].props[targetProp.prop]
          if ('items' in t) {
            t = t.items
          }
          if (t === prop) {
            return
          }
        }

        throw Error(INVALID_VALUE)
      }

      if (propKey !== undefined) {
        throw Error('ref prop not supported on root or edge p')
      }
    },
  },
  {
    defaultValue(val) {
      if (typeof val !== 'string') {
        throw Error(EXPECTED_STR)
      }
    },
    edge(val, prop, { schema, inType }) {
      if (!inType) {
        throw Error('ref edge not supported on root or edge p')
      }
      let targetProp = schema.types[prop.ref].props[prop.prop]
      if ('items' in targetProp) {
        targetProp = targetProp.items
      }
    },
  },
)

p.set = propParser<SchemaSet | SchemaSetOneWay>(
  {
    items(items, _prop, ctx) {
      expectObject(items)
      const itemsType = getPropType(items)
      if (
        itemsType === 'string' ||
        itemsType === 'number' ||
        itemsType === 'reference' ||
        itemsType === 'timestamp' ||
        itemsType === 'boolean'
      ) {
        p[itemsType](items, ctx)
      }
    },
  },
  {
    defaultValue(val, prop) {
      console.warn('TODO SET DEFAULT VALUE')
      // if (typeof val === 'object') {
      //   throwErr(ERRORS.EXPECTED_PRIMITIVE, prop, 'defaultValue')
      // }
    },
  },
)

p.string = propParser<SchemaString>(
  {},
  {
    defaultValue(val) {
      if (typeof val !== 'string') {
        throw Error(EXPECTED_STR)
      }
    },
  },
)

p.text = propParser<SchemaText>(
  {
    type(_val, _prop, { schema }) {
      if (schema.locales) {
        for (const _ in schema.locales) {
          return
        }
      }
      throw Error(TEXT_REQUIRES_LOCALES)
    },
  },
  {
    defaultValue(val, prop) {
      console.warn('MAKE DEFAULT VALUE FOR TEXT')
      //   if (typeof val !== 'string') {
      //     throwErr(ERRORS.EXPECTED_STR, prop, 'defaultValue')
      //   }
    },
  },
)

p.timestamp = propParser<SchemaTimestamp>(
  {},
  {
    defaultValue(val) {
      if (typeof val !== 'number' && !(val instanceof Date)) {
        throw Error(EXPECTED_STR)
      }
    },
  },
)

export default p
