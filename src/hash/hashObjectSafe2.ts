// const hashObjectSafe = (props: object): number => {
//   const x = hashObjectSafeNest(props)
//   return (x[0] >>> 0) * 4096 + (x[1] >>> 0)
// }

// export default hashObjectSafe

// types
// Supported types:

// 'string'
// 'integer'
// 'number'
// 'array'
// 'object'
// 'boolean'
// 'null'

const escape = (s: string) => s.replace(/:/g, ':').replace(/,/g, ',')
const parse = (v: any) => {
  const t = typeof v
  if (t === 'object') {
    return v === null ? 'n' : walk(v)
  }
  if (t === 'string') {
    return 't' + escape(v)
  }
  if (t === 'number') {
    return 'i' + v
  }
  if (t === 'boolean') {
    return 'b' + Number(v)
  }
  if (t === 'function') {
    return 'f' + escape(v.toString())
  }
  if (v === undefined) {
    return 'u'
  }
  // unknown ===> null
  return 'n'
}

const walk = (obj: Record<any, any>) => {
  let str
  let keys

  if (obj instanceof Map) {
    str = 'm'
    keys = Object.keys(obj).sort()
    for (const key of keys) {
      str += `${parse(key)}:${parse(obj.get(key))},`
    }
    return str
  }

  if (Array.isArray(obj)) {
    str = 'a'
    for (const val of obj) {
      str += `${parse(val)},`
    }
    return str
  }

  if (obj instanceof Set) {
    str = 's'
    keys = Array.from(obj).sort()
  } else {
    str = 'o'
    keys = Object.keys(obj).sort()
  }

  for (const key of keys) {
    str += `${parse(key)}:${parse(obj[key])},`
  }

  return str
}

const obj = {
  a: [
    [
      'youzi',
      {
        coolguy: true,
        ballz: [],
        super: {
          cool: {
            but: 'ok',
          },
        },
        strong: {
          survivor: true,
        },
      },
    ],
    { majestic: 'hero' },
    undefined,
    null,
    ['youzi2', { sukkel: 'youzi' }],
    null,
    'biatch',
    'stank',
  ],
  b: {},
}

const unparseObj = (res: any, ctx: Ctx): void => {
  while (ctx.s[ctx.i + 1] === ',') {
    res = ctx.p.get(res)
    ctx.i++
    if (Array.isArray(res)) {
      return unparseArr(res, ctx)
    }
  }
  const key = unparseWalk(ctx, res)
  if (key === undefined) return
  res[key] = unparseWalk(ctx, res, key)
  if (ctx.s[ctx.i] === ',') {
    unparseObj(res, ctx)
  }
}

const unparseArr = (res: any, ctx: Ctx): void => {
  while (ctx.s[ctx.i + 1] === ',') {
    res = ctx.p.get(res)
    ctx.i++
    if (!Array.isArray(res)) {
      return unparseObj(res, ctx)
    }
  }
  const index = res.length
  const val = unparseWalk(ctx, res, index)
  res[index] = val

  if (ctx.s[ctx.i] === ',') {
    unparseArr(res, ctx)
  }
}

type Ctx = {
  s: string
  i: number
  p: Map<any, any>
}

const unparseWalk = (ctx: Ctx, parent?: any, key?: any): any => {
  const t = ctx.s[++ctx.i]
  if (t === 'n') {
    ctx.i++
    return null
  }

  if (t === 'u') {
    ctx.i++
    return undefined
  }

  if (t === 'o') {
    const res = {}
    if (parent) {
      parent[key] = res
      ctx.p.set(res, parent)
    }
    unparseObj(res, ctx)
    return res
  }

  if (t === 'a') {
    const res: any[] = []
    if (parent) {
      parent[key] = res
      ctx.p.set(res, parent)
    }
    unparseArr(res, ctx)
    return res
  }

  if (t === 't') {
    // string
    let i = ctx.i
    let res = ''
    const str = ctx.s
    while (i++) {
      const char = str[i]
      if (char === ',' || char === ':') {
        if (str[i - 1] !== '\\') {
          break
        }
      }
      if (char !== '\\') {
        res += char
      }
    }
    ctx.i = i
    return res
  }

  if (t === 'b') {
    // boolean
    ctx.i++
    return Boolean(Number(ctx.s[ctx.i++]))
  }

  if (t === 'i') {
    // number
    const str = ctx.s
    const start = ctx.i + 1
    const end = str.indexOf(',', start)
    ctx.i = end
    return Number(str.substring(start, end))
  }
}

const unparse = (str: string): any => {
  const ctx: Ctx = { i: -1, s: str, p: new Map() }
  return unparseWalk(ctx)
}

export default () => {}

const replacer = (key, val) => {
  if (typeof val === 'object') {
    if (
      val === null ||
      Array.isArray(val) ||
      val instanceof Map ||
      val instanceof Set
    ) {
      return val
    }
    const keys = Object.keys(val)
    if (keys.length < 2) {
      return val
    }
    const copy = {}
    const sort = keys.sort()
    for (const k of sort) {
      copy[k] = val[k]
    }
    return copy
  }
  return val
}

console.log('---', JSON.stringify(obj, replacer))
