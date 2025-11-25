import { readFile, writeFile } from 'fs/promises'
import type { BasedFunctionConfig } from '../functions/index.js'

export const updateTypesPath = async (
  fns: (
    | { config: BasedFunctionConfig; path: string }
    | { config: BasedFunctionConfig; payload: string; result: string }
  )[],
  opts: {
    isAbstract?: boolean
    imports?: string[]
    originalDeclartionPath: string
    declarationPath: string
  },
): Promise<string | undefined> => {
  let decFile = ''

  try {
    decFile = (await readFile(opts.originalDeclartionPath)).toString('utf-8')
  } catch (err) {
    throw new Error(`Cannot find ${opts.originalDeclartionPath}`)
  }

  let imports = opts.imports ? opts.imports.join('\n') + '\n' : '\n'
  let callFns = '\n'
  let queryFns = '\n'
  let fnCnt = 0
  let queryCnt = 0
  let queryMap = '\n'
  let needsParsing = opts.imports ?? false

  const abstractPrefix = opts.isAbstract ? 'abstract ' : ''

  for (const fn of fns) {
    if (fn.config.type === 'function') {
      needsParsing = true
      fnCnt++
      if ('path' in fn) {
        const name = 'FN_Type_' + fnCnt
        imports += `import type ${name} from '${fn.path}';\n`
        callFns += `
      ${abstractPrefix}call(
        name: '${fn.config.name}',
        payload: Parameters<typeof ${name}>[1],
        ${opts.isAbstract ? 'ctx?: Context' : 'opts?: CallOptions'}
      ): ReturnType<typeof ${name}>;      
    `
      } else {
        callFns += `
        ${abstractPrefix}call(
          name: '${fn.config.name}',
          payload: ${fn.payload},
          ${opts.isAbstract ? 'ctx?: Context' : 'opts?: CallOptions'}
        ): Promise<${fn.result}>      
      `
      }
    } else if (fn.config.type === 'query') {
      queryCnt++
      if ('path' in fn) {
        const name = 'Q_Type_' + queryCnt
        imports += `import type ${name} from '${fn.path}';\n`
        queryMap += `'${fn.config.name}': { payload: Parameters<typeof ${name}>[1], result: Parameters<Parameters<typeof ${name}>[2]>[0] },`
        queryFns += `
        ${abstractPrefix}query(name: '${fn.config.name}', payload: Parameters<typeof ${name}>[1], opts?: QueryOptions): BasedQuery<Parameters<typeof ${name}>[1],Parameters<Parameters<typeof ${name}>[2]>[0]>;
    `
      } else {
        queryMap += `'${fn.config.name}': { payload: ${fn.payload}, result: ${fn.result} },`
        queryFns += `
        ${abstractPrefix}query(name: '${fn.config.name}', payload: ${fn.payload}, opts?: QueryOptions): BasedQuery<${fn.payload},${fn.result}>;
    `
      }
    }
  }
  if (needsParsing) {
    let x = imports + decFile
    if (fnCnt > 0) {
      if (opts.isAbstract) {
        x = x.replace(
          'abstract call(name: string, payload?: any, ctx?: Context): Promise<any>;',
          callFns,
        )
      } else {
        x = x.replace(
          'call(name: string, payload?: any, opts?: CallOptions): Promise<any>;',
          callFns,
        )
      }
    }
    if (queryCnt > 0) {
      if (opts.isAbstract) {
        x = x.replace(
          `abstract query(name: string, payload?: any): BasedQuery;`,
          queryFns,
        )
      } else {
        x = x.replace(
          `query(name: string, payload?: any, opts?: QueryOptions): BasedQuery;`,
          queryFns,
        )
      }
      x = x.replace(
        /export type QueryMap = ([^@]*?)\};?([^@]*?)\};?\s*\};?/gm,
        `export type QueryMap = {${queryMap}}`,
      )
    }
    await writeFile(opts.declarationPath, x)
    return opts.declarationPath
  }
}
