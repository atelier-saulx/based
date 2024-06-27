import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

export function activate(context: vscode.ExtensionContext) {
  const basedProvider = new BasedCompletionItemProvider()

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      [
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'javascriptreact' },
      ],
      basedProvider,
      '"',
      "'",
      '(',
    ),
  )
}

class BasedCompletionItemProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> | null {
    const linePrefix = document
      .lineAt(position)
      .text.substr(0, position.character)
    const match = linePrefix.match(/useBasedQuery\s*\(\s*['"]([^'"]*)$/)

    if (match) {
      const queryValuePrefix = match[1] ?? ''
      return this.extractValuesFromConfigFiles().then((values) => {
        return values
          .filter((item) => item.startsWith(queryValuePrefix))
          .map((value) => {
            const item = new vscode.CompletionItem(
              value,
              vscode.CompletionItemKind.Constant,
            )
            item.detail = 'Based Function'
            return item
          })
      })
    }

    return null
  }

  private async extractValuesFromConfigFiles(): Promise<string[]> {
    const values = new Set<string>()
    const workspaceFolders = vscode.workspace.workspaceFolders

    if (!workspaceFolders) {
      return []
    }

    for (const folder of workspaceFolders) {
      await this.findConfigFiles(folder.uri.fsPath, values)
    }

    return Array.from(values)
  }

  private async findConfigFiles(
    dir: string,
    values: Set<string>,
  ): Promise<void> {
    try {
      const files = await fs.promises.readdir(dir)
      for (const file of files) {
        const fullPath = path.join(dir, file)
        const stat = await fs.promises.stat(fullPath)

        if (stat.isDirectory()) {
          if (file.startsWith('.') || file === 'node_modules') {
            continue
          }
          await this.findConfigFiles(fullPath, values)
        } else if (file === 'based.config.ts') {
          const content = await fs.promises.readFile(fullPath, 'utf-8')
          const parsedValue = this.parseConfigFile(content)
          if (parsedValue) {
            values.add(parsedValue)
          }
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error)
    }
  }

  private parseConfigFile(content: string): string | null {
    const regex =
      /name\s*:\s*['"](\w+)['"][\s\S]*?\btype\s*:\s*['"]([a-zA-Z]+)['"]/
    const match = regex.exec(content)

    if (match && (match[2] === 'function' || match[2] === 'query')) {
      return match[1]
    } else {
      return null
    }
  }
}

export function deactivate() {
  console.log('Based Query Autocomplete extension deactivated')
}
