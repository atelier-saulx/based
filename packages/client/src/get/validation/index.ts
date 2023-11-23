import { getValueByPath, nonRecursiveWalker } from '../../util'

const checkArgumentProperties = (
  queryPart: any,
  argument: string,
  path: string[],
  allowedChildren: string[]
) => {
  if (Array.isArray(queryPart)) {
    for (let index = 0; index < queryPart.length; index++) {
      Object.keys(queryPart[index]).forEach((key) => {
        if (!allowedChildren.includes(key)) {
          throw new Error(
            `Query error: Invalid ${argument} property "${key}" at "${path
              .concat(String(index))
              .join('.')}".`
          )
        }
      })
    }
  } else {
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
}

const checkArgumentParent = (
  argument: string,
  path: string[],
  allowedParents: string[]
) => {
  let parent = path[path.length - 2]
  if (!isNaN(parseInt(parent))) {
    parent = path[path.length - 3]
  }
  if (path.length === 1 || !allowedParents.includes(parent)) {
    throw new Error(
      `Query error: Argument ${argument} cannot be a child of "${
        path.length === 1 ? 'root' : parent
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
  // const type = Array.isArray(queryPart) ? 'array' : typeof queryPart
  let type: string
  if (Array.isArray(queryPart)) {
    if (queryPart.every((item) => typeof item === 'string')) {
      type = 'string array'
    } else if (queryPart.every((item) => typeof item === 'object')) {
      type = 'object array'
    } else {
      type = 'array'
    }
  } else {
    type = typeof queryPart
  }
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

const checkArgumentRequiredProperties = (
  queryPart: any,
  argument: string,
  path: string[],
  requiredProperties: string[]
) => {
  if (Array.isArray(queryPart)) {
    for (let index = 0; index < queryPart.length; index++) {
      if (
        !requiredProperties.every((property) =>
          queryPart[index].hasOwnProperty(property)
        )
      ) {
        const properties = requiredProperties.map((property) => `"${property}"`)
        const requiredPropertiesString = [
          properties.slice(0, -1).join(', '),
          properties[properties.length - 1],
        ]
          .filter(Boolean)
          .join(' and ')
        throw new Error(
          `Query error: Argument ${argument} must have the required properties ${requiredPropertiesString} at "${path
            .concat(String(index))
            .join('.')}".`
        )
      }
    }
  } else {
    if (
      !requiredProperties.every((property) =>
        queryPart.hasOwnProperty(property)
      )
    ) {
      const properties = requiredProperties.map((property) => `"${property}"`)
      const requiredPropertiesString = [
        properties.slice(0, -1).join(', '),
        properties[properties.length - 1],
      ]
        .filter(Boolean)
        .join(' and ')
      throw new Error(
        `Query error: Argument ${argument} must have the required properties ${requiredPropertiesString} at "${path.join(
          '.'
        )}".`
      )
    }
  }
}

const listValidation = (query: any, path: string[]) => {
  const argument = '$list'
  const queryPart = getValueByPath(query, path)
  checkArgumentType(queryPart, argument, path, ['boolean', 'object'])
  checkArgumentProperties(queryPart, argument, path, [
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
  checkArgumentProperties(queryPart, argument, path, ['$field', '$order'])
  checkArgumentParent(argument, path, ['$list', '$aggregate'])
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
  checkArgumentProperties(queryPart, argument, path, [
    '$traverse',
    '$filter',
    '$recursive',
    '$find',
  ])
}

const traverseValidation = (query: any, path: string[]) => {
  const argument = '$traverse'
  const queryPart = getValueByPath(query, path)
  checkArgumentParent(argument, path, ['$find', '$aggregate'])
  checkArgumentType(queryPart, argument, path, [
    'string',
    'object',
    'string array',
  ])
}

const recursiveValidation = (query: any, path: string[]) => {
  const argument = '$recursive'
  const queryPart = getValueByPath(query, path)
  checkArgumentParent(argument, path, ['$find'])
  checkArgumentType(queryPart, argument, path, ['boolean'])
}

const filterValidation = (query: any, path: string[]) => {
  const argument = '$filter'
  const queryPart = getValueByPath(query, path)
  checkArgumentType(queryPart, argument, path, ['object', 'object array'])
  // checkArgumentParent(argument, path, ['$find', '$aggregate'])
  checkArgumentProperties(queryPart, argument, path, [
    '$field',
    '$operator',
    '$value',
  ])
  checkArgumentRequiredProperties(queryPart, argument, path, [
    '$field',
    '$operator',
  ])
}

const fieldValidation = (query: any, path: string[]) => {
  const argument = '$field'
  const queryPart = getValueByPath(query, path)
  checkArgumentType(queryPart, argument, path, ['string', 'string array'])
}

const operatorValidation = (query: any, path: string[]) => {
  const argument = '$operator'
  const queryPart = getValueByPath(query, path)
  checkArgumentParent(argument, path, ['$filter'])
  checkArgumentType(queryPart, argument, path, ['string'])
  checkArgumentValues(queryPart, argument, path, [
    '=',
    '>',
    '<',
    '..',
    '!=',
    'has',
    'includes',
    'distance',
    'exists',
    'notExists',
    'textSearch',
  ])
}

const valueValidation = (query: any, path: string[]) => {
  const argument = '$value'
  const queryPart = getValueByPath(query, path)
  const isInFilter =
    path.length > 2 &&
    (!isNaN(parseInt(path[path.length - 2])) ||
      path[path.length - 2] === '$filter')
  if (!isInFilter) {
    checkArgumentType(queryPart, argument, path, ['string'])
  }
}

const inheritValidation = (query: any, path: string[]) => {
  const argument = '$inherit'
  const queryPart = getValueByPath(query, path)
  checkArgumentType(queryPart, argument, path, ['boolean', 'object'])
}

const typeValidation = (query: any, path: string[]) => {
  const argument = '$type'
  const queryPart = getValueByPath(query, path)
  checkArgumentParent(argument, path, ['$inherit'])
  checkArgumentType(queryPart, argument, path, ['string', 'string array'])
}

// $aggregate

const functionValidation = (query: any, path: string[]) => {
  const allowedFunctionNames = [
    'sum',
    'avg',
    'min',
    'max',
    'countUnique',
    'count',
  ]
  const argument = '$function'
  const queryPart = getValueByPath(query, path)
  checkArgumentParent(argument, path, ['$aggregate'])
  checkArgumentType(queryPart, argument, path, ['string', 'object'])
  if (typeof queryPart === 'object') {
    checkArgumentProperties(queryPart, argument, path, ['$name', '$args'])
    checkArgumentRequiredProperties(queryPart, argument, path, ['$name'])
    checkArgumentValues(
      queryPart.$name,
      '$name',
      path.concat('$name'),
      allowedFunctionNames
    )
    if (queryPart.$args) {
      checkArgumentType(queryPart.$args, '$args', path.concat('$args'), [
        'string array',
      ])
    }
  } else {
    checkArgumentValues(queryPart, argument, path, allowedFunctionNames)
  }
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
        case '$recursive':
          recursiveValidation(query, path)
          break
        case '$filter':
          filterValidation(query, path)
          break
        case '$field':
          fieldValidation(query, path)
          break
        case '$operator':
          operatorValidation(query, path)
          break
        case '$value':
          valueValidation(query, path)
          break
        case '$inherit':
          inheritValidation(query, path)
          break
        case '$type':
          typeValidation(query, path)
          break
        // case '$aggregate':
        //   aggregateValidation(query, path)
        //   break
        case '$function':
          functionValidation(query, path)
          break
        default:
          break
      }
    },
    true
  )
}
