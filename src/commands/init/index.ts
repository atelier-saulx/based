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

    const isNotEmpty = (value: string): boolean =>
      value !== '' && value !== undefined

    const isValidFunctionName = (value: string): boolean => {
      const functionNameRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/
      return functionNameRegex.test(value)
    }

    const isValueInOptions =
      (options: { label: string; value: string }[]) =>
      (value: string): boolean =>
        options.findIndex((option) => option.value === value) > -1

    const isValueNotInOptions =
      (options: { label: string; value: string }[]) =>
      (value: string): boolean =>
        options?.length
          ? options.findIndex((option) => option.value === value) === -1
          : true

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

    const validator =
      (
        validation: (value: string | string[]) => boolean,
        output: string | ((error: string) => string),
      ) =>
      (value: string): string | undefined => {
        const isValid = validation(value)

        if (!isValid) {
          if (typeof output === 'string') {
            return output
          }

          return output(value)
        }

        return
      }

    const validationMessage = (option: string) => (value: string | number) =>
      context.i18n('errors.901', option, value ?? '')

    const cluster = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.cluster'),
        input: clusterProject ?? '',
        skip: true,
        required: !skip,
        validation: [
          validator(isNotEmpty, context.i18n('context.input.empty')),
        ],
      })

    const newOrgOptions = context.i18n('commands.init.methods.org.new')
    const orgOptions = () => [
      ...buildOptions(Object.keys(userData)),
      newOrgOptions,
    ]
    const orgs = async () => {
      const options = orgOptions()
      const initialValue = options.length === 1 ? options[0].value : args.org
      const org = await context.form.select({
        message: context.i18n('commands.init.methods.org.select'),
        input: initialValue,
        options,
        required: true,
        validation: [
          validator(isValueInOptions(options), (org) =>
            context.i18n(
              'commands.init.methods.org.notFound',
              org ?? initialValue,
            ),
          ),
        ],
      })

      if (org === newOrgOptions.value) {
        return newOrg()
      }

      return org
    }

    const newProjectOption = context.i18n('commands.init.methods.project.new')
    const projectOptions = (org: string) =>
      userData?.[org] && [
        ...buildOptions(Object.keys(userData[org])),
        newProjectOption,
      ]
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

      const options = projectOptions(org)
      const initialValue =
        options.length === 1 ? options[0].value : args.project
      const project = await context.form.select({
        message: context.i18n('commands.init.methods.project.select', org),
        input: initialValue,
        options,
        required: true,
        validation: [
          validator(isValueInOptions(options), (project) =>
            context.i18n(
              'commands.init.methods.project.notFound',
              project ?? initialValue,
            ),
          ),
        ],
      })

      if (project === newProjectOption.value) {
        return newProject(results)
      }

      return project
    }

    const newEnvOptions = context.i18n('commands.init.methods.env.new')
    const envOptions = (org: string, project: string) =>
      userData?.[org]?.[project] && [
        ...buildOptions(userData[org][project]),
        ...newEnvOptions,
      ]
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

      const options = envOptions(org, project)
      const initialValue = options.length === 1 ? options[0].value : args.env
      const env = await context.form.select({
        message: context.i18n('commands.init.methods.env.select', project),
        input: initialValue,
        options,
        required: true,
        validation: [
          validator(isValueInOptions(options), (project) =>
            context.i18n(
              'commands.init.methods.env.notFound',
              project ?? initialValue,
            ),
          ),
        ],
      })

      if (env === newEnvOptions[0].value) {
        return newEnv(results)
      }

      return env
    }

    const newOrg = async () => {
      const result = await context.form.text({
        message: context.i18n('commands.init.methods.org.input'),
        input: args.org,
        required: true,
        skip: false,
        validation: [
          validator(isNotEmpty, context.i18n('context.input.empty')),
          validator(isValueNotInOptions(orgOptions()), (org) =>
            context.i18n('commands.init.methods.org.found', org),
          ),
        ],
      })

      await basedClient.call(context.endpoints.CREATE_ORG, {
        org: result,
        userId: basedClient.get('cluster').authState.userId,
      })

      return result
    }

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
        input: args.project,
        skip: false,
        required: true,
        validation: [
          validator(isNotEmpty, context.i18n('context.input.empty')),
          validator(isValueNotInOptions(projectOptions(org)), (project) =>
            context.i18n('commands.init.methods.project.found', project),
          ),
        ],
      })
    }

    const newEnv = (results: {
      results: { [key: string]: string }
    }) => {
      if (!results) {
        return ''
      }

      const {
        results: { org, project },
      } = results

      return context.form.text({
        message: context.i18n('commands.init.methods.env.input', project),
        input: args.env,
        skip: false,
        required: true,
        validation: [
          validator(isNotEmpty, context.i18n('context.input.empty')),
          validator(isValueNotInOptions(envOptions(org, project)), (env) =>
            context.i18n('commands.init.methods.env.found', env),
          ),
        ],
      })
    }

    const apiKey = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.apiKey'),
        input: apiKeyProject ?? '',
        skip: true,
        required: !skip,
        validation: [
          validator(isNotEmpty, context.i18n('context.input.empty')),
        ],
      })

    const name = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.name'),
        input: args.name,
        required: !skip,
        validation: [
          validator(
            isNotEmpty,
            validationMessage(context.i18n('commands.init.validations.name')),
          ),
        ],
      })

    const description = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.description'),
        input: args.description,
        skip: true,
        required: !skip,
        validation: [
          validator(isNotEmpty, context.i18n('context.input.empty')),
        ],
      })

    const functions = async () => {
      const functions = await context.form.text({
        message: context.i18n('commands.init.methods.functions'),
        input: args.functions?.toString(),
        required: !skip,
        skip: true,
        validation: [
          validator(
            isFunctionsValid,
            validationMessage(
              context.i18n('commands.init.validations.functions'),
            ),
          ),
        ],
      })

      return functions.split(',')
    }

    const queries = async () => {
      const queries = await context.form.text({
        message: context.i18n('commands.init.methods.queries'),
        input: args.queries?.toString(),
        required: !skip,
        skip: true,
        validation: [
          validator(
            isFunctionsValid,
            validationMessage(
              context.i18n('commands.init.validations.functions'),
            ),
          ),
        ],
      })

      return queries.split(',')
    }

    const tools = () =>
      context.form.multiSelect({
        message: context.i18n('commands.init.methods.tools'),
        input: args.tools?.toString().split(','),
        required: !skip,
        skip: false,
        validation: [
          validator(
            isToolsValid,
            validationMessage(context.i18n('commands.init.validations.tools')),
          ),
        ],
        options: getTools,
      })

    const format = () =>
      context.form.select({
        message: context.i18n('commands.init.methods.format'),
        input: args.format,
        options: typedChoices(context.i18n('methods.format')),
        required: true,
        validation: [
          validator(
            isFormatValid,
            validationMessage(context.i18n('commands.init.validations.tools')),
          ),
        ],
      })

    const path = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.path'),
        input: args.path,
        required: !skip,
        skip: false,
        placeholder: './',
        validation: [
          validator(
            isValidPath,
            validationMessage(context.i18n('commands.init.validations.path')),
          ),
        ],
      })

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
          } catch {
            throw new Error(
              'Could not update package.json in boilerplate folder.',
            )
          }
        } catch {
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
