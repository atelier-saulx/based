import { fieldsExpr2rpn } from '@based/db-query'
import { joinPath } from '../../util'
import { ExecContext, Field, Fields } from '../types'

function getField(field: Field): { str: string; isInherit: boolean } {
  let str = joinPath(field.field)

  if (field?.aliased?.length) {
    str = str + '@' + field.aliased.join('|')
  }

  if (field.inherit) {
    const types = field.inherit.types
    str = `^${types.join(',')}:` + str
  }

  if (field.exclude) {
    str = '!' + str
  }

  return { str, isInherit: !!field.inherit }
}

function getFieldsStr(fields: Field[]): { fields: string; isInherit: boolean } {
  const hasWildcard = fields.some(({ field }) => {
    return field[0] === '*'
  })

  const strs: string[] = []
  if (hasWildcard) {
    for (const f of fields) {
      const [first, ...rest] = f.field
      if (rest.length) {
        const { str } = getField({
          type: 'field',
          field: [first],
          exclude: true,
        })
        strs.push(str)
      }
    }
  }

  let hasInherit = false
  for (const f of fields) {
    const { str, isInherit } = getField(f)

    strs.push(str)
    hasInherit = hasInherit || isInherit
  }

  return { fields: strs.join('\n'), isInherit: hasInherit }
}

function getSimpleFieldsStr(fields: Field[]): string {
  const strs: Set<string> = new Set()
  for (const f of fields) {
    if (f.aliased) {
      f.aliased.forEach((f) => strs.add(f))
    } else if (!f.exclude) {
      strs.add(joinPath(f.field))
    }
  }

  return [...strs].join('\n')
}

export function getFields(
  ctx: ExecContext,
  { $any, byType }: Fields
): {
  isRpn: boolean
  isInherit: boolean
  fields: string
  strFields: string
} {
  if (!$any) {
    console.error('$any is undefined')
  }
  if (byType) {
    let hasTypes = false
    const { fields: anyFields, isInherit } = getFieldsStr($any!)
    const expr: Record<string, string> = { $any: anyFields }
    let hasInherit = isInherit
    const allFields: Field[] = $any!
    for (const type in byType) {
      hasTypes = true
      const { fields, isInherit } = getFieldsStr([...$any!, ...byType[type]])
      expr[type] = fields
      hasInherit = hasInherit || isInherit
      allFields.push(...byType[type])
    }

    if (!hasTypes && !hasInherit) {
      return {
        isRpn: false,
        fields: expr.$any,
        isInherit: false,
        // strFields: expr.$any,
        strFields: getSimpleFieldsStr($any!),
      }
    }

    return {
      isRpn: true,
      isInherit: hasInherit,
      fields: fieldsExpr2rpn(ctx.client.schema.types, expr),
      // strFields: getFieldsStr(allFields.filter((f) => !f.exclude)).fields,
      strFields: getSimpleFieldsStr(allFields.filter((f) => !f.exclude)),
    }
  }

  const { fields, isInherit } = getFieldsStr($any!)
  return {
    isRpn: false,
    fields: isInherit ? `"${fields}"` : fields,
    // strFields: fields,
    strFields: getSimpleFieldsStr($any!),
    isInherit,
  }
}
