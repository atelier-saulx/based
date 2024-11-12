import { join, resolve } from 'node:path'
import { group, log, multiselect, select, text } from '@clack/prompts'
import type { Command } from 'commander'
import {
  AppContext,
  colorize,
  isFormatValid,
  isValidPath,
  saveAsFile,
} from '../../shared/index.js'

export const projectInit = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('init')

  cmd.action(async (args: Based.Init.Command) => {
    const errorMessage = (option: string, value: string | number) =>
      context.i18n('errors.901', option, value ?? '')

    const isNotEmpty = (value: string): boolean =>
      value !== '' && value !== undefined

    const isToolsValid = <T extends string>(tools: T[]): boolean =>
      tools.every((tool) => context.i18n('methods.tools')[tool])

    const typedChoices = (
      choices: object,
    ): {
      value: string
      label: string
      hint?: string
    }[] => Object.values(choices)

    const name = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.name'),
        initialValue: args.name,
        errorMessage: (error) =>
          errorMessage(
            context.i18n('commands.init.validations.name'),
            error ?? args.name,
          ),
        validation: isNotEmpty,
      })

    const format = () =>
      context.form.select({
        message: context.i18n('commands.init.methods.fileExtension'),
        options: typedChoices(context.i18n('methods.extensions')),
      })

    const tools = () =>
      context.form.multiSelect({
        message: context.i18n('commands.init.methods.fileExtension'),
        initialValues: String(args.tools).split(','),
        errorMessage: errorMessage(
          context.i18n('commands.init.validations.tools'),
          String(args.tools),
        ),
        skip: true,
        validation: isToolsValid,
        options: typedChoices(context.i18n('methods.tools')),
      })

    const path = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.path'),
        initialValue: args.path,
        placeholder: './',
        errorMessage: (error) =>
          errorMessage(
            context.i18n('commands.init.validations.path'),
            error ?? args.path,
          ),
        validation: isValidPath,
      })

    const form = await context.form.group({
      tools,
      name,
      path,
      format,
    })

    console.log('form', form)

    // console.log('form', form)
    // const { skip } = context.getGlobalOptions()
    // const { cluster, apiKey } = await context.getProgram()
    // const basedClient = await context.getBasedClient()
    // const isNotEmpty = (value: string): boolean =>
    //   value !== '' && value !== undefined

    // const isValidFunctionName = (value: string): boolean => {
    //   const functionNameRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/
    //   return functionNameRegex.test(value)
    // }
    // const isFunctionsValid = <T extends string>(value: T[]): boolean =>
    //   value.every((element) => isValidFunctionName(element))
    // const errorMessage = (option: string, value: string | number) => {
    //   throw new Error(context.i18n('errors.901', option, value))
    // }
    // if (args.tools && !isToolsValid(args.tools)) {
    //   errorMessage(
    //     context.i18n('commands.init.validations.tools'),
    //     args.tools.join(', '),
    //   )
    // }
    // if (args.queries && !isFunctionsValid(args.queries)) {
    //   errorMessage(
    //     context.i18n('commands.init.validations.queries'),
    //     args.queries.join(', '),
    //   )
    // }
    // if (args.functions && !isFunctionsValid(args.functions)) {
    //   errorMessage(
    //     context.i18n('commands.init.validations.functions'),
    //     args.functions.join(', '),
    //   )
    // }
    // if (!skip) {
    //   let userData = await basedClient
    //     ?.call(context.endpoints.USER_CLOUD_INFO, {
    //       userId: basedClient.get('cluster').authState?.userId,
    //     })
    //     .get()
    //   const parseData = (data): Record<string, Record<string, string[]>> => {
    //     const result: Record<string, Record<string, string[]>> = {}
    //     for (const item of data) {
    //       for (const env of item.envs) {
    //         if (!result[env.org]) {
    //           result[env.org] = {}
    //         }
    //         if (!result[env.org][env.project]) {
    //           result[env.org][env.project] = []
    //         }
    //         if (!result[env.org][env.project].includes(env.env)) {
    //           result[env.org][env.project].push(env.env)
    //         }
    //       }
    //     }
    //     return result
    //   }
    //   const buildChoices = (data): { value: string; name: string }[] =>
    //     data.map((value) => ({ name: value, value }))
    //   userData = parseData(userData)
    //   const hasUserData = Object.keys(userData).length > 0
    //   if (!args.name) {
    //     args.name = await context.input.default(
    //       context.i18n('commands.init.methods.name'),
    //       '',
    //       false,
    //       isNotEmpty,
    //     )
    //   }
    //   if (!args.description) {
    //     args.description = await context.input.default(
    //       context.i18n('commands.init.methods.description'),
    //       '',
    //       true,
    //       isNotEmpty,
    //     )
    //   }
    //   if (!args.cluster) {
    //     args.cluster = await context.input.default(
    //       context.i18n('commands.init.methods.cluster'),
    //       cluster ?? '',
    //       true,
    //       isNotEmpty,
    //     )
    //   }
    //   if (!args.org) {
    //     if (hasUserData) {
    //       args.org = await context.input.select(
    //         context.i18n('commands.init.methods.org.select'),
    //         buildChoices(Object.keys(userData)),
    //       )
    //     } else {
    //       args.org = await context.input.default(
    //         context.i18n('commands.init.methods.org.input'),
    //         '',
    //         false,
    //         isNotEmpty,
    //       )
    //     }
    //   }
    //   if (!args.project) {
    //     if (hasUserData) {
    //       args.project = await context.input.select(
    //         context.i18n('commands.init.methods.project.select'),
    //         buildChoices(Object.keys(userData[args.org])),
    //       )
    //     } else {
    //       args.project = await context.input.default(
    //         context.i18n('commands.init.methods.project.input'),
    //         '',
    //         false,
    //         isNotEmpty,
    //       )
    //     }
    //   }
    //   if (!args.env) {
    //     if (hasUserData) {
    //       args.env = await context.input.select(
    //         context.i18n('commands.init.methods.env.select'),
    //         buildChoices(userData[args.org][args.project]),
    //       )
    //     } else {
    //       args.env = await context.input.default(
    //         context.i18n('commands.init.methods.env.input'),
    //         '',
    //         false,
    //         isNotEmpty,
    //       )
    //     }
    //   }
    //   if (!args.apiKey) {
    //     args.apiKey = await context.input.default(
    //       context.i18n('commands.init.methods.apiKey'),
    //       apiKey ?? '',
    //       true,
    //       isNotEmpty,
    //     )
    //   }
    //   if (!args.queries || !args.queries.length) {
    //     args.queries = (
    //       await context.input.default(
    //         context.i18n('commands.init.methods.queries'),
    //         '',
    //         true,
    //         (value) => isFunctionsValid(value.split(',')),
    //       )
    //     )?.split(',')
    //   }
    //   if (!args.functions || !args.functions.length) {
    //     args.functions = (
    //       await context.input.default(
    //         context.i18n('commands.init.methods.functions'),
    //         '',
    //         true,
    //         (value) => isFunctionsValid(value.split(',')),
    //       )
    //     )?.split(',')
    //   }
    //   if (!args.tools) {
    //     const choices: Based.Context.SelectInputItems[] = Object.values(
    //       context.i18n('methods.tools'),
    //     ) as unknown as Based.Context.SelectInputItems[]
    //     args.tools = await context.input.select(
    //       context.i18n('commands.init.methods.tools'),
    //       choices,
    //       true,
    //     )
    //   }
    //   if (!args.format) {
    //     const choices: Based.Context.SelectInputItems[] = Object.values(
    //       context.i18n('methods.extensions'),
    //     ) as unknown as Based.Context.SelectInputItems[]
    //     args.format = await context.input.select(
    //       context.i18n('commands.init.methods.fileExtension'),
    //       choices,
    //     )
    //   }
    // }
    // try {
    //   // await makeProject({ context, project: args })
    //   // basedClient.destroy()
    // } catch (error) {
    //   throw new Error(error)
    // }
  })
}

export const makeProject = async (args: Based.Init.Make) => {
  const { context, project } = args
  const { skip } = context.getGlobalOptions()

  if (!skip) {
    if (!project.path) {
      project.path = await context.input.default(
        context.i18n('commands.init.methods.path'),
        './',
        false,
        isValidPath,
      )
    }
  }

  if (
    !project.name ||
    !project.format ||
    !project.cluster ||
    !project.org ||
    !project.project ||
    !project.env ||
    !project.path
  ) {
    context.print.fail(context.i18n('commands.init.methods.cannotInit'))
  }

  const fileName = `based.${project.format}`
  const fullPath = resolve(join(project.path, fileName))

  if (!project.path.includes(fileName)) {
    project.path = fullPath
  }

  context.print
    .line()
    .info(context.i18n('commands.init.methods.summary.header'))
    .info(context.i18n('commands.init.methods.summary.name', project.name))
    .info(
      context.i18n(
        'commands.init.methods.summary.description',
        project.description ?? 'N/A',
      ),
    )
    .info(
      context.i18n(
        'commands.init.methods.summary.cloud',
        project.cluster,
        project.org,
        project.project,
        project.env,
      ),
    )

  if (project.queries.length || project.functions.length) {
    context.print.info(
      context.i18n(
        'commands.init.methods.summary.functions',
        `${project.queries?.join(', ')}, ${project.functions?.join(', ')}`,
      ),
    )
  }

  if (project.tools.length) {
    context.print.info(
      context.i18n(
        'commands.init.methods.summary.tools',
        project.tools?.join(', '),
      ),
    )
  }

  context.print
    .info(context.i18n('commands.init.methods.summary.saveIn', project.path))
    .line()

  if (!skip) {
    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      throw new Error(context.i18n('methods.aborted'))
    }
  }

  const basedProjectTemplate = {
    ...(project.cluster !== undefined && { cluster: project.cluster }),
    ...(project.org !== undefined && { org: project.org }),
    ...(project.project !== undefined && { project: project.project }),
    ...(project.env !== undefined && { env: project.env }),
    ...(project.apiKey !== undefined && { apiKey: project.apiKey }),
  }

  try {
    context.print.loading(context.i18n('methods.savingFile'))

    await saveAsFile(basedProjectTemplate, project.path, project.format)
  } catch (error) {
    throw new Error(context.i18n('errors.902', error))
  }

  context.print.success(context.i18n('methods.savedFile', project.path), true)
}
