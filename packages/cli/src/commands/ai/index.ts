import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'

const AGENT_FILES: Record<string, string> = {
  'Cursor (.cursorrules)': '.cursorrules',
  'Windsurf (.windsurfrules)': '.windsurfrules',
  'Cline / OpenCode (.clinerules)': '.clinerules',
  'Generic / GitHub Copilot (BASED_AI_SKILLS.md)': 'BASED_AI_SKILLS.md',
}

export const ai = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('ai')

  cmd.action(async () => {
    try {
      const selectedAgents = await context.form.multiSelect({
        message: context.i18n('commands.ai.methods.agents'),
        input: [],
        required: true,
        skip: false,
        options: Object.keys(AGENT_FILES).map((key) => ({
          value: AGENT_FILES[key],
          label: key,
        })),
      })

      if (!selectedAgents || selectedAgents.length === 0) {
        return
      }

      context.spinner.start('Downloading AI skills...')

      let skillContent = ''
      try {
        const localPath = join(
          process.cwd(),
          'node_modules',
          '@based',
          'db',
          'SKILL.md',
        )
        if (existsSync(localPath)) {
          skillContent = await readFile(localPath, 'utf-8')
        } else {
          const res = await fetch(context.endpoints.AI_SKILL.endpoint)
          if (!res.ok) {
            throw new Error(
              `Failed to fetch from primary repo: ${res.statusText}`,
            )
          }
          skillContent = await res.text()
        }
      } catch (err) {
        // Fallback to the atelier-saulx/based monorepo just in case
        const fallbackUrl =
          'https://raw.githubusercontent.com/atelier-saulx/based/refs/heads/main/packages/db/SKILL.md'
        const res = await fetch(fallbackUrl)
        if (!res.ok) {
          throw new Error('Could not fetch AI skills content.')
        }
        skillContent = await res.text()
      }

      if (!skillContent) {
        throw new Error('Could not fetch AI skills content.')
      }

      context.spinner.stop('Downloaded AI skills!')

      for (const file of selectedAgents as string[]) {
        const filePath = join(process.cwd(), file)
        const exists = existsSync(filePath)

        let writeContent = skillContent
        if (exists) {
          const currentContent = await readFile(filePath, 'utf-8')
          if (!currentContent.includes('@based/db Best Practices')) {
            writeContent = currentContent + '\n\n' + skillContent
          } else {
            context.print.success(`File ${file} already contains the skills.`)
            continue
          }
        }

        await writeFile(filePath, writeContent, 'utf-8')
        context.print.success(
          context.i18n('commands.ai.methods.fileSaved', file),
        )
      }

      context.print.success(context.i18n('commands.ai.methods.success'))
    } catch (error: any) {
      context.print.error(
        context.i18n('commands.ai.methods.error', error.message),
      )
    }
  })
}
