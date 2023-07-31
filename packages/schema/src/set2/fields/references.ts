import { ParseError } from '../../set/error'
import { FieldParser } from '../../walker'

export const reference: FieldParser<'reference'> = async (args) => {
  const { value, error, fieldSchema, target } = args

  if (typeof value !== 'string') {
    error(args, ParseError.incorrectFormat)
    return
  }

  if ('allowedTypes' in fieldSchema) {
    const prefix = value.slice(0, 2)
    const targetType = target.schema.prefixToTypeMapping[prefix]
    if (!targetType) {
      error(args, ParseError.referenceIsIncorrectType)
      return
    }
    let typeMatches = false
    for (const t of fieldSchema.allowedTypes) {
      if (typeof t === 'string') {
        if (t === targetType) {
          typeMatches = true
          break
        }
      } else {
        if (t.type && t.type === targetType) {
          typeMatches = true
          if (t.$filter) {
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
      error(args, ParseError.referenceIsIncorrectType)
    }
  }
  args.collect(args)
}

export const references: FieldParser<'references'> = async (args) => {
  const { value, error, fieldSchema, target } = args
  console.log(args.typeSchema)
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
