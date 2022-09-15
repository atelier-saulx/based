import qs from 'node:querystring'

type QueryValue = string | number | boolean

type QueryParams = { [key: string]: QueryValue | QueryValue[] }

const parseQueryValue = (q: any): QueryValue | QueryValue[] => {
  if (Array.isArray(q)) {
    for (let i = 0; i < q.length; i++) {
      q[i] = parseQueryValue(q[i])
    }
    return q
  }
  if (q === 'null') {
    return null
  } else if (q === 'true' || q === '') {
    return true
  } else if (q === 'false') {
    return false
  } else if (!isNaN(q)) {
    return Number(q)
  }
  return q
}

export const parseQuery = (query: string): QueryParams | void => {
  if (query) {
    try {
      const p: QueryParams = qs.parse(query)
      for (const k in p) {
        p[k] = parseQueryValue(p[k])
      }
      return p
    } catch (_e) {}
  }
}
