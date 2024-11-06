import { Command } from 'commander'
import { AppContext } from '../../../shared/AppContext.js'
import {
  infraFileName,
  isValidPath,
  saveAsFile,
} from '../../../shared/pathAndFiles.js'
import { join, resolve } from 'node:path'

export const get = (program: Command) => async (infra: Based.Infra.Get) => {
  const context: AppContext = AppContext.getInstance(program)
  await context.getProgram()
  const basedClient = await context.getBasedClient()
  const { org, project, env } = context.get('basedProject')
  const { skip } = context.getGlobalOptions()

  const errorMessage = (option: string, value: string | number) => {
    throw new Error(context.i18n('errors.901', option, value))
  }

  const infraData = await basedClient
    .call(context.endpoints.INFRA_GET, {
      org,
      project,
      env,
    })
    .get()

  infra.machines = infraData?.config?.machineConfigs

  if (infra.machine && !infra.machines[infra.machine]) {
    errorMessage(
      context.i18n('commands.infra.validations.machine'),
      infra.machine,
    )
  } else if (infra.machine && infra.machines[infra.machine]) {
    infra.machines = {
      [infra.machine]: infra.machines[infra.machine],
    }
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

  if (!skip) {
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
        context.i18n('commands.infra.subCommands.get.methods.fileExtension'),
        choices,
      )
    }
  } else {
    if (!infra.format) {
      infra.format = 'ts'
    }
  }

  try {
    await getInfra(context, infra)

    basedClient.destroy()
    return
  } catch (error) {
    throw new Error(error)
  }
}

export const getInfra = async (context: AppContext, infra: Based.Infra.Get) => {
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

  const fileName = infraFileName + '.' + infra.format
  const fullPath = resolve(join(infra.path, fileName))

  if (!infra.path.includes(fileName)) {
    infra.path = fullPath
  }

  context.print
    .line()
    .info(context.i18n('commands.infra.subCommands.get.methods.summary.header'))
    .info(
      context.i18n(
        'commands.infra.subCommands.get.methods.summary.saving',
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
    context.print.stop().loading(context.i18n('methods.savingFile'))

    await saveAsFile(infra.machines, infra.path, infra.format)
  } catch (error) {
    new Error(context.i18n('errors.902', error))
  }

  context.print
    .stop()
    .success(context.i18n('methods.savedFile', infra.path), true)
}
