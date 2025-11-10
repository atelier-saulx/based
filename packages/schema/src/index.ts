import { safeParse, type InferInput, type InferOutput } from 'valibot'
import { schema } from './schema.js'

type In = InferInput<typeof schema>
type Out = InferOutput<typeof schema>

export type Schema = In
export const parse = (def: In): Out => {
  const { output, success, issues } = safeParse(schema, def)
  if (success) {
    return output
  } else {
    console.info(issues)
    throw 'err!!'
  }
}
