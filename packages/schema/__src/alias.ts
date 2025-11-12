import { literal, object, pipe, transform, union } from 'valibot'
import { stringOpts } from './string.js'

const type = literal('alias')
const schema = object({
  ...stringOpts.entries,
  type,
})
const shorthand = pipe(
  type,
  transform((type) => ({ type })),
)

export const alias = union([shorthand, schema])

// export const alias =
