import {
  never,
  object,
  objectWithRest,
  optional,
  pipe,
  string,
  transform,
  undefined,
  variant,
} from 'valibot'
import { prop, props } from './prop.js'
import { inspect } from 'util'

export const type = variant(
  'props',
  [
    pipe(
      string(),
      transform((props) => ({ props }), object({})),
    ),
    object({ props }),
    pipe(
      objectWithRest({ props: undefined() }, prop),
      transform((props) => ({ props })),
    ),
  ],
  ({ received, message, input }) => {
    if (received === 'Object') {
      return 'Invalid type: ' + inspect(input)
    }
    return message
  },
)
