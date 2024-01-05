import { ParseError } from '../../error.js'
import { BasedSetTarget } from '../../types.js'
import { ArgsClass, FieldParser } from '../../walker/index.js'
import { isValidId } from '../isValidId.js'

async function parseOperator<T>(
  args: ArgsClass<T, 'references'>,
  key: string
): Promise<any[]> {
  if (Array.isArray(args.value[key])) {
    const n = args.create({
      key,
      skipCollection: true,
      value: args.value[key],
    })
    await n.parse()

    if (n.value?.$value) {
      return n.value.$value
    }
    return []
  }
  const n = <ArgsClass<BasedSetTarget, 'reference'>>args.create({
    value: args.value[key],
    key,
    skipCollection: true,
  })
  await reference(n)
  return [n.value]
}

const typeIsAllowed = (
  args: ArgsClass<BasedSetTarget, 'reference'>,
  type: string
): boolean => {
  if ('allowedTypes' in args.fieldSchema) {
    let typeMatches = false
    for (const t of args.fieldSchema.allowedTypes) {
      if (typeof t === 'string') {
        if (t === type) {
          return true
        }
      } else {
        if (t.type && t.type === type) {
          typeMatches = true
          if (t.$filter) {
            // stage on requires validation in target
            // TODO: ASYNC REQUIRED HOOK
            // if(!(await args.target.referenceFilterCondition(value, t.$filter))){
            //     error(args, ParseError.referenceIsIncorrectType)
            //     return
            // }
          }
        } else if (!t.type && t.$filter) {
          // if(!(await args.target.referenceFilterCondition))
          // error(args, ParseError.referenceIsIncorrectType, )
          // return
        }
      }
    }
    if (typeMatches === false) {
      return false
    }
  }
  return true
}

export const reference: FieldParser<'reference'> = async (args) => {
  // TODO: setting an object here , handling $alias (both async hooks)
  // Block if path contains $remove (maybe not for $alias)
  if (typeof args.value === 'object') {
    if (args.root._opts.asyncOperationHandler) {
      if (args.value.type && !typeIsAllowed(args, args.value.type)) {
        args.error(ParseError.referenceIsIncorrectType)
        return
      }
      if (!args.target.errors.length) {
        args.value = await args.root._opts.asyncOperationHandler(
          args,
          'modifyObject'
        )
      }
    } else {
      args.error(ParseError.nestedModifyObjectNotAllowed)
      return
    }
  }

  if (!isValidId(args.schema, args.value)) {
    args.error(ParseError.incorrectFormat)
    return
  }

  const prefix = args.value.slice(0, 2)
  const targetType = args.schema.prefixToTypeMapping[prefix]

  if (typeIsAllowed(args, targetType)) {
    args.collect()
  } else {
    args.error(ParseError.referenceIsIncorrectType)
  }
}

export const references: FieldParser<'references'> = async (args) => {
  const { value } = args

  if (typeof value !== 'object' || value === null) {
    args.error(ParseError.incorrectFormat)
    return
  }

  args.stop()

  if (Array.isArray(value)) {
    const parseValues = await Promise.all(
      value.map(async (id, key) => {
        const n = <ArgsClass<BasedSetTarget, 'reference'>>args.create({
          value: id,
          key,
          skipCollection: true,
        })
        await reference(n)
        return n.value
      })
    )
    args.value = { $value: parseValues }
  } else {
    for (const key in args.value) {
      if (key === '$add') {
        args.value.$add = await parseOperator(args, key)
      } else if (key === '$remove') {
        args.value.$remove = await parseOperator(args, key)
      } else {
        args.create({ key }).error(ParseError.fieldDoesNotExist)
      }
    }
  }

  args.collect()
}
