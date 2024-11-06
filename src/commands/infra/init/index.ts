import { Command } from 'commander'
import {
  AppContext,
  infraFileName,
  isValidPath,
  saveAsFile,
} from '../../../shared/index.js'
import { join, resolve } from 'node:path'
import { exportInfraTemplate } from '../../../helpers/index.js'

export const init = (program: Command) => async (infra: Based.Infra.Init) => {
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
  const machineList: any[] = await basedClient
    .call(context.endpoints.INFRA_MACHINE_TYPES)
    .get()

  const errorMessage = (option: string, value: string | number) => {
    throw new Error(context.i18n('errors.901', option, value))
  }

  if (infra.machine && machineList.indexOf(infra.machine) < 0) {
    errorMessage(
      context.i18n('commands.infra.validations.machine'),
      infra.machine,
    )
  }

  if (infra.min && isNaN(Number(infra.min))) {
    errorMessage(context.i18n('commands.infra.validations.min'), infra.min)
  }

  if (infra.max && isNaN(Number(infra.max))) {
    errorMessage(context.i18n('commands.infra.validations.max'), infra.max)
  }

  if (infra.path && !isValidPath(infra.path)) {
    errorMessage(context.i18n('commands.infra.validations.path'), infra.path)
  }

  if (
    infra.format &&
    infra.format !== 'js' &&
    infra.format !== 'json' &&
    infra.format !== 'ts'
  ) {
    errorMessage(context.i18n('commands.infra.validations.path'), infra.path)
  }

  context.print.warning(
    context.i18n('commands.infra.subCommands.init.methods.warning'),
    true,
  )

  if (!skip) {
    if (!infra.name) {
      infra.name = await context.input.default(
        context.i18n('commands.infra.subCommands.init.methods.name'),
        '',
        false,
        isNotEmpty,
      )
    }

    if (!infra.description) {
      infra.description = await context.input.default(
        context.i18n('commands.infra.subCommands.init.methods.description'),
        '',
        true,
        isNotEmpty,
      )
    }

    if (!infra.domains || !infra.domains.length) {
      const domainsInput = await context.input.default(
        context.i18n('commands.infra.subCommands.init.methods.domains'),
        '',
        true,
        isDomain,
      )

      infra.domains = domainsInput.split(',').map((domain) => domain.trim())
    }

    if (!infra.machine) {
      const nameWidth = 12
      const typeWidth = 14
      const hardwareWidth = 12
      const priceWidth = 11

      let choices = machineList

      choices = choices.map(({ name, value, basedPrice, cpus, memory }) => {
        name = name.padEnd(nameWidth)
        const type = `(${value})`.padEnd(typeWidth)
        const monthlyPrice = (
          context.i18n('currency', basedPrice) +
          '/' +
          context.i18n('monthlySubscription')
        ).padEnd(priceWidth)
        cpus = cpus + 'CPU'
        memory = memory + 'GB'
        const hardware = `${cpus}/${memory}`.padEnd(hardwareWidth)

        return {
          name: `<reset><b>${name}</b> <dim>${type}</dim> ${hardware} ${monthlyPrice}</reset>`,
          value,
        }
      })

      infra.machine = await context.input.select(
        context.i18n('commands.infra.subCommands.init.methods.machine'),
        choices,
      )
    }

    if (!infra.min) {
      infra.min = await context.input.number(
        context.i18n('commands.infra.subCommands.init.methods.min'),
      )

      infra.min = infra.min ?? 1
    }

    if (!infra.max) {
      infra.max = await context.input.number(
        context.i18n('commands.infra.subCommands.init.methods.max'),
      )

      infra.max = infra.max ?? 1
    }

    if (!infra.format) {
      const choices = [
        {
          name: context.i18n('methods.extensions.ts'),
          value: 'ts',
        },
        {
          name: context.i18n('methods.extensions.json'),
          value: 'json',
        },
        {
          name: context.i18n('methods.extensions.js'),
          value: 'js',
        },
      ]

      infra.format = await context.input.select(
        context.i18n('commands.infra.subCommands.init.methods.fileExtension'),
        choices,
      )
    }
  }

  try {
    await makeInfra(context, infra)

    basedClient.destroy()
    return
  } catch (error) {
    throw new Error(error)
  }
}

export const makeInfra = async (
  context: AppContext,
  infra: Based.Infra.Init,
) => {
  const { skip } = context.getGlobalOptions()

  if (
    !infra.name ||
    !infra.machine ||
    !infra.min ||
    !infra.max ||
    !infra.format
  ) {
    context.print.fail(
      context.i18n('commands.infra.subCommands.init.methods.cannotInit'),
    )
  }

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

  const fileName = infraFileName + '.' + infra.format
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
    context.print.loading(context.i18n('methods.savingFile'))

    await saveAsFile(infraTemplate, infra.path, infra.format)
  } catch (error) {
    new Error(context.i18n('errors.902', error))
  }

  context.print.success(context.i18n('methods.savedFile', infra.path), true)
}
