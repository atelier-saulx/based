import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import type { AppContext } from '../../context/index.js'
import { FUNCTION_TYPES } from '../../shared/constants.js'
import { rel } from '../../shared/index.js'

export const configsInvalidateCode = async (
  context: AppContext,
  found: Based.Deploy.Configs,
): Promise<boolean> => {
  if (!found.index) {
    return false
  }

  const source = (await readFile(found.index)).toString()
  const sourceFile = ts.createSourceFile(
    found.index,
    source,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TSX,
  )
  const typeName = FUNCTION_TYPES[found.config.type]
  let hasExport: boolean = false
  let isAsync: boolean = false

  ts.forEachChild(sourceFile, function walk(node) {
    if (
      node.kind === ts.SyntaxKind.ExportAssignment ||
      node.kind === ts.SyntaxKind.ExportKeyword
    ) {
      hasExport = true
    }

    if (
      (node.kind === ts.SyntaxKind.FunctionDeclaration ||
        node.kind === ts.SyntaxKind.FunctionExpression ||
        node.kind === ts.SyntaxKind.ArrowFunction) &&
      found.config.type === 'job'
    ) {
      if (
        // @ts-ignore
        node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword)
      ) {
        isAsync = true
      }

      return
    }

    if (!hasExport) {
      ts.forEachChild(node, walk)
    }
  })

  if (!hasExport) {
    context.print
      .intro(context.i18n('methods.bundling.methodNotExportedIntro'))
      .warning(
        context.i18n(
          'methods.bundling.methodNotExported',
          found.config.name || found.config.type,
          found.config.type,
        ),
      )
      .pipe()
      .warning(
        `<white><b>${found.config.name}</b> <dim>| ${rel(found.index)}</dim></white>`,
      )

    return false
  }

  if (isAsync) {
    context.print
      .intro(context.i18n('methods.bundling.asyncJobIntro'))
      .warning(context.i18n('methods.bundling.asyncJob', found.config.name))
      .pipe()
      .warning(
        `<white><b>${found.config.name}</b> <dim>| ${rel(found.index)}</dim></white>`,
      )

    return false
  }

  return true
}
