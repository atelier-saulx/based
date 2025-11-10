import { never, object, pipe, transform, union } from 'valibot'
import { props } from './prop.js'

const schema = object({
  props,
})

const shorthand = pipe(
  union([object({ props: never() }), props]),
  transform((props) => ({ props })),
)

export const type = union([shorthand, schema])
