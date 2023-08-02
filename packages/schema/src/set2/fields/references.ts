import { ParseError } from '../../set/error'
import { FieldParser } from '../../walker'
import { isValidId } from '../isValidId'

export const reference: FieldParser<'reference'> = async (args) => {
  // TODO: setting an object here , handling $alias (both async hooks)

  if (!isValidId(args.schema, args.value)) {
    args.error(ParseError.incorrectFormat)
    return
  }

  if ('allowedTypes' in args.fieldSchema) {
    const prefix = args.value.slice(0, 2)
    const targetType = args.schema.prefixToTypeMapping[prefix]
    if (!targetType) {
      args.error(ParseError.referenceIsIncorrectType)
      return
    }
    let typeMatches = false
    for (const t of args.fieldSchema.allowedTypes) {
      if (typeof t === 'string') {
        if (t === targetType) {
          typeMatches = true
          break
        }
      } else {
        if (t.type && t.type === targetType) {
          typeMatches = true
          if (t.$filter) {
            // ASYNC HOOK
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
      args.error(ParseError.referenceIsIncorrectType)
      return
    }
  }

  args.collect()
}

export const references: FieldParser<'references'> = async (args) => {
  const { value, error, fieldSchema, target } = args

  if (Array.isArray(value)) {
    await Promise.all(
      value.map((v, i) => {
        console.log(v, i)
        reference(v)
      })
    )
  }
  // if (Array.isArray(value)) {
  //     await Promise.all(
  //       value.map((v, i) => {
  //         return reference(
  //           [...path, i],
  //           v,
  //           // not nice slow
  //           { ...fieldSchema, type: 'reference' },
  //           typeSchema,
  //           target,
  //           handlers,
  //           true
  //         )
  //       })
  //     )
  //     value = { $value: value }
  //   } else if (typeof value === 'object') {
  //     if (value.$add) {
  //       await Promise.all(
  //         value.$add.map((v, i) => {
  //           return reference(
  //             [...path, '$add', i],
  //             v,
  //             // not nice slow
  //             { ...fieldSchema, type: 'reference' },
  //             typeSchema,
  //             target,
  //             handlers,
  //             true
  //           )
  //         })
  //       )
  //     }
  //   } else {
  //     error(handlers, ParseError.incorrectFormat, path)
  //   }
}
