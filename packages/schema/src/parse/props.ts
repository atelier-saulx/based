import {
  SchemaAnyProp,
  SchemaBoolean,
  SchemaCardinality,
  SchemaEnum,
  SchemaNumber,
  SchemaReferenceOneWay,
  SchemaReference,
  SchemaSet,
  SchemaString,
  SchemaTimestamp,
  SchemaText,
  SchemaObject,
  SchemaObjectOneWay,
  SchemaReferences,
  SchemaAlias,
  stringFormats,
  dateDisplays,
  numberDisplays,
  SchemaVector,
  SchemaJson,
} from '../types.js'
import {
  expectBoolean,
  expectFloat32Array,
  expectFunction,
  expectNumber,
  expectObject,
  expectString,
} from './assert.js'
import {
  EXPECTED_ARR,
  EXPECTED_DATE,
  EXPECTED_OBJ,
  EXPECTED_PRIMITIVE,
  EXPECTED_VALUE_IN_ENUM,
  INVALID_VALUE,
  MIN_MAX,
  MISSING_TYPE,
  OUT_OF_RANGE,
  TEXT_REQUIRES_LOCALES,
  TYPE_MISMATCH,
  UNKNOWN_PROP,
  NOT_ALLOWED_IN_ITEMS,
} from './errors.js'
import type { SchemaParser } from './index.js'
import { getPropType } from './utils.js'
let stringFormatsSet: Set<string>
let numberDisplaysSet: Set<string>
let dateDisplaysSet: Set<string>

type PropsFns<PropType> = Record<
  string,
  (val, prop: PropType, ctx: SchemaParser, key?: string) => void
>
const STUB = {}
const shared: PropsFns<SchemaAnyProp> = {
  type() {},
  role(val) {
    expectString(val)
  },
  required(val, _prop, ctx) {
    if (ctx.isItems) {
      throw new Error(NOT_ALLOWED_IN_ITEMS)
    }
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
    if (t.type !== getPropType(prop)) {
      throw Error(TYPE_MISMATCH)
    }
  },
  title(val) {
    expectString(val)
  },
  description(val) {
    expectString(val)
  },
  readOnly(val) {
    expectBoolean(val)
  },
  examples(val) {
    expectString(val)
  },
  validation(val) {
    expectFunction(val)
  },
}

function propParser<PropType extends SchemaAnyProp>(
  required: PropsFns<PropType>,
  optional: PropsFns<PropType>,
  allowShorthand?: number,
) {
  return (prop, ctx: SchemaParser) => {
    if (typeof prop === 'string') {
      // allow string
      if (allowShorthand === 0) {
        return
      }
      throw Error(EXPECTED_OBJ)
    }

    if (Array.isArray(prop)) {
      // allow array
      if (allowShorthand === 1) {
        return
      }
      throw Error(EXPECTED_OBJ)
    }

    for (const key in required) {
      ctx.path[ctx.lvl] = key
      const changed = required[key](prop[key], prop, ctx)
      if (changed !== undefined) {
        prop[key] = changed
      }
    }

    for (const key in prop) {
      ctx.path[ctx.lvl] = key
      const val = prop[key]
      let changed
      if (key in optional) {
        changed = optional[key](val, prop, ctx)
      } else if (key in shared) {
        changed = shared[key](val, prop, ctx)
      } else if (!(key in required)) {
        if (key[0] === '$' && 'ref' in prop) {
          optional.edge(val, prop, ctx, key)
        } else {
          throw Error(UNKNOWN_PROP)
        }
      }
      if (changed !== undefined) {
        prop[key] = changed
      }
    }
  }
}

const p: Record<string, ReturnType<typeof propParser>> = {}

p.boolean = propParser<SchemaBoolean>(
  STUB,
  {
    default(val) {
      expectBoolean(val)
    },
  },
  0,
)

p.vector = propParser<SchemaVector>(
  {
    size(val) {
      expectNumber(val)
    },
  },
  {
    default(val) {
      expectFloat32Array(val)
    },
  },
  0,
)

p.enum = propParser<SchemaEnum>(
  {
    enum(items) {
      if (!Array.isArray(items)) {
        throw Error(EXPECTED_ARR)
      }
      if (items.length > 255) {
        throw Error('Max enum length (255) exceeded')
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
  1,
)

const numberOpts = {
  display(val) {
    expectString(val)
    numberDisplaysSet ??= new Set(numberDisplays)
    numberDisplaysSet.has(val)
  },
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
}

p.number = propParser<SchemaNumber>(STUB, numberOpts, 0)
p.int8 = propParser<SchemaNumber>(STUB, numberOpts, 0)
p.uint8 = propParser<SchemaNumber>(STUB, numberOpts, 0)
p.int16 = propParser<SchemaNumber>(STUB, numberOpts, 0)
p.uint16 = propParser<SchemaNumber>(STUB, numberOpts, 0)
p.int32 = propParser<SchemaNumber>(STUB, numberOpts, 0)
p.uint32 = propParser<SchemaNumber>(STUB, numberOpts, 0)

p.object = propParser<SchemaObject | SchemaObjectOneWay>(
  {
    props(val, prop, ctx) {
      ctx.parseProps(val, ctx.type)
    },
  },
  {
    default(val) {
      console.warn('TODO object default value')
    },
  },
)

p.set = propParser<SchemaSet>(
  {
    items(items, prop, ctx) {
      expectObject(items)
      const itemsType = getPropType(items)
      if (
        itemsType === 'string' ||
        itemsType === 'number' ||
        itemsType === 'timestamp' ||
        itemsType === 'boolean'
      ) {
        ctx.inQuery = 'query' in prop
        ctx.isItems = true
        p[itemsType](items, ctx)
        ctx.inQuery = false
        ctx.isItems = false
      } else {
        throw new Error(INVALID_VALUE)
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

p.references = propParser<SchemaReferences>(
  {
    items(items, prop, ctx) {
      expectObject(items)
      const itemsType = getPropType(items)
      if (itemsType === 'reference') {
        ctx.inQuery = 'query' in prop
        ctx.isItems = true
        p[itemsType](items, ctx)
        ctx.inQuery = false
        ctx.isItems = false
      } else {
        throw new Error(INVALID_VALUE)
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

const binaryOpts = {
  default(val) {
    expectString(val)
  },
  format(val) {
    expectString(val)
    stringFormatsSet ??= new Set(stringFormats)
    stringFormatsSet.has(val)
  },
  mime(val) {
    if (Array.isArray(val)) {
      val.forEach(expectString)
    } else {
      expectString(val)
    }
  },
  maxBytes(val) {
    expectNumber(val)
  },
  compression(val) {
    // return the actualy string!
    return val
  },
}

p.binary = propParser<SchemaString>(STUB, binaryOpts, 0)

p.string = propParser<SchemaString>(
  STUB,
  {
    ...binaryOpts,
    min(val) {
      expectNumber(val)
    },
    max(val) {
      expectNumber(val)
    },
  },
  0,
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
    format: binaryOpts.format,
    default(val, prop) {
      console.warn('MAKE DEFAULT VALUE FOR TEXT')
    },
  },
  0,
)

p.timestamp = propParser<SchemaTimestamp>(
  STUB,
  {
    display(val) {
      expectString(val)
      dateDisplaysSet ??= new Set(dateDisplays)
      dateDisplaysSet.has(val)
    },
    min(val) {
      if (typeof val !== 'string' && typeof val !== 'number') {
        throw Error(INVALID_VALUE)
      }
    },
    max(val) {
      if (typeof val !== 'string' && typeof val !== 'number') {
        throw Error(INVALID_VALUE)
      }
    },
    step(val) {
      if (typeof val !== 'string' && typeof val !== 'number') {
        throw Error(INVALID_VALUE)
      }
      if (typeof val === 'string' && val.includes('now')) {
        throw Error(INVALID_VALUE)
      }
    },
    default(val) {
      if (typeof val !== 'number' && !(val instanceof Date)) {
        throw Error(EXPECTED_DATE)
      }
    },
    on(val) {
      if (val !== 'create' && val !== 'update') {
        throw Error(INVALID_VALUE)
      }
    },
  },
  0,
)

p.reference = propParser<SchemaReference & SchemaReferenceOneWay>(
  {
    ref(ref, _prop, { schema }) {
      if (!schema.types[ref]?.props) {
        throw Error(MISSING_TYPE)
      }
    },
    prop(propKey, prop, { schema, type, inQuery, path }) {
      const propAllowed = type && !inQuery

      if (propAllowed) {
        expectString(propKey)

        const propPath = propKey.split('.')
        let targetProp: any = schema.types[prop.ref]

        expectObject(targetProp, 'expected type')

        let create
        for (const key of propPath) {
          if (!targetProp.props[key]) {
            create = true
            targetProp.props[key] = {}
          }
          targetProp = targetProp.props[key]
        }

        if (create) {
          const ref = path[1]
          let prop = ''
          for (let i = 3; i < path.length - 1; i += 2) {
            prop += prop ? `.${path[i]}` : path[i]
          }
          targetProp.readOnly = true
          targetProp.items = {
            ref,
            prop,
          }
        }

        if ('items' in targetProp) {
          targetProp = targetProp.items
        }

        if ('ref' in targetProp && 'prop' in targetProp) {
          const inversePath = targetProp.prop.split('.')
          let inverseProp: any = schema.types[targetProp.ref]
          for (const key of inversePath) {
            inverseProp = inverseProp.props[key]
          }
          if (inverseProp && 'items' in inverseProp) {
            inverseProp = inverseProp.items
          }

          if (prop === inverseProp) {
            return
          }
        }

        throw Error('expected inverse property')
      }

      if (propKey !== undefined) {
        throw Error('ref prop not supported on root or edge p')
      }
    },
  },
  {
    mime: binaryOpts.mime,
    default(val) {
      expectString(val)
    },
    edge(val, prop, ctx, key) {
      const edgeAllowed = ctx.type && !ctx.inQuery
      if (edgeAllowed) {
        let t: any = ctx.schema.types[prop.ref].props[prop.prop]
        t = t.items || t
        if (t[key] && t !== prop) {
          throw Error('Edge can not be defined on both props')
        }

        const edgePropType = getPropType(val)
        const inType = ctx.type
        ctx.type = null
        p[edgePropType](val, ctx)
        ctx.type = inType
        return
      }

      throw Error('ref edge not supported on root or edge property')
    },
    dependent(val, prop, ctx, key) {
      expectBoolean(val)
      const dependentAllowed = ctx.type && !ctx.inQuery
      if (!dependentAllowed) {
        throw Error('ref dependency not supported on root or edge property')
      }
    },
  },
)

p.alias = propParser<SchemaAlias>(
  STUB,
  {
    default(val) {
      expectString(val)
    },
    format: binaryOpts.format,
  },
  0,
)

p.cardinality = propParser<SchemaCardinality>(
  STUB,
  {
    default(val) {
      expectNumber(val)
    },
  },
  0,
)

p.json = propParser<SchemaJson>(
  STUB,
  {
    default(val) {
      expectObject(val)
    },
  },
  0,
)

export default p
