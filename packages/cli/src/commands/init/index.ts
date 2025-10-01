import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { confirm } from '@clack/prompts'
import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'
import {
  BASED_FILE,
  BASED_FILE_BOILERPLATE,
  BASED_FILE_BOILERPLATE_ZIPENTRY,
  extractZipEntry,
  getFileByPath,
  isFormatValid,
  isValidPath,
  npmInstall,
  replaceTilde,
  saveAsFile,
  summaryMaker,
} from '../../shared/index.js'
import { isNotEmpty } from '../../shared/validations.js'
import { devServer } from '../dev/index.js'

export const projectInit = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('init')

  cmd.action(async (args: Based.Init.Command) => {
    const basedClient = await context.getBasedClient()
    const {
      cluster,
      org,
      project,
      env,
      apiKey: apiKeyProject,
    } = await context.getProgram()
    const { skip, path: globalPath } = context.getGlobalOptions()

    if (skip) {
      args = {
        name: '',
        description: '',
        path: './',
        format: 'ts',
        dependencies: [],
        queries: [],
        functions: [],
      }
    }

    if (!args.path && globalPath) {
      args.path = globalPath
    }

    const typedChoices = (
      choices: object,
    ): {
      value: string
      label: string
      hint?: string
    }[] => Object.values(choices)

    const buildToolsOptions = (tools: string[]) => {
      return tools.map((tool) => ({
        value: tool,
        label: tool,
      }))
    }
    const buildToolsInput = (tools: string[]) => {
      return tools.map((tool) => tool)
    }

    const packages: Record<string, unknown> = await context.requester.get(
      context.endpoints.BOILERPLATE_PACKAGE.endpoint,
    )

    const packagesDependencies = Object.keys(packages.dependencies)
    const packagesDevDependencies = Object.keys(packages.devDependencies)

    const isToolsValid = <T extends string>(tools: T[]): boolean =>
      tools.every(
        (tool) =>
          packagesDependencies.includes(tool) ||
          packagesDevDependencies.includes(tool),
      )

    const validationMessage = (option: string) => (value: string | number) =>
      context.i18n('errors.901', option, value ?? '')

    const apiKey = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.apiKey'),
        input: apiKeyProject ?? '',
        skip: true,
        required: !skip,
        validation: [
          context.form.collider(
            isNotEmpty,
            context.i18n('context.input.empty'),
          ),
        ],
      })

    const name = () =>
      context.form.text({
        message: context.i18n('commands.init.methods.name'),
        input: args.name,
        skip: true,
        required: !skip,
        validation: [
          context.form.collider(
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
          context.form.collider(
            isNotEmpty,
            context.i18n('context.input.empty'),
          ),
        ],
      })

    // const functions = async () => {
    //   const functions = await context.form.text({
    //     message: context.i18n('commands.init.methods.functions'),
    //     input: args.functions?.toString(),
    //     required: !skip,
    //     skip: true,
    //     validation: [
    //       context.form.collider(
    //         isFunctionsValid,
    //         validationMessage(
    //           context.i18n('commands.init.validations.functions'),
    //         ),
    //       ),
    //     ],
    //   })

    //   return functions.split(',')
    // }

    // const queries = async () => {
    //   const queries = await context.form.text({
    //     message: context.i18n('commands.init.methods.queries'),
    //     input: args.queries?.toString(),
    //     required: !skip,
    //     skip: true,
    //     validation: [
    //       context.form.collider(
    //         isFunctionsValid,
    //         validationMessage(
    //           context.i18n('commands.init.validations.functions'),
    //         ),
    //       ),
    //     ],
    //   })

    //   return queries.split(',')
    // }

    const dependencies = () => {
      let input = args.dependencies?.toString().split(',')

      if (!input) {
        input = buildToolsInput(packagesDependencies)
      }

      return context.form.multiSelect({
        message: context.i18n('commands.init.methods.dependencies'),
        input,
        required: true,
        skip: false,
        validation: [
          context.form.collider(
            isToolsValid,
            validationMessage(
              context.i18n('commands.init.validations.dependencies'),
            ),
          ),
        ],
        options: buildToolsOptions(packagesDependencies),
      })
    }

    const devDependencies = () => {
      let input = args.dependencies?.toString().split(',')

      if (!input) {
        input = buildToolsInput(packagesDevDependencies)
      }

      return context.form.multiSelect({
        message: context.i18n('commands.init.methods.devDependencies'),
        input,
        required: true,
        skip: false,
        validation: [
          context.form.collider(
            isToolsValid,
            validationMessage(
              context.i18n('commands.init.validations.dependencies'),
            ),
          ),
        ],
        options: buildToolsOptions(packagesDevDependencies),
      })
    }

    const format = () =>
      context.form.select({
        message: context.i18n('commands.init.methods.format'),
        input: args.format,
        options: typedChoices(context.i18n('methods.format')),
        required: true,
        validation: [
          context.form.collider(
            isFormatValid,
            validationMessage(
              context.i18n('commands.init.validations.dependencies'),
            ),
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
          context.form.collider(
            isValidPath,
            validationMessage(context.i18n('commands.init.validations.path')),
          ),
        ],
      })

    const form = await context.form.group({
      header: context.i18n('commands.init.descripion'),
      footer: context.i18n('commands.init.methods.letsCreate'),
      apiKey,
      name,
      description,
      // functions,
      // queries,
      dependencies,
      devDependencies,
      format,
      path,
    })

    try {
      await makeProject({
        context,
        project: { ...form, cluster, org, project, env },
      })

      const dev = await confirm({
        message: 'Do you want to start the dev server now?',
      })

      if (dev) {
        return devServer({})
      }

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

  const doIt = await summaryMaker(
    context,
    [
      context.i18n('commands.init.methods.summary.header'),
      project.name &&
        context.i18n('commands.init.methods.summary.name', project.name),
      project.description &&
        context.i18n(
          'commands.init.methods.summary.description',
          project.description,
        ),
      context.i18n(
        'commands.init.methods.summary.cloud',
        project.cluster,
        project.org,
        project.project,
        project.env,
      ),
      project.apiKey &&
        context.i18n('commands.init.methods.summary.apiKey', project.apiKey),
      // ...((project.queries || project.functions) &&
      //   context.i18n(
      //     'commands.init.methods.summary.functions',
      //     `${project.queries?.join(', ')}, ${project.functions?.join(', ')}`,
      //   )),
      context.i18n(
        'commands.init.methods.summary.dependencies',
        [...project.dependencies, ...project.devDependencies]?.join(', '),
      ),
      context.i18n('commands.init.methods.summary.saveIn', project.path),
    ].filter(Boolean),
  )

  try {
    if (doIt) {
      const boilerplate = await context.requester.download(
        context.endpoints.BOILERPLATE_ZIP.endpoint,
        tempPath,
      )

      const filterDependencies = (
        dependencies: Record<string, string>,
        keysToKeep: string[],
      ): Record<string, string> => {
        const filteredDependencies: Record<string, string> = {}

        for (const key of keysToKeep) {
          if (dependencies[key]) {
            filteredDependencies[key] = dependencies[key]
          }
        }

        return filteredDependencies
      }

      if (boilerplate) {
        await extractZipEntry(
          context,
          tempPath,
          BASED_FILE_BOILERPLATE_ZIPENTRY,
          fullPath,
        )

        let pkg: {
          name: string
          version: string
          description: string
          dependencies: {
            [key: string]: string
          }
          devDependencies: {
            [key: string]: string
          }
        }

        try {
          pkg = await getFileByPath<typeof pkg>(`${fullPath}/package.json`)

          pkg.name = project.name || pkg.name
          pkg.description = project.description || pkg.description
          pkg.version = '0.1.0'
          pkg.dependencies = filterDependencies(
            pkg.dependencies,
            project.dependencies,
          )
          pkg.devDependencies = filterDependencies(
            pkg.devDependencies,
            project.devDependencies,
          )

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

      context.spinner.start(context.i18n('methods.projectCreation'))

      await saveAsFile(basedProjectTemplate, project.path, project.format)

      context.spinner.stop('Project created!')

      const npm = await confirm({
        message: 'Do you want to install your dependencies now?',
      })

      if (npm) {
        try {
          context.spinner.start('Installing your dependencies')

          const install = await npmInstall(
            dirname(project.path) || process.cwd(),
          )

          if (install) {
            context.spinner.stop('Dependencies installed successfully!', true)
            context.print.line()
          }
        } catch (error) {
          throw new Error(error)
        }
      }
    }
  } catch (error) {
    throw new Error(context.i18n('errors.917', error))
  }

  context.print.success(
    context.i18n('methods.projectCreated', `<b>${project.path}</b>`),
    true,
  )
}
