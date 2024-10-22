import { Command } from 'commander'

export function contextCommandMaker(command: Based.Commands.Names): Command {
  const commandKey = `commands.${command}`

  const options = this.i18n(`${commandKey}.options`)
  const description = this.i18n(`${commandKey}.description`)
  const cmd: Command = this.program

  if (description) {
    cmd.command(command).description(description)
  }

  if (options.length) {
    for (const option of options) {
      if (!option.parameter || !option.description) {
        return cmd
      }

      let args: string[] = [option.parameter, option.description]
      let method: string = 'option'

      if (option.required) {
        method = 'requiredOption'
      }

      if (option.default !== undefined) {
        args.push(option.default)
      }

      cmd[method](...args)
    }
  }

  return cmd
}
