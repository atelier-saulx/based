import fs from 'fs'
import { languages } from '../src/i18n/index.js'

const capitalizeWords = (str?: string, fallback?: string) => {
  const target = str || fallback || ''
  return target.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

const generateCommandMarkdown = (
  commandObj: any,
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
    commandObj.options.forEach((option: any) => {
      const optionDescription = option.longDescription || option.description
      markdown += `| \`${option.parameter}\` | ${optionDescription} |\n`
    })
    markdown += '\n'
  }

  return markdown
}

const addCommands = (inputString: string, commands: any) => {
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

const saveFile = (file: string, content: string) => {
  fs.writeFile(file, content, (err) => {
    if (err) {
      console.error('🧨 Error saving the file:', file, err)
    } else {
      console.log('🎉 File saved successfully!', file)
    }
  })
}

const buildReadme = (base: any) => {
  const { languages, default: defaultLanguageKey } = base

  for (const languageKey in languages) {
    const pathReadme =
      languageKey === defaultLanguageKey
        ? './README.md'
        : `./README.${languageKey}.md`
    const readmeContent = fs.readFileSync('./README.md', 'utf8')
    const commands = languages[languageKey].commands

    const finalReadme = addCommands(readmeContent, commands)

    saveFile(pathReadme, finalReadme)
  }
}

buildReadme(languages)
