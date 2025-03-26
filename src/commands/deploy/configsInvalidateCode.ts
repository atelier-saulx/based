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
      .intro(context.i18n('methods.bundling.wrongTypeIntro'))
      .warning(
        context.i18n(
          'methods.bundling.wrongType',
          found.config.name || found.config.type,
          Object.values(FUNCTION_TYPES)
            .map((type) => `'<b>${type}</b>'`)
            .join(','),
        ),
      )
      .pipe()
      .warning(
        `<white><b>${found.config.name}</b> <dim>| ${rel(found.index)}</dim></white>`,
      )
      .line()

    return false
  }

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
      .line()

    return false
  }

  return true
}
