import { BasedSchema } from '../types'
import { ArgsClass } from './args'
import { Opts } from './types'

export const walk = async <T>(
  schema: BasedSchema,
  opts: Opts<T>,
  value: any
): Promise<T> => {
  if (!('collect' in opts)) {
    opts.collect = () => {}
  }

  if (!('error' in opts)) {
    opts.error = () => {}
  }

  const argsOpts = await opts.init(value, schema, opts.error)

  if (!argsOpts.value) {
    argsOpts.value = value
  }

  const args = new ArgsClass(argsOpts)
  args.root = args
  args._opts = opts
  args._schema = schema
  await args.parse()

  return args.target
}

export { ArgsClass }

export * from './types'
