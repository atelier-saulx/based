import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { AppContext } from '../../../context/index.js'
import { getMachines } from '../../../helpers/index.js'
import {
  isFormatValid,
  isValidPath,
  rel,
  saveAsFile,
  summaryMaker,
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
        const options = [
          context.i18n('methods.format.ts'),
          context.i18n('methods.format.js'),
          context.i18n('methods.format.json'),
        ]

        args.format = (await context.form.select({
          message: context.i18n(
            'commands.infra.subCommands.get.methods.fileExtension',
          ),
          input: args.format,
          options,
          required: true,
        })) as 'ts' | 'js' | 'json'
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
  const { env } = await context.getProgram()
  const machinesKeys = Object.keys(infra.machines)

  if (!infra.format) {
    context.print.fail(
      context.i18n('commands.infra.subCommands.get.methods.cannotInit'),
    )
  }

  if (!skip) {
    const validationMessage = (option: string) => (value: string | number) =>
      context.i18n('errors.901', option, value ?? '')

    if (!infra.path) {
      infra.path = await context.form.text({
        message: context.i18n(
          'commands.infra.subCommands.init.methods.inputPath',
        ),
        input: '',
        required: !skip,
        skip: false,
        placeholder: './',
        validation: [
          context.form.collider(
            isValidPath,
            validationMessage(context.i18n('commands.infra.validations.path')),
          ),
        ],
      })
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

  if (!skip) {
    const doIt = await summaryMaker(
      context,
      [
        context.i18n('commands.infra.subCommands.get.methods.summary.header'),
        context.i18n(
          'commands.infra.subCommands.get.methods.summary.currentEnv',
          env,
        ),
        context.i18n(
          'commands.infra.subCommands.get.methods.summary.saving',
          machinesKeys.length,
          machinesKeys.join(' | '),
        ),
        context.i18n(
          'commands.infra.subCommands.get.methods.summary.saveIn',
          infra.path,
        ),
      ].filter(Boolean),
    )

    if (!doIt) {
      throw new Error(context.i18n('methods.aborted'))
    }
  }

  try {
    context.spinner.start(context.i18n('methods.savingFile'))

    await saveAsFile({ [env]: infra.machines }, infra.path, infra.format)
  } catch (error) {
    throw new Error(context.i18n('errors.902', error))
  }

  context.print.success(context.i18n('methods.savedFile', rel(infra.path)))
}
