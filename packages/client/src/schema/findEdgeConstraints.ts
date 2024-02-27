import { joinPath } from '../util/index.js'

type EdgeConstraint = {
  prefix: string
  isSingle: boolean
  arrayMode: boolean
  field: string
  bidirectional: { fromField: string }
}

export const findEdgeConstraints = (
  prefix: string,
  path: string[],
  typeSchema: any,
  constraints: EdgeConstraint[]
): void => {
  if (typeSchema.fields) {
    for (const field in typeSchema.fields) {
      findEdgeConstraints(
        prefix,
        [field],
        typeSchema.fields[field],
        constraints
      )
    }
  }

  if (typeSchema.properties) {
    for (const field in typeSchema.properties) {
      findEdgeConstraints(
        prefix,
        [...path, field],
        typeSchema.properties[field],
        constraints
      )
    }
  }

  if (typeSchema.values) {
    findEdgeConstraints(prefix, [...path, '*'], typeSchema.values, constraints)
  }

  if (typeSchema.items) {
    findEdgeConstraints(prefix, [...path, '*'], typeSchema.items, constraints)
  }

  if (!['reference', 'references'].includes(typeSchema.type)) {
    return
  }

  const ref = {
    prefix,
    bidirectional: typeSchema.bidirectional
      ? { fromField: typeSchema?.bidirectional?.fromField }
      : undefined,
    isSingle: typeSchema.type === 'reference',
    arrayMode: typeSchema?.sortable,
    field: joinPath(path),
  }

  if (!ref.bidirectional && !ref.isSingle) {
    return
  }

  constraints.push(ref)
}
