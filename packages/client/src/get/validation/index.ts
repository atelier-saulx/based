import { getValueByPath, nonRecursiveWalker } from '../../util'

const checkArgumentChildren = (
  queryPart: any,
  argument: string,
  path: string[],
  allowedChildren: string[]
) => {
  Object.keys(queryPart).forEach((key) => {
    if (!allowedChildren.includes(key)) {
      throw new Error(
        `Query error: Invalid ${argument} property "${key}" at "${path.join(
          '.'
        )}".`
      )
    }
  })
}

const checkArgumentParent = (
  argument: string,
  path: string[],
  allowedParents: string[]
) => {
  if (path.length === 1 || !allowedParents.includes(path[path.length - 2])) {
    throw new Error(
      `Query error: Argument ${argument} cannot be a child of "${
        path.length === 1 ? 'root' : path[path.length - 2]
      }" at "${path.join('.')}".`
    )
  }
}

const checkArgumentValues = (
  queryPart: any,
  argument: string,
  path: string[],
  allowedValues: string[]
) => {
  if (!allowedValues.includes(queryPart)) {
    throw new Error(
      `Query error: Invalid ${argument} argument value "${String(
        queryPart
      )}" at "${path.join('.')}".`
    )
  }
}

const checkArgumentType = (
  queryPart: any,
  argument: string,
  path: string[],
  allowedTypes: string[]
) => {
  const type = Array.isArray(queryPart) ? 'array' : typeof queryPart
  if (!allowedTypes.includes(type)) {
    throw new Error(
      `Query error: Argument ${argument} must be of type ${
        allowedTypes.length > 1
          ? `${allowedTypes.join(' or ')}`
          : `${allowedTypes[0]}`
      } at "${path.join('.')}".`
    )
  }
}

const listValidation = (query: any, path: string[]) => {
  const argument = '$list'
  const queryPart = getValueByPath(query, path)
  checkArgumentType(queryPart, argument, path, ['object'])
  checkArgumentChildren(queryPart, argument, path, [
    '$find',
    '$sort',
    '$offset',
    '$limit',
  ])
}

const sortValidation = (query: any, path: string[]) => {
  const argument = '$sort'
  const queryPart = getValueByPath(query, path)
  checkArgumentType(queryPart, argument, path, ['object'])
  checkArgumentChildren(queryPart, argument, path, ['$field', '$order'])
  checkArgumentParent(argument, path, ['$list'])
}

const orderValidation = (query: any, path: string[]) => {
  const argument = '$order'
  const queryPart = getValueByPath(query, path)
  checkArgumentParent(argument, path, ['$sort'])
  checkArgumentType(queryPart, argument, path, ['string'])
  checkArgumentValues(queryPart, argument, path, ['asc', 'desc'])
}

const findValidation = (query: any, path: string[]) => {
  const argument = '$find'
  const queryPart = getValueByPath(query, path)
  checkArgumentType(queryPart, argument, path, ['object'])
  checkArgumentChildren(queryPart, argument, path, ['$traverse', '$filter'])
}

const traverseValidation = (query: any, path: string[]) => {
  const argument = '$traverse'
  const queryPart = getValueByPath(query, path)
  checkArgumentParent(argument, path, ['$find'])
  checkArgumentType(queryPart, argument, path, ['string', 'array'])
}

export const getQueryValidation = (query: any) => {
  nonRecursiveWalker(
    query,
    (_target, path, _type) => {
      const key = path[path.length - 1]
      switch (key) {
        case '$list':
          listValidation(query, path)
          break
        case '$sort':
          sortValidation(query, path)
          break
        case '$order':
          orderValidation(query, path)
          break
        case '$find':
          findValidation(query, path)
          break
        case '$traverse':
          traverseValidation(query, path)
          break
        default:
          break
      }
    },
    true
  )
}
