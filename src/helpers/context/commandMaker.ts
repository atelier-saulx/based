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
  const { name, description, options, usage, subCommands } =
    this.i18n(commandKey)

  if (name) {
    const fullCommand = `${name} ${usage ?? ''}`.trim()

    cmd = cmd.command(fullCommand)
  }

  if (description) {
    cmd.description(description)
  }

  addOptions(options, cmd)

  const addSubCommands = (parentCmd: Command, subCommands?: any[]) => {
    if (!subCommands || !subCommands.length) return

    subCommands.forEach((subCommandData: any) => {
      const { name, description, options } = subCommandData
      const subCommand = parentCmd.command(name).description(description)

      addOptions(options, subCommand)

      // Associa a ação ao subcomando
      if (subCommandsList && subCommandsList[name]) {
        subCommand.action(subCommandsList[name](subCommand))
      }

      addSubCommands(subCommand, subCommandData.subCommands)
    })
  }

  if (subCommands && subCommands.length) {
    addSubCommands(cmd, subCommands)
  }

  return cmd
}
