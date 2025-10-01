export * from './prompts.js'

import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { AppContext } from '../../../context/index.js'
import { exportInfraTemplate } from '../../../helpers/index.js'
import {
  isFormatValid,
  isValidPath,
  saveAsFile,
} from '../../../shared/index.js'

type MachineList = {
  name?: string
  value?: string
  basedPrice?: string
  cpus?: string
  memory?: string
}

export const infraInit =
  (program: Command) => async (args: Based.Infra.Init.Command) => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const basedClient = await context.getBasedClient()
    const { skip } = context.getGlobalOptions()
    const isNotEmpty = (value: string): boolean =>
      value !== '' && value !== undefined
    const isValidDomain = (value: string): boolean => {
      const domainRegex =
        /^(?!\-)(?:[a-zA-Z0-9\-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,}$/

      return domainRegex.test(value)
    }
    const isDomain = (value: string) => {
      if (isNotEmpty(value)) {
        return value.split(',').every((value) => isValidDomain(value.trim()))
      }

      return false
    }
    const machineList: MachineList[] = await basedClient
      .call(context.endpoints.INFRA_MACHINE_TYPES)
      .get()

    const errorMessage = (option: string, value: string | number) => {
      throw new Error(context.i18n('errors.901', option, value))
    }

    if (args.machine && machineList.indexOf({ name: args.machine }) < 0) {
      errorMessage(
        context.i18n('commands.infra.validations.machine'),
        args.machine,
      )
    }

    if (args.min && Number.isNaN(Number(args.min))) {
      errorMessage(context.i18n('commands.infra.validations.min'), args.min)
    }

    if (args.max && Number.isNaN(Number(args.max))) {
      errorMessage(context.i18n('commands.infra.validations.max'), args.max)
    }

    if (args.path && !isValidPath(args.path)) {
      errorMessage(context.i18n('commands.infra.validations.path'), args.path)
    }

    if (args.format && !isFormatValid(args.format)) {
      errorMessage(context.i18n('commands.infra.validations.format'), args.path)
    }

    context.print.warning(
      context.i18n('commands.infra.subCommands.init.methods.warning'),
    )

    if (!skip) {
      if (!args.name) {
        args.name = await context.input.default(
          context.i18n('commands.infra.subCommands.init.methods.name'),
          '',
          false,
          isNotEmpty,
        )
      }

      if (!args.description) {
        args.description = await context.input.default(
          context.i18n('commands.infra.subCommands.init.methods.description'),
          '',
          true,
          isNotEmpty,
        )
      }

      if (!args.domains || !args.domains.length) {
        const domainsInput = await context.input.default(
          context.i18n('commands.infra.subCommands.init.methods.domains'),
          '',
          true,
          isDomain,
        )

        args.domains = domainsInput.split(',').map((domain) => domain.trim())
      }

      if (!args.machine) {
        const nameWidth = 12
        const typeWidth = 14
        const hardwareWidth = 12
        const priceWidth = 11

        let choices = machineList

        choices = choices.map((item) => {
          let { name, value, basedPrice, cpus, memory } = item
          name = name.padEnd(nameWidth)
          const type = `(${value})`.padEnd(typeWidth)
          const monthlyPrice =
            `${context.i18n('currency', basedPrice)}/${context.i18n('monthlySubscription')}`.padEnd(
              priceWidth,
            )
          cpus = `${cpus}CPU`
          memory = `${memory}GB`
          const hardware = `${cpus}/${memory}`.padEnd(hardwareWidth)

          return {
            name: `<reset><b>${name}</b> <dim>${type}</dim> ${hardware} ${monthlyPrice}</reset>`,
            value,
          }
        })

        args.machine = await context.input.select(
          context.i18n('commands.infra.subCommands.init.methods.machine'),
          choices as Based.Context.SelectInputItems[],
        )
      }

      if (!args.min) {
        args.min = await context.input.number(
          context.i18n('commands.infra.subCommands.init.methods.min'),
        )

        args.min = args.min ?? 1
      }

      if (!args.max) {
        args.max = await context.input.number(
          context.i18n('commands.infra.subCommands.init.methods.max'),
        )

        args.max = args.max ?? 1
      }

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
          context.i18n('commands.infra.subCommands.init.methods.fileExtension'),
          choices,
        )
      }
    }

    try {
      await makeInfra({ context, infra: args })

      basedClient.destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
  }

export const makeInfra = async (args: Based.Infra.Init.Make) => {
  const { context, infra } = args
  const { skip } = context.getGlobalOptions()

  if (!skip) {
    if (!infra.path) {
      infra.path = await context.input.default(
        context.i18n('commands.infra.subCommands.init.methods.inputPath'),
        './',
        false,
        isValidPath,
      )
    }
  }

  if (
    !infra.name ||
    !infra.machine ||
    !infra.min ||
    !infra.max ||
    !infra.format ||
    !infra.path
  ) {
    context.print.fail(
      context.i18n('commands.infra.subCommands.init.methods.cannotInit'),
    )
  }

  const fileName = `based.infra.${infra.format}`
  const fullPath = resolve(join(infra.path, fileName))

  if (!infra.path.includes(fileName)) {
    infra.path = fullPath
  }

  const infraTemplate: Based.Infra.Template = exportInfraTemplate(infra)

  context.print
    .line()
    .info(
      context.i18n('commands.infra.subCommands.init.methods.summary.header'),
    )
    .info(
      context.i18n(
        'commands.infra.subCommands.init.methods.summary.name',
        infra.name,
      ),
    )
    .info(
      context.i18n(
        'commands.infra.subCommands.init.methods.summary.description',
        infra.description ?? 'N/A',
      ),
    )
    .info(
      context.i18n(
        'commands.infra.subCommands.init.methods.summary.domains',
        infra.domains.join(' | '),
      ),
    )
    .info(
      context.i18n(
        'commands.infra.subCommands.init.methods.summary.machine',
        infra.machine,
      ),
    )
    .info(
      context.i18n(
        'commands.infra.subCommands.init.methods.summary.scale',
        infra.min,
        infra.max,
      ),
    )
    .info(
      context.i18n(
        'commands.infra.subCommands.init.methods.summary.services',
        Object.keys(infraTemplate.machineConfigs.env.services).length,
      ),
    )
    .info(
      context.i18n(
        'commands.infra.subCommands.init.methods.summary.saveIn',
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

    await saveAsFile(infraTemplate, infra.path, infra.format)
  } catch (error) {
    throw new Error(context.i18n('errors.902', error))
  }

  context.print.success(context.i18n('methods.savedFile', infra.path), true)
}
