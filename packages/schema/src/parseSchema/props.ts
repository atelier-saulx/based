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
import {
  expectBoolean,
  expectFunction,
  expectObject,
  expectString,
  expectNumber,
} from './assert.js'
import {
  EXPECTED_ARR,
  EXPECTED_DATE,
  EXPECTED_PRIMITIVE,
  EXPECTED_VALUE_IN_ENUM,
  INVALID_VALUE,
  MIN_MAX,
  OUT_OF_RANGE,
  TEXT_REQUIRES_LOCALES,
  TYPE_MISMATCH,
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
    expectBoolean(val)
  },
  query(val) {
    expectFunction(val)
  },
  path(val, prop, ctx) {
    expectString(val)
    const path = val.split('.')
    let t: any = ctx.type
    for (const key of path) {
      if ('items' in t) {
        t = t.items
      }
      if ('ref' in t) {
        t = ctx.schema.types[t.ref]
      }
      t = t.props[key]
      expectObject(t)
    }
    if (t.type !== prop.type) {
      throw Error(TYPE_MISMATCH)
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
    default(val) {
      expectBoolean(val)
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
    default(val, prop) {
      if (!prop.enum.includes(val)) {
        throw Error(EXPECTED_VALUE_IN_ENUM)
      }
    },
  },
)

p.number = propParser<SchemaNumber>(
  {
    min(val) {
      expectNumber(val)
    },
    max(val, prop) {
      expectNumber(val)
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
    default(val, prop) {
      expectNumber(val)
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
    prop(propKey, prop, { schema, type, inQuery }) {
      const propAllowed = type && !inQuery
      if (propAllowed) {
        expectString(propKey)
        let targetProp: any = schema.types[prop.ref].props[propKey]
        if ('items' in targetProp) {
          targetProp = targetProp.items
        }
        if ('ref' in targetProp && 'prop' in targetProp) {
          let t: any = schema.types[targetProp.ref].props[targetProp.prop]
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
    default(val) {
      expectString(val)
    },
    edge(val, prop, { schema, type, inQuery }) {
      const edgeAllowed = type && !inQuery
      if (edgeAllowed) {
        let targetProp: any = schema.types[prop.ref].props[prop.prop]
        if ('items' in targetProp) {
          targetProp = targetProp.items
        }
        console.warn('TODO add edge validation')
        return
      }

      throw Error('ref edge not supported on root or edge p')
    },
  },
)

p.set = propParser<SchemaSet | SchemaSetOneWay>(
  {
    items(items, prop, ctx) {
      expectObject(items)
      const itemsType = getPropType(items)
      if (
        itemsType === 'string' ||
        itemsType === 'number' ||
        itemsType === 'reference' ||
        itemsType === 'timestamp' ||
        itemsType === 'boolean'
      ) {
        ctx.inQuery = 'query' in prop
        p[itemsType](items, ctx)
        ctx.inQuery = false
      }
    },
  },
  {
    default(val, prop) {
      console.warn('TODO SET DEFAULT VALUE')
      // if (typeof val === 'object') {
      //   throwErr(ERRORS.EXPECTED_PRIMITIVE, prop, 'default')
      // }
    },
  },
)

p.string = propParser<SchemaString>(
  {},
  {
    default(val) {
      expectString(val)
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
    default(val, prop) {
      console.warn('MAKE DEFAULT VALUE FOR TEXT')
      //   if (typeof val !== 'string') {
      //     throwErr(ERRORS.EXPECTED_STR, prop, 'default')
      //   }
    },
  },
)

p.timestamp = propParser<SchemaTimestamp>(
  {},
  {
    default(val) {
      if (typeof val !== 'number' && !(val instanceof Date)) {
        throw Error(EXPECTED_DATE)
      }
    },
  },
)

export default p
