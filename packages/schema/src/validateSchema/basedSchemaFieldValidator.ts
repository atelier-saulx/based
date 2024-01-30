import { BasedSchemaField } from '../types.js'
import { Validator } from './index.js'
import { mustBeString } from './utils.js'

export const basedSchemaFieldValidator: Validator<BasedSchemaField> = {
  type: {},

  display: { optional: true },

  format: { optional: true },

  enum: {},

  values: {},

  properties: {},
  required: { optional: true },

  items: {},

  bidirectional: { optional: true },
  allowedTypes: { optional: true },
  sortable: { optional: true },

  isRequired: { optional: true },
  $ref: {
    validator: mustBeString,
  },

  hooks: { optional: true },
  $id: { optional: true },
  $schema: { optional: true },
  title: { optional: true },
  description: { optional: true },
  index: { optional: true },
  readOnly: { optional: true },
  writeOnly: { optional: true },
  $comment: { optional: true },
  examples: { optional: true },
  default: { optional: true },
  customValidator: { optional: true },
  $defs: { optional: true },
  $delete: { optional: true },
}
