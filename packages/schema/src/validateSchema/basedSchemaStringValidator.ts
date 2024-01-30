import {
  BasedSchemaContentMediaType,
  BasedSchemaStringShared,
} from '../types.js'
import { Validator } from './index.js'
import { mustBeNumber, mustBeString } from './utils.js'

export const basedSchemaStringSharedValidator: Validator<BasedSchemaStringShared> =
  {
    minLength: {
      validator: mustBeNumber,
      optional: true,
    },
    maxLength: {
      validator: mustBeNumber,
      optional: true,
    },
    contentMediaEncoding: {
      validator: mustBeString,
      optional: true,
    },
    contentMediaType: {
      // validator: (value, path) => /^{} // FIXME: COntinue heree -----------
      optional: true,
    },
    pattern: { optional: true },
    format: { optional: true },
    display: { optional: true },
    multiline: { optional: true },
  }
