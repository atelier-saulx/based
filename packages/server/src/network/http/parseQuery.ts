type QueryValue = string | number | boolean

type QueryParams = {
  [key: string]: QueryValue | QueryValue[] | { [key: string]: any }
}

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
  // TODO parse it yourself - and improve PERF!
  if (query) {
    try {
      const r: QueryParams = {}
      let inMem = ''
      let inMemVal = ''
      let parseVal = false
      let isJson = false
      const len = query.length

      // len larger then 100 return?

      for (let i = 0; i < len; i++) {
        const q = query[i]

        if (q === '&' && (!isJson || (isJson && query[i - 1] === '}'))) {
          if (!parseVal) {
            r[inMem] = true
          } else if (isJson) {
            try {
              r[inMem] = JSON.parse(inMemVal)
            } catch (err) {
              console.error('Cannot parse json', inMemVal)
              r[inMem] = inMemVal
            }
          } else {
            r[inMem] = parseQueryValue(inMemVal)
          }
          // is json
          isJson = false
          parseVal = false
          inMem = ''
          inMemVal = ''
        } else if (q === '=' && !isJson) {
          parseVal = true
        } else {
          if (parseVal) {
            // if empty
            if (inMemVal === '' && q === '{') {
              isJson = true
            }
            inMemVal += q
          } else {
            inMem += q
          }
        }
      }

      if (inMem) {
        r[inMem] = parseQueryValue(inMemVal)
      }

      return r
    } catch (_e) {}
  }
}
