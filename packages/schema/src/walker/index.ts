import { ParseError } from '../set/error'
import { BasedSchema } from '../types'
import { ArgsClass } from './args'
import { Opts } from './types'

export const walk = async <T>(
  schema: BasedSchema,
  opts: Opts<T>,
  value: any
): Promise<{
  target: T
  errors: { code: ParseError; message: string }[]
}> => {
  const errors: { code: ParseError; message: string }[] = []

  if (!('collect' in opts)) {
    opts.collect = () => {}
  }

  // make this better and faster
  const optsError = opts.errorsCollector
  opts.errorsCollector = (args, code) => {
    const err = {
      code,
      message: `Error: ${ParseError[code]} - "${
        args.path.length === 0 ? 'top' : args.path.join('.')
      }"`,
    }
    if (optsError) {
      optsError(args, code)
    }
    errors.push(err)
  }

  const argsOpts = await opts.init(value, schema, (code) => {
    const err = {
      code,
      message: `Error: ${ParseError[code]} - "top"`,
    }
    if (optsError) {
      optsError(new ArgsClass({ path: [] }), code)
    }
    errors.push(err)
  })

  if (!argsOpts) {
    return {
      target: <T>{},
      errors,
    }
  }

  if (!argsOpts.value) {
    argsOpts.value = value
  }
  const args = new ArgsClass(argsOpts)
  args.root = args
  args._opts = opts
  args._schema = schema
  await args.parse()

  return {
    target: args.target,
    errors,
  }
}

export { ArgsClass }

export * from './types'
