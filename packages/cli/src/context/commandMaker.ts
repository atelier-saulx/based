import { type Command, Option } from 'commander'

const processOption = (option) => {
  const args: [string, string] = [option.parameter, option.description]
  const method: string = option.required ? 'requiredOption' : 'option'

  if (option.default !== undefined) {
    args.push(option.default)
  }

  return { method, args }
}

const addOptions = (options, cmd: Command) => {
  if (options?.length) {
    for (const option of options) {
      const { method, args } = processOption(option)

      if (option.hidden) {
        cmd.addOption(new Option(...args).hideHelp())
      } else {
        cmd[method](...args)
      }
    }
  }
}

export function contextCommandMaker(
  command: Based.Commands.Names,
  subCommandsList?: Based.Commands.SubCommandsList,
): Command {
  let cmd: Command = this.program

  if (!cmd) {
    throw new Error(
      'Program is not initialized. Make sure `this.program` is defined.',
    )
  }

  const commandKey = `commands.${command}`
  const { description, options, usage, subCommands } = this.i18n(commandKey)

  if (command !== 'globalOptions') {
    const fullCommand = `${command} ${usage ?? ''}`.trim()

    cmd = cmd.command(fullCommand)
  }

  if (description) {
    cmd.description(description)
  }

  addOptions(options, cmd)

  const addSubCommands = (parentCmd: Command, subCommands?) => {
    if (!subCommands) return

    for (const subCommandName of Object.keys(subCommands)) {
      const subCommandData = subCommands[subCommandName]
      const { description, options } = subCommandData
      const subCommand = parentCmd.command(subCommandName)

      if (description) {
        subCommand.description(description)
      }

      addOptions(options, subCommand)

      if (subCommandsList?.[subCommandName] && subCommand.action) {
        subCommand.action(subCommandsList[subCommandName](subCommand))
      }

      addSubCommands(subCommand, subCommandData.subCommands)
    }
  }

  if (subCommands) {
    addSubCommands(cmd, subCommands)
  }

  return cmd
}
