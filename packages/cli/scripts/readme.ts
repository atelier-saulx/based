import { readFile, writeFile } from 'node:fs/promises'
import { languages } from '../src/i18n/index.js'

const capitalizeWords = (str?: string, fallback?: string) => {
  const target = str || fallback || ''
  return target.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

type Command = {
  name?: string
  longDescription?: string
  description?: string
  example?: string
  parameter?: string
  options?: Command[]
}

const generateCommandMarkdown = (
  commandObj: Command,
  commandKey: string,
  isSubCommand = false,
) => {
  const headingLevel = isSubCommand ? '####' : '###'
  let markdown = `${headingLevel} ${capitalizeWords(commandObj.name, commandKey)}\n\n`

  const description = commandObj.longDescription || commandObj.description
  if (description) {
    markdown += `${description}\n\n`
  }

  if (commandObj.example) {
    markdown += `_Example:_ \`${commandObj.example}\`\n\n`
  }

  if (commandObj.options && commandObj.options.length > 0) {
    markdown += '| Option | Description |\n|--------|-------------|\n'
    for (const option of commandObj.options) {
      // @ts-ignore
      if (option.hidden) {
        continue
      }

      const optionDescription = option.longDescription || option.description
      markdown += `| \`${option.parameter}\` | ${optionDescription} |\n`
    }

    markdown += '\n'
  }

  return markdown
}

const addCommands = (
  inputString: string,
  commands: typeof languages.languages.en,
) => {
  const commandsMarker = '## Commands'
  const [beforeCommands] = inputString.includes(commandsMarker)
    ? inputString.split(commandsMarker)
    : [inputString]

  let commandsMarkdown = ''

  for (const commandKey in commands) {
    const commandObj = commands[commandKey]
    commandsMarkdown += generateCommandMarkdown(commandObj, commandKey)

    if (commandObj.subCommands) {
      for (const subCommandKey in commandObj.subCommands) {
        const subCommandObj = commandObj.subCommands[subCommandKey]
        commandsMarkdown += generateCommandMarkdown(
          subCommandObj,
          subCommandKey,
          true,
        )
      }
    }
  }

  // Combine sections, replacing everything after '## Commands'
  return `${beforeCommands}${commandsMarker}\n\n${commandsMarkdown}`
}

const buildReadme = async (base: typeof languages) => {
  const { languages, default: defaultLanguageKey } = base

  for (const languageKey in languages) {
    const pathReadme =
      languageKey === defaultLanguageKey
        ? './README.md'
        : `./README.${languageKey}.md`

    let finalReadme: string = ''

    try {
      try {
        const readmeContent = await readFile('./README.md', 'utf8')
        const commands = languages[languageKey].commands

        finalReadme = addCommands(readmeContent, commands)
      } catch (error) {
        throw new Error('Was not possible to read the file.', error)
      }

      try {
        await writeFile(pathReadme, finalReadme, 'utf-8')

        console.log('🎉 File saved successfully!', pathReadme)
      } catch (error) {
        throw new Error('Was not possible to save the file.', error)
      }
    } catch (error) {
      console.error('🧨 Error processing the file:', JSON.stringify(error))
    }

    process.exit(0)
  }
}

await buildReadme(languages)
