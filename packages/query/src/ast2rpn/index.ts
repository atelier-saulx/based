import printAst from './printAst.js'
import isFork from './isFork.js'
import ast2rpn from './ast2rpn.js'
import bfsExpr2rpn from './bfsExpr2rpn.js'
import fieldsExpr2rpn from './fieldsExpr2rpn.js'
import ast2IndexHints from './ast2IndexHints.js'

import createAst from './parseFilters.js'

import optimizeTypeFilters from './optimizeTypeFilters.js'

import convertNow from './convertNow.js'

import { Filter } from './types.js'

import { Rpn } from './types.js'

const createRpn = (
  types: Record<string, { prefix?: string }>,
  filters: Filter | Filter[]
): Rpn | void => {
  if (!Array.isArray(filters)) {
    filters = [filters]
  }
  const fork = createAst(filters)
  if (fork) {
    return ast2rpn(types, fork)
  }
}

export * from './types.js'

export {
  printAst,
  isFork,
  createAst,
  ast2rpn,
  ast2IndexHints,
  bfsExpr2rpn,
  fieldsExpr2rpn,
  createRpn,
  convertNow,
  optimizeTypeFilters,
}
