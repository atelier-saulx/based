import { Schema, SchemaProp } from '../types.js'
import { ERRORS } from './errors.js'

export const isNotObject = (obj) => typeof obj !== 'object' || obj === null

type PropValidators<PropType extends SchemaProp> = Record<
  string,
  (val: any, prop: PropType, schema: Schema, rootOrEdgeProps: boolean) => void
>

export class PropParser<PropType extends SchemaProp> {
  constructor(
    validators: PropValidators<PropType>,
    optionalValidators: PropValidators<PropType>,
  ) {
    this.validators = validators
    Object.assign(this.optionalValidators, optionalValidators)
  }

  validators: PropValidators<PropType>
  optionalValidators: PropValidators<PropType> = {
    type() {},
    required(val) {
      if (typeof val !== 'boolean') {
        throw Error(ERRORS.EXPECTED_BOOL)
      }
    },
  }

  parse(prop: PropType, schema: Schema, rootOrEdgeProps: boolean) {
    let key
    try {
      for (key in this.validators) {
        this.validators[key](prop[key], prop, schema, rootOrEdgeProps)
      }

      for (key in prop) {
        if (key in this.validators) {
          continue
        }

        if (key in this.optionalValidators) {
          this.optionalValidators[key](prop[key], prop, schema, rootOrEdgeProps)
          continue
        }

        throw Error(ERRORS.UNKNOWN_PROP)
      }
    } catch (e) {
      e.cause = { obj: prop, key }
      throw e
    }
  }
}

export const getPropType = (prop) => {
  if (prop.type) {
    return prop.type
  }
  if ('ref' in prop) {
    return 'reference'
  }
  if ('items' in prop) {
    return 'set'
  }
  if ('enum' in prop) {
    return 'enum'
  }
  throw Error(ERRORS.MISSING_TYPE)
}
