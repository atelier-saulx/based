import { BasedSchema } from '../types.js'
import { ArgsClass } from './args'
import { AsyncOperation, Opts } from './types'

export const walk = async <T>(
  schema: BasedSchema,
  opts: Opts<T>,
  value: any,
  asyncOperationHandler?: AsyncOperation<T>
): Promise<T> => {
  if (!('collect' in opts)) {
    opts.collect = () => {}
  }

  if (!('error' in opts)) {
    opts.error = () => {}
  }

  if (asyncOperationHandler) {
    opts = {
      ...opts,
      asyncOperationHandler,
    }
  }

  const argsOpts = await opts.init(value, schema, opts.error)

  if (!argsOpts) {
    return <T>{}
  }

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
