import { GetOptions } from '../types'
import {
  FieldNode,
  FragmentDefinitionNode,
  Kind,
  SelectionSetNode,
} from 'graphql'
import { GQLExecCtx } from '..'
import { parseDirectives } from '../directives'
import { getNestedSchema, getSelvaTypeName } from '../util'
import { tryDirectiveOptions } from './directives'
import { filterToFindFilter } from './filter'
import { compileSort } from './sort'
import { trySpecialFields } from './specialFields'

export function selectionSetToGet(
  ctx: GQLExecCtx,
  type: string,
  graphqlAst: SelectionSetNode,
  fragments: Record<string, FragmentDefinitionNode>,
  variables = {},
  path = ''
): GetOptions {
  const payload: GetOptions = {}
  for (const field of graphqlAst.selections) {
    if (field.kind === 'InlineFragment') {
      const typeName = getSelvaTypeName(ctx, field.typeCondition.name.value)
      if (typeName !== type) {
        continue
      }

      for (const subField of field.selectionSet.selections) {
        if (subField.kind !== Kind.FIELD) {
          continue
        }

        const alias = subField?.alias?.value
        const name = subField.name.value

        const fieldPath = `${path}.${name}`
        const opts = fieldToGetPayload(
          ctx,
          parseDirectives(subField.directives),
          type,
          subField,
          fragments,
          variables,
          fieldPath
        )

        if (opts !== undefined) {
          payload[alias || name] = opts
        }
      }

      continue
    } else if (field.kind === Kind.FRAGMENT_SPREAD) {
      const frag = fragments[field.name.value]
      if (!frag) {
        continue
      }

      let typeName = getSelvaTypeName(ctx, frag.typeCondition.name.value)
      if (typeName === 'node') {
        typeName = type
      }

      if (typeName !== type) {
        continue
      }

      for (const subField of frag.selectionSet.selections) {
        if (subField.kind !== Kind.FIELD) {
          continue
        }

        const alias = subField?.alias?.value
        const name = subField.name.value

        const directives = parseDirectives(subField.directives)

        if (
          trySpecialFields(
            ctx,
            type,
            { name, alias },
            subField,
            directives,
            fragments,
            variables,
            payload
          )
        ) {
          continue
        }

        const fieldPath = `${path}.${name}`
        const opts = fieldToGetPayload(
          ctx,
          parseDirectives(subField.directives),
          type,
          subField,
          fragments,
          variables,
          fieldPath
        )

        if (opts !== undefined) {
          payload[alias || name] = opts
        }
      }
      continue
    }

    const alias = field?.alias?.value
    const name = field.name.value
    const directives = parseDirectives(field.directives)

    if (
      trySpecialFields(
        ctx,
        type,
        { name, alias },
        field,
        directives,
        fragments,
        variables,
        payload
      )
    ) {
      continue
    }

    const fieldPath = `${path}.${name}`
    const opts = fieldToGetPayload(
      ctx,
      directives,
      type,
      field,
      fragments,
      variables,
      fieldPath
    )

    if (opts !== undefined) {
      payload[alias || name] = opts
    }
  }

  return payload
}

export function fieldToGetPayload(
  ctx: GQLExecCtx,
  directives: Record<string, any>,
  type: string,
  graphqlAst: FieldNode,
  fragments: Record<string, FragmentDefinitionNode>,
  variables: Record<string, any> = {},
  path: string = ''
) {
  if (graphqlAst.kind !== Kind.FIELD) {
    return undefined
  }

  // TODO: make a shortcut if only id field is selected, since we don't need a traversal??
  let fieldSchema = getNestedSchema(ctx, type, path)

  if (!fieldSchema) {
    const name: string = graphqlAst.name.value
    if (name === '_traverse') {
      // FIXME: ? needs fixing? -- used to be by_type
      fieldSchema = { type: 'references' }
    } else {
      return undefined
    }
  }

  if (graphqlAst.selectionSet) {
    let name: any = graphqlAst.name.value
    // const alias = graphqlAst?.alias?.value
    const args = graphqlAst.arguments
    let recursive = null
    const selections = graphqlAst.selectionSet

    let filterAst = null
    let sortAst = null
    for (const arg of args) {
      if (arg?.name?.value === 'traverse') {
        if (arg?.value?.kind !== 'ObjectValue') {
          continue
        }

        name = {}
        const map = arg?.value?.fields
        for (const o of map) {
          if (o?.value?.kind !== 'ObjectValue') {
            continue
          }

          const t = o?.name?.value
          const tFields = o?.value?.fields[0]
          const tDir = tFields?.name?.value
          if (!['all', 'first'].includes(tDir)) {
            throw new Error(`Unsupported field for _traverse.traverse ${tDir}`)
          }

          if (tFields?.value?.kind !== 'ListValue') {
            continue
          }

          const nvalues =
            tFields?.value?.values.map((x) => (x as any)?.value) || []
          const nkey = t === '_any' ? '$any' : t

          if (nvalues.length) {
            name[nkey] = {
              [`$${tDir}`]: nvalues,
            }
          } else {
            name[nkey] = false
          }
        }

        if (!name.$any) {
          name.$any = false
        }
      } else if (arg?.name?.value === 'filter') {
        filterAst = arg
      } else if (arg?.name?.value === 'sortBy') {
        sortAst = arg
      } else if (
        arg?.name?.value === 'recursive' &&
        arg?.value?.kind === 'BooleanValue'
      ) {
        recursive = arg?.value?.value
      } else {
        throw new Error(`Unsupported arg for _traverse ${arg?.name?.value}`)
      }
    }

    const refGetOpts: GetOptions = {}
    switch (fieldSchema.type) {
      case 'references':
        let hasNonInline = false
        const typeFilter: Set<string> = new Set()
        for (const field of selections.selections) {
          if (field.kind === 'InlineFragment') {
            const typeName = getSelvaTypeName(
              ctx,
              field.typeCondition.name.value
            )
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
          } else if (field.kind === Kind.FRAGMENT_SPREAD) {
            const frag = fragments[field.name.value]
            if (!frag) {
              continue
            }

            const typeName = getSelvaTypeName(
              ctx,
              frag.typeCondition.name.value
            )
            typeFilter.add(typeName)
            const nestedOpts = selectionSetToGet(
              ctx,
              typeName,
              frag.selectionSet,
              variables
            )

            if (!refGetOpts.$fieldsByType) {
              refGetOpts.$fieldsByType = {}
            }

            refGetOpts.$fieldsByType[typeName] = nestedOpts
          } else {
            if (field.kind !== Kind.FIELD) {
              continue
            }

            hasNonInline = true
            const alias = field?.alias?.value
            const name = field.name.value
            const directives = parseDirectives(field.directives)

            if (
              !trySpecialFields(
                ctx,
                type,
                { name, alias },
                field,
                fragments,
                directives,
                variables,
                refGetOpts
              )
            ) {
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

        refGetOpts.$list = { $find: { $traverse: name } }

        const filter = filterToFindFilter(
          filterAst,
          hasNonInline ? new Set() : typeFilter,
          variables
        )

        const sortBy = compileSort(sortAst, variables)

        if (filter) {
          refGetOpts.$list.$find.$filter = filter
        }

        if (sortBy) {
          refGetOpts.$list.$sort = sortBy
        }

        if (recursive !== null) {
          // TODO
          // @ts-ignore
          refGetOpts.$list.$find.$recursive = recursive
        }

        return refGetOpts
      case 'reference':
        for (const field of selections.selections) {
          if (field.kind === 'InlineFragment') {
            const typeName = getSelvaTypeName(
              ctx,
              field.typeCondition.name.value
            )
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
          } else if (field.kind === Kind.FRAGMENT_SPREAD) {
            const frag = fragments[field.name.value]
            if (!frag) {
              continue
            }

            const typeName = getSelvaTypeName(
              ctx,
              frag.typeCondition.name.value
            )
            typeFilter.add(typeName)
            const nestedOpts = selectionSetToGet(
              ctx,
              typeName,
              frag.selectionSet,
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

            const alias = field?.alias?.value
            const name = field.name.value
            const directives = parseDirectives(field.directives)

            if (
              !trySpecialFields(
                ctx,
                type,
                { name, alias },
                field,
                directives,
                fragments,
                variables,
                refGetOpts
              )
            ) {
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
        return refGetOpts
      case 'object':
        return selectionSetToGet(
          ctx,
          type,
          graphqlAst.selectionSet,
          variables,
          path
        )
      default:
        const alias = graphqlAst?.alias?.value
        if (alias) {
          return {
            $field: path.slice(1),
          }
        }
        return true
    }
  }

  // const alias = graphqlAst?.alias?.value
  // const name = graphqlAst.name.value
  const payload: GetOptions = { $field: path.slice(1) }

  tryDirectiveOptions(payload, directives)

  return payload
}
