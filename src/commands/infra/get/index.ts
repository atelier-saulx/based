import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { AppContext } from '../../../context/index.js'
import { getMachines } from '../../../helpers/index.js'
import {
  isFormatValid,
  isValidPath,
  saveAsFile,
} from '../../../shared/index.js'

export const get =
  (program: Command) => async (args: Based.Infra.Get.Command) => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const basedClient = await context.getBasedClient()
    const { skip } = context.getGlobalOptions()

    const errorMessage = (option: string, value: string | number) => {
      throw new Error(context.i18n('errors.901', option, value))
    }

    args.machines = await getMachines()

    if (args.machine && !args.machines[args.machine]) {
      errorMessage(
        context.i18n('commands.infra.validations.machine'),
        args.machine,
      )
    } else if (args.machine && args.machines[args.machine]) {
      args.machines = {
        [args.machine]: args.machines[args.machine],
      }
    }

    if (args.path && !isValidPath(args.path)) {
      errorMessage(context.i18n('commands.infra.validations.path'), args.path)
    }

    if (args.format && !isFormatValid(args.format)) {
      errorMessage(context.i18n('commands.infra.validations.format'), args.path)
    }

    if (!skip) {
      if (!args.format) {
        const choices = [
          {
            name: context.i18n('methods.format.ts.label'),
            value: context.i18n('methods.format.ts.value'),
          },
          {
            name: context.i18n('methods.format.json.label'),
            value: context.i18n('methods.format.json.value'),
          },
          {
            name: context.i18n('methods.format.js.label'),
            value: context.i18n('methods.format.js.value'),
          },
        ]

        args.format = await context.input.select(
          context.i18n('commands.infra.subCommands.get.methods.fileExtension'),
          choices,
        )
      }
    } else {
      if (!args.format) {
        args.format = 'ts'
      }
    }

    try {
      await saveInfra({ context, infra: args })

      basedClient.destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
  }

export const saveInfra = async (args: Based.Infra.Get.Save) => {
  const { context, infra } = args
  const { skip } = context.getGlobalOptions()
  const machinesKeys = Object.keys(infra.machines)

  if (!infra.format) {
    context.print.fail(
      context.i18n('commands.infra.subCommands.get.methods.cannotInit'),
    )
  }

  if (!skip) {
    if (!infra.path) {
      infra.path = await context.input.default(
        context.i18n('commands.infra.subCommands.get.methods.inputPath'),
        './',
        false,
        isValidPath,
      )
    }
  } else {
    if (!infra.path) {
      infra.path = './'
    }
  }

  const fileName = `based.infra.${infra.format}`
  const fullPath = resolve(join(infra.path, fileName))

  if (!infra.path.includes(fileName)) {
    infra.path = fullPath
  }

  context.print
    .line()
    .info(context.i18n('commands.infra.subCommands.get.methods.summary.header'))
    .info(
      context.i18n(
        'commands.infra.subCommands.get.methods.summary',
        machinesKeys.length,
        machinesKeys.join(' | '),
      ),
    )
    .info(
      context.i18n(
        'commands.infra.subCommands.get.methods.summary.saveIn',
        infra.path,
      ),
    )
    .line()

  if (!skip) {
    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      throw new Error(context.i18n('methods.aborted'))
    }
  }

  try {
    context.spinner.start(context.i18n('methods.savingFile'))

    await saveAsFile(infra.machines, infra.path, infra.format)
  } catch (error) {
    throw new Error(context.i18n('errors.902', error))
  }

  context.print.success(context.i18n('methods.savedFile', infra.path), true)
}
