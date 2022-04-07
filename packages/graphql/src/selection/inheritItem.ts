import { GetOptions } from '@based/types'
import { FieldNode, FragmentDefinitionNode, Kind } from 'graphql'
import { fieldToGetPayload, selectionSetToGet } from '.'
import { GQLExecCtx } from '..'
import { parseDirectives } from '../directives'
import { getSelvaTypeName } from '../util'
import { makeValue } from './value'

export function makeInheritItem(
  ctx: GQLExecCtx,
  type: string,
  graphqlAst: FieldNode,
  fragments: Record<string, FragmentDefinitionNode>,
  variables: Record<string, any> = {}
): GetOptions {
  const refGetOpts: GetOptions = {}

  const selections = graphqlAst.selectionSet

  const typeFilter: Set<string> = new Set()
  for (const field of selections.selections) {
    if (field.kind === 'InlineFragment') {
      const typeName = getSelvaTypeName(ctx, field.typeCondition.name.value)
      typeFilter.add(typeName)
      const nestedOpts = selectionSetToGet(
        ctx,
        typeName,
        field.selectionSet,
        variables
      )

      if (!refGetOpts.$fieldsByType) {
        refGetOpts.$fieldsByType = {}
      }

      refGetOpts.$fieldsByType[typeName] = nestedOpts
    } else {
      if (field.kind !== Kind.FIELD) {
        return undefined
      }

      let alias = field?.alias?.value
      let name = field.name.value
      const directives = parseDirectives(field.directives)

      // FIXME: fix being able to query __typename
      if (name === '__typename') {
        name = 'type'
        if (!alias) {
          alias = 'type'
        }
      } else if (name === '_all') {
        if (directives.default) {
          refGetOpts.$default = directives.default
        } else {
          refGetOpts.$all = true
        }
      } else if (name === '_value' && alias) {
        refGetOpts[alias] = makeValue(field)
      } else {
        // FIXME: weird that I use the type itself... but for now this only selects Node interface fields
        refGetOpts[alias || name] = fieldToGetPayload(
          ctx,
          directives,
          type,
          field,
          fragments,
          variables,
          `.${name}`
        )
      }
    }
  }

  if (!typeFilter.size) {
    return undefined
  }

  refGetOpts.$inherit = { $item: [...typeFilter] }
  return refGetOpts
}
