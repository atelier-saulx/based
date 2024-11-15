import { readFile } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import AdmZip from 'adm-zip'
import type { Command } from 'commander'
import {
  AppContext,
  BASED_FILE,
  BASED_FILE_BOILERPLATE,
  BASED_FILE_BOILERPLATE_ZIPENTRY,
  clearPackageDependencies,
  getFileByPath,
  isFormatValid,
  isValidPath,
  replaceTilde,
  saveAsFile,
  summaryMaker,
} from '../../shared/index.js'

export const projectInit = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('init')

  cmd.action(async (args: Based.Init.Command) => {
    const { cluster: clusterProject, apiKey: apiKeyProject } =
      await context.getProgram()
    const { skip } = context.getGlobalOptions()
    const basedClient = await context.getBasedClient()

    if (skip) {
      args = {
        name: '',
        description: '',
        path: './',
        format: 'ts',
        tools: [],
        queries: [],
        functions: [],
      }
    }

    const errorMessage = (option: string, value: string | number) =>
      context.i18n('errors.901', option, value ?? '')

    const isNotEmpty = (value: string): boolean =>
      value !== '' && value !== undefined

    const isValidFunctionName = (value: string): boolean => {
      const functionNameRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/
      return functionNameRegex.test(value)
    }

    const isValueInTheObject =
      (options: { label: string; value: string }[]) =>
      (value: string): boolean =>
        options.findIndex((option) => option.value === value) > -1

    const isFunctionsValid = <T extends string>(value: T): boolean =>
      value.split(',').every((element) => isValidFunctionName(element))

    const typedChoices = (
      choices: object,
    ): {
      value: string
      label: string
      hint?: string
    }[] => Object.values(choices)

    let userData = await basedClient
      ?.call(context.endpoints.USER_CLOUD_INFO, {
        userId: basedClient.get('cluster').authState?.userId,
      })
      .get()

    const parseData = (data): Record<string, Record<string, string[]>> => {
      const result: Record<string, Record<string, string[]>> = {}
      for (const item of data) {
        for (const env of item.envs) {
          if (!result[env.org]) {
            result[env.org] = {}
          }
          if (!result[env.org][env.project]) {
            result[env.org][env.project] = []
          }
          if (!result[env.org][env.project].includes(env.env)) {
            result[env.org][env.project].push(env.env)
          }
        }
      }
      return result
    }

    const buildOptions = (data): { label: string; value: string }[] =>
      data.map((value: string) => ({ label: value, value }))

    userData = parseData(userData)
    const hasUserData = Object.keys(userData).length > 0

    const buildToolsOptions = (tools: string[]) => {
      return tools.map((tool) => ({
        value: tool,
        label: tool,
      }))
    }

    const packages = clearPackageDependencies(
      await context.requester.get(
        context.endpoints.BOILERPLATE_PACKAGE.endpoint,
      ),
    )
    const getTools = buildToolsOptions(packages)
    const isToolsValid = <T extends string>(tools: T[]): boolean =>
      tools.every((tool) => packages.includes(tool))

    const newOrg = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.org.input'),
        initialValue: args.org,
        errorMessage: context.i18n('context.input.empty') as string,
        required: true,
        skip: false,
        validation: isNotEmpty,
      })

    const newProject = (results: {
      results: { [key: string]: string }
    }) => {
      if (!results) {
        return ''
      }

      const {
        results: { org },
      } = results

      return context.form.text({
        message: context.i18n('commands.init.methods.project.input', org),
        initialValue: args.project,
        errorMessage: context.i18n('context.input.empty') as string,
        skip: false,
        required: true,
        validation: isNotEmpty,
      })
    }

    const newEnv = (results: {
      results: { [key: string]: string }
    }) => {
      if (!results) {
        return ''
      }

      const {
        results: { project },
      } = results

      return context.form.text({
        message: context.i18n('commands.init.methods.env.input', project),
        initialValue: args.env,
        errorMessage: context.i18n('context.input.empty') as string,
        skip: false,
        required: true,
        validation: isNotEmpty,
      })
    }

    const orgs = async () => {
      const options = [
        ...buildOptions(Object.keys(userData)),
        context.i18n('commands.init.methods.org.new'),
      ]
      const initialValue = options.length === 1 ? options[0].value : args.org

      const org = await context.form.select({
        message: context.i18n('commands.init.methods.org.select'),
        initialValue,
        options,
        required: true,
        errorMessage: context.i18n(
          'commands.init.methods.org.error',
          initialValue,
        ) as string,
        validation: isValueInTheObject(options),
      })

      if (org === '<new_org>') {
        return newOrg()
      }

      return org
    }

    const projects = async (results: {
      results: { [key: string]: string }
    }) => {
      if (!results) {
        return ''
      }

      const {
        results: { org },
      } = results

      if (!org) {
        return ''
      }

      if (!userData?.[org]) {
        return newProject(results)
      }

      const options = buildOptions(Object.keys(userData[org]))
      options.push(context.i18n('commands.init.methods.project.new'))
      const initialValue =
        options.length === 1 ? options[0].value : args.project

      const project = await context.form.select({
        message: context.i18n('commands.init.methods.project.select', org),
        initialValue,
        options,
        required: true,
        errorMessage: context.i18n(
          'commands.init.methods.project.error',
          initialValue,
        ) as string,
        validation: isValueInTheObject(options),
      })

      if (project === '<new_project>') {
        return newProject(results)
      }

      return project
    }

    const envs = async (results: { results: { [key: string]: string } }) => {
      if (!results) {
        return ''
      }

      const {
        results: { org, project },
      } = results

      if (!userData?.[org]?.[project]) {
        return newEnv(results)
      }

      const options = buildOptions(userData[org][project])
      options.push(context.i18n('commands.init.methods.env.new'))
      const initialValue = options.length === 1 ? options[0].value : args.env

      const env = await context.form.select({
        message: context.i18n('commands.init.methods.env.select', project),
        initialValue,
        options,
        required: true,
        errorMessage: context.i18n(
          'commands.init.methods.env.error',
          initialValue,
        ) as string,
        validation: isValueInTheObject(options),
      })

      if (env === '<new_env>') {
        return newEnv(results)
      }

      return env
    }

    const name = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.name'),
        initialValue: args.name,
        required: !skip,
        errorMessage: (error) =>
          errorMessage(
            context.i18n('commands.init.validations.name'),
            error ?? args.name,
          ) as string,
        validation: isNotEmpty,
      })

    const cluster = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.cluster'),
        initialValue: clusterProject ?? '',
        errorMessage: context.i18n('context.input.empty') as string,
        skip: true,
        required: !skip,
        validation: isNotEmpty,
      })

    const apiKey = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.apiKey'),
        initialValue: apiKeyProject ?? '',
        errorMessage: context.i18n('context.input.empty') as string,
        skip: true,
        required: !skip,
        validation: isNotEmpty,
      })

    const description = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.description'),
        initialValue: args.description,
        errorMessage: context.i18n('context.input.empty') as string,
        skip: true,
        required: !skip,
        validation: isNotEmpty,
      })

    const format = () =>
      context.form.select({
        message: context.i18n('commands.init.methods.format'),
        initialValue: args.format,
        options: typedChoices(context.i18n('methods.format')),
        required: true,
        errorMessage: errorMessage(
          context.i18n('commands.init.validations.format'),
          args.format ?? '',
        ) as string,
        validation: isFormatValid,
      })

    const tools = () =>
      context.form.multiSelect({
        message: context.i18n('commands.init.methods.tools'),
        initialValues: args.tools?.toString().split(','),
        required: !skip,
        errorMessage: errorMessage(
          context.i18n('commands.init.validations.tools'),
          args.tools?.toString(),
        ) as string,
        skip: false,
        validation: isToolsValid,
        options: getTools,
      })

    const path = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.path'),
        initialValue: args.path,
        required: !skip,
        skip: false,
        placeholder: './',
        errorMessage: (error) =>
          errorMessage(
            context.i18n('commands.init.validations.path'),
            error ?? args.path,
          ) as string,
        validation: isValidPath,
      })

    const queries = async () => {
      const queries = await context.form.text({
        message: context.i18n('commands.init.methods.queries'),
        initialValue: args.queries?.toString(),
        required: !skip,
        skip: true,
        errorMessage: (error) =>
          errorMessage(
            context.i18n('commands.init.validations.queries'),
            error ?? args.queries?.toString(),
          ) as string,
        validation: isFunctionsValid,
      })

      return queries.split(',')
    }

    const functions = async () => {
      const functions = await context.form.text({
        message: context.i18n('commands.init.methods.functions'),
        initialValue: args.functions?.toString(),
        required: !skip,
        skip: true,
        errorMessage: (error) =>
          errorMessage(
            context.i18n('commands.init.validations.functions'),
            error ?? args.functions?.toString(),
          ) as string,
        validation: isFunctionsValid,
      })

      return functions.split(',')
    }

    const form = await context.form.group({
      header: context.i18n('commands.init.descripion'),
      footer: context.i18n('commands.init.methods.letsCreate'),
      cluster,
      ...(hasUserData && {
        org: orgs,
        project: projects,
        env: envs,
      }),
      ...(!hasUserData && {
        org: newOrg,
        project: newProject,
        env: newEnv,
      }),
      apiKey,
      name,
      description,
      functions,
      queries,
      tools,
      format,
      path,
    })

    try {
      await makeProject({ context, project: form })

      basedClient.destroy()
    } catch (error) {
      throw new Error(error)
    }
  })
}

export const makeProject = async (args: Based.Init.Make) => {
  const { context, project } = args

  if (
    !project.cluster ||
    !project.org ||
    !project.project ||
    !project.env ||
    !project.format ||
    !project.path
  ) {
    context.print.fail(context.i18n('commands.init.methods.cannotInit'))
  }

  const tempPath = join(tmpdir(), BASED_FILE_BOILERPLATE)
  const projectFileName = `${BASED_FILE}.${project.format}`
  const fullPath = resolve(replaceTilde(project.path))
  const projectPath = resolve(join(project.path, projectFileName))

  if (!project.path.includes(projectFileName)) {
    project.path = projectPath
  }

  const doIt = await summaryMaker(context, [
    context.i18n('commands.init.methods.summary.header'),
    context.i18n('commands.init.methods.summary.name', project.name),
    context.i18n(
      'commands.init.methods.summary.description',
      project.description ?? 'N/A',
    ),
    context.i18n(
      'commands.init.methods.summary.cloud',
      project.cluster,
      project.org,
      project.project,
      project.env,
    ),
    context.i18n('commands.init.methods.summary.apiKey', project.apiKey),
    context.i18n(
      'commands.init.methods.summary.functions',
      `${project.queries?.join(', ')}, ${project.functions?.join(', ')}`,
    ),
    context.i18n(
      'commands.init.methods.summary.tools',
      project.tools?.join(', '),
    ),
    context.i18n('commands.init.methods.summary.saveIn', project.path),
  ])

  try {
    if (doIt) {
      const boilerplate = await context.requester.download(
        context.endpoints.BOILERPLATE_ZIP.endpoint,
        tempPath,
      )

      if (boilerplate) {
        const zip = new AdmZip(tempPath)
        zip.extractEntryTo(BASED_FILE_BOILERPLATE_ZIPENTRY, fullPath, false)

        let pkg: {
          name: string
          version: string
          description: string
          scripts: {
            zip?: string
          }
        }

        try {
          pkg = await getFileByPath<typeof pkg>(`${fullPath}/package.json`)

          pkg.name = project.name
          pkg.description = project.description
          pkg.version = '0.1.0'

          const { scripts } = pkg
          const { zip, ...rest } = scripts
          pkg.scripts = rest

          try {
            await saveAsFile(pkg, `${fullPath}/package.json`, 'json')
          } catch (error) {
            throw new Error(
              'Could not update package.json in boilerplate folder.',
            )
          }
        } catch (error) {
          throw new Error(
            'Could not load package.json from boilerplate folder.',
          )
        }
      }

      const basedProjectTemplate = {
        ...(project.cluster !== undefined && { cluster: project.cluster }),
        ...(project.org !== undefined && { org: project.org }),
        ...(project.project !== undefined && { project: project.project }),
        ...(project.env !== undefined && { env: project.env }),
        ...(project.apiKey !== undefined && { apiKey: project.apiKey }),
      }

      context.spinner.start(context.i18n('methods.savingFile'))

      await saveAsFile(basedProjectTemplate, project.path, project.format)
    }
  } catch (error) {
    throw new Error(context.i18n('errors.902', error))
  }

  context.print.success(context.i18n('methods.savedFile', project.path), true)
}
