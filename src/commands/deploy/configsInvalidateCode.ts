import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import type { AppContext } from '../../context/index.js'
import { FUNCTION_TYPES } from '../../shared/constants.js'

export const configsInvalidateCode = async (
  context: AppContext,
  functionFile: string,
  functionConfig: Based.Deploy.FunctionBase,
  functionPath: string,
): Promise<boolean> => {
  if (!functionFile) {
    return
  }

  const source = (await readFile(functionFile)).toString()
  const sourceFile = ts.createSourceFile(
    functionFile,
    source,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TSX,
  )
  const typeName = FUNCTION_TYPES[functionConfig.type]
  let hasExport: boolean = false
  let hasType: boolean = false

  ts.forEachChild(sourceFile, function walk(node) {
    if (
      node.kind === ts.SyntaxKind.ExportAssignment ||
      node.kind === ts.SyntaxKind.ExportKeyword
    ) {
      hasExport = true
    }

    if (
      typeName &&
      // @ts-ignore
      node.type?.typeName?.escapedText &&
      // @ts-ignore
      node.type?.typeName?.escapedText === typeName
    ) {
      hasType = true
    }

    if (!hasType || !hasExport) {
      ts.forEachChild(node, walk)
    }
  })

  if (!hasType) {
    context.print
      .line()
      .warning(
        context.i18n(
          'methods.bundling.wrongType',
          functionConfig.name || functionConfig.type,
          Object.keys(FUNCTION_TYPES)
            .map((type) => `'<b>${type}</b>'`)
            .join(','),
        ),
      )
      .pipe(`<dim>${functionPath}</dim>`)

    return false
  }

  if (!hasExport) {
    context.print
      .line()
      .warning(
        context.i18n(
          'methods.bundling.methodNotExported',
          functionConfig.name || functionConfig.type,
          functionConfig.type,
        ),
      )
      .pipe(`<dim>${functionFile}</dim>`)

    return false
  }
}
