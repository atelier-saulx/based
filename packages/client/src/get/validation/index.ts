import { getValueByPath, nonRecursiveWalker } from '../../util'

const LIST_ALOWED_CHILDREN = ['$find', '$sort', '$offset', '$limit']
const listValidation = (query: any, path: string[]) => {
  const queryPart = getValueByPath(query, path)
  Object.keys(queryPart).forEach((key) => {
    if (!LIST_ALOWED_CHILDREN.includes(key)) {
      throw new Error(
        `Query error: Invalid $list property "${key}" at "${path.join('.')}".`
      )
    }
  })
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

        default:
          break
      }
    },
    true
  )
}
