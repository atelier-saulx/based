import { Command } from 'commander'

const processOption = (option: any) => {
  const args: string[] = [option.parameter, option.description]
  const method: string = option.required ? 'requiredOption' : 'option'

  if (option.default !== undefined) {
    args.push(option.default)
  }

  return { method, args }
}

const addOptions = (options: any[], cmd: Command) => {
  if (options && options.length) {
    options.forEach((option: any) => {
      const { method, args } = processOption(option)

      cmd[method](...args)
    })
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

  const addSubCommands = (
    parentCmd: Command,
    subCommands?: Record<string, any>,
  ) => {
    if (!subCommands) return

    Object.keys(subCommands).forEach((subCommandName) => {
      const subCommandData = subCommands[subCommandName]
      const { description, options } = subCommandData
      const subCommand = parentCmd
        .command(subCommandName)
        .description(description)

      addOptions(options, subCommand)

      if (
        subCommandsList &&
        subCommandsList[subCommandName] &&
        subCommand.action
      ) {
        subCommand.action(subCommandsList[subCommandName](subCommand))
      }

      addSubCommands(subCommand, subCommandData.subCommands)
    })
  }

  if (subCommands) {
    addSubCommands(cmd, subCommands)
  }

  return cmd
}
