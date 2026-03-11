import { PropDef } from '../../../schema/defs/index.js'
import {
  IncludeOp,
  IncludeOpts,
  LangCode,
  pushIncludeHeader,
  pushIncludeOpts,
} from '../../../zigTsExports.js'
import { Ctx, Include, ReadOpts } from '../ast.js'
import { readPropDef } from '../readSchema.js'
import { isLocalized } from '../utils.js'

const hasRelevantOptions = (opts: Include): boolean => {
  for (const key in opts) {
    if (key === 'raw' || key === 'meta') continue
    return true
  }
  return false
}

const toOptsHeader = (opts: Include): IncludeOpts => {
  return {
    hasNextOpt: false,
    end: opts.maxChars ? opts.maxChars : (opts.maxBytes ?? 0),
    isChars: !!opts.maxChars,
    lang: opts.langCode ?? LangCode.none,
    langFallbackSize: 0,
  }
}

export const includeProp = (ctx: Ctx, prop: PropDef, include: Include) => {
  const readOpts: ReadOpts = {
    raw: include.raw ?? false,
    meta: include.meta ?? false,
    code: isLocalized(prop.type) ? ctx.locale : LangCode.none,
    langs: [],
  }
  if (include.meta) {
    if (isLocalized(prop.type) && ctx.locale !== LangCode.none) {
      pushIncludeHeader(ctx.query, {
        op: IncludeOp.metaWithOpts,
        prop: prop.id,
        propType: prop.type,
      })
      const fallBacks =
        ctx.LocaleFallBackOverwrite ?? ctx.localeFallbacks[ctx.locale]
      pushIncludeOpts(ctx.query, {
        ...toOptsHeader(include),
        lang: ctx.locale,
        langFallbackSize: fallBacks.length,
      })
      for (let i = 0; i < fallBacks.length || 0; i++) {
        ctx.query.push(fallBacks[i])
      }
    } else {
      pushIncludeHeader(ctx.query, {
        op: IncludeOp.meta,
        prop: prop.id,
        propType: prop.type,
      })
    }
  }
  if (include.meta !== 'only') {
    if (isLocalized(prop.type) && ctx.locale !== LangCode.none) {
      const fallBacks =
        ctx.LocaleFallBackOverwrite ?? ctx.localeFallbacks[ctx.locale]
      pushIncludeHeader(ctx.query, {
        op: IncludeOp.defaultWithOpts,
        prop: prop.id,
        propType: prop.type,
      })
      pushIncludeOpts(ctx.query, {
        ...toOptsHeader(include),
        lang: ctx.locale,
        langFallbackSize: fallBacks.length,
      })
      for (let i = 0; i < fallBacks.length || 0; i++) {
        ctx.query.push(fallBacks[i])
      }
    } else if (hasRelevantOptions(include)) {
      pushIncludeHeader(ctx.query, {
        op: IncludeOp.defaultWithOpts,
        prop: prop.id,
        propType: prop.type,
      })
      pushIncludeOpts(ctx.query, toOptsHeader(include))
    } else {
      pushIncludeHeader(ctx.query, {
        op: IncludeOp.default,
        prop: prop.id,
        propType: prop.type,
      })
    }
  }
  ctx.readSchema.props[prop.id] = readPropDef(prop, ctx, readOpts)
}

export const includeMultiLocalizedProp = (
  ctx: Ctx,
  prop: PropDef,
  includes: Include[],
) => {
  const readOpts: ReadOpts = {
    raw: false,
    meta: false,
    code: LangCode.none,
    langs: [],
  }

  let onlyMeta = true
  let hasMeta = false
  for (let i = 0; i < includes.length; i++) {
    const include = includes[i]
    if (!include.langCode) {
      throw new Error(
        'Wrong lang include option passed to includeMultiLangProp',
      )
    }
    if (include.meta) {
      hasMeta = true
      if (include.meta != 'only' && onlyMeta) {
        onlyMeta = false
      }
    } else {
      onlyMeta = false
    }
    readOpts.langs!.push({
      code: include.langCode,
      raw: include.raw ?? false,
      meta: include.meta ?? false,
    })
  }

  if (hasMeta) {
    pushIncludeHeader(ctx.query, {
      op: IncludeOp.metaWithOpts,
      prop: prop.id,
      propType: prop.type,
    })
    const meta = includes.filter((v) => v.meta)
    for (let i = 0; i < meta.length; i++) {
      pushIncludeOpts(ctx.query, {
        ...toOptsHeader(meta[i]),
        hasNextOpt: i < meta.length - 1,
      })
    }
  }

  if (!onlyMeta) {
    pushIncludeHeader(ctx.query, {
      op: IncludeOp.defaultWithOpts,
      prop: prop.id,
      propType: prop.type,
    })
    const nonMeta = includes.filter((v) => v.meta !== 'only')
    for (let i = 0; i < nonMeta.length; i++) {
      pushIncludeOpts(ctx.query, {
        ...toOptsHeader(nonMeta[i]),
        hasNextOpt: i < nonMeta.length - 1,
      })
    }
  }

  ctx.readSchema.props[prop.id] = readPropDef(prop, ctx, readOpts)
}
