import { GetOptions } from '@based/types'
import { FieldNode, FragmentDefinitionNode } from 'graphql'
import { GQLExecCtx } from '..'
import { makeAggregate } from './aggregate'
import { tryDirectiveOptions } from './directives'
import { makeInherit } from './inherit'
import { makeInheritItem } from './inheritItem'
import { makeValue } from './value'

export function trySpecialFields(
  ctx: GQLExecCtx,
  type: string,
  { name, alias }: { name: string; alias: string },
  field: FieldNode,
  directives: Record<string, any>,
  fragments: Record<string, FragmentDefinitionNode>,
  variables: Record<string, any>,
  getOptions: GetOptions
): boolean {
  if (name === '__typename') {
    getOptions.__typename = { $field: 'type' }
  } else if (name === '_all') {
    if (!tryDirectiveOptions(getOptions, directives)) {
      getOptions.$all = true
    }
  } else if (name === '_value' && alias) {
    getOptions[alias] = makeValue(field)
  } else if (name === '_aggregate' && alias) {
    getOptions[alias] = makeAggregate(field, variables)
  } else if (name === '_inherit' && alias) {
    getOptions[alias] = makeInherit(field)
  } else if (name === '_inheritItem' && alias) {
    getOptions[alias] = makeInheritItem(ctx, type, field, fragments, variables)
  } else {
    return false
  }

  return true
}
