import type { BasedClient } from '@based/client'
import type { AppContext } from '../../context/index.js'
import { authByEmail, authByState } from '../../helpers/auth/index.js'
import { getBranch, getFile, gitInit } from '../../shared/index.js'
import { isEmailValid, isValueInOptions } from '../../shared/validations.js'
import { newProject } from '../infra/index.js'

export const newUserText =
  (context: AppContext, basedClient: BasedClient) => async () => {
    const { cluster } = await context.getProgram()

    const result = await context.form.text({
      message: context.i18n('commands.auth.methods.email'),
      input: '',
      required: true,
      validation: [
        context.form.collider(
          isEmailValid,
          context.i18n('commands.auth.methods.emailNotValid'),
        ),
      ],
    })

    const authorized = await authByEmail(context, basedClient, cluster, result)

    if (!authorized) {
      return newUserText(context, basedClient)()
    }

    return authorized
  }

export const userSelect =
  (
    context: AppContext,
    basedClient: BasedClient,
    users: Based.Auth.AuthenticatedUser[],
    input: string,
    lastUser?: string,
  ) =>
  async () => {
    if (users?.length) {
      const { cluster } = await context.getProgram()
      const itsNotMe = context.i18n('commands.auth.methods.newUser')

      const usersOptions = [
        ...context.form.normalizeOptions(users, 'email', 'object'),
        itsNotMe,
      ]

      const result = (await context.form.select({
        message: context.i18n('commands.auth.methods.selectUser'),
        input,
        options: usersOptions,
        required: true,
        validation: [
          context.form.collider(
            isEmailValid,
            context.i18n('commands.auth.methods.emailNotValid'),
          ),
        ],
      })) as Based.Auth.AuthenticatedUser

      if (result === itsNotMe.value) {
        return newUserText(context, basedClient)()
      }

      let authorized: false | Based.Auth.AuthenticatedUser

      if (result.email === lastUser) {
        authorized = await authByEmail(
          context,
          basedClient,
          cluster,
          result.email,
        )

        if (!authorized) {
          return newUserText(context, basedClient)()
        }

        return authorized
      }

      authorized = (await authByState(
        context,
        basedClient,
        result,
      )) as Based.Auth.AuthenticatedUser

      if (!authorized) {
        return newUserText(context, basedClient)()
      }

      return authorized
    }

    return newUserText(context, basedClient)()
  }

export const orgSelect =
  (context: AppContext, orgs: unknown[], input: string) => async () => {
    // const newOrgOptions = context.i18n('commands.init.methods.org.new')
    const options = [
      ...context.form.normalizeOptions(orgs),
      // newOrgOptions,
    ]

    input = !input && options.length === 1 ? options[0].value : input

    const org = await context.form.select({
      message: context.i18n('prompts.auth.org'),
      input,
      options,
      required: true,
      validation: [
        context.form.collider(isValueInOptions(options), (org) =>
          context.i18n('commands.init.methods.org.notFound', org ?? input),
        ),
      ],
    })

    // if (org === newOrgOptions.value) {
    //   return newOrg()
    // }

    return org
  }

export const projectSelect =
  (
    context: AppContext,
    basedClientAdmin: BasedClient,
    projects: unknown[],
    input: string,
  ) =>
  async (results: {
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

    const newProjectOption = context.i18n('commands.init.methods.project.new')
    const options = [
      newProjectOption,
      ...context.form.normalizeOptions(projects),
    ]

    input = !input && options.length === 1 ? options[0].value : input

    if (options.length === 1) {
      context.print
        .pipe()
        .log(`You only have one project for the org <b>${org}</b>.`)
        .log(`Project selected: <b>${input}</b>.`)
        .pipe()
    }

    const project = await context.form.select({
      message: context.i18n('commands.init.methods.project.select', org),
      input,
      options,
      required: true,
      validation: [
        context.form.collider(isValueInOptions(options), (project) =>
          context.i18n(
            'commands.init.methods.project.notFound',
            project ?? input,
          ),
        ),
      ],
    })

    if (project === newProjectOption.value) {
      const newProjectName = await newProject(
        context,
        basedClientAdmin,
        true,
        '',
      )(results)

      context.put('globalOptions', { newProjectName })

      return newProjectName
    }

    return project
  }

export const envSelect =
  (context: AppContext, envs: unknown[], input: string) =>
  async (results: { results: { [key: string]: string } }) => {
    if (!results) {
      return ''
    }

    const {
      results: { project },
    } = results

    const { path } = context.get('globalOptions')
    let branch = await getBranch(path)
    const branchOption = context.i18n('commands.init.methods.env.new[0]')
    const options = []

    if (!envs || !envs.length) {
      options.push({ label: 'main', value: 'main' })
    }

    if (branch) {
      options.push(branchOption)
    } else {
      await gitInit(path)

      branch = 'main'
      options.push(branchOption)
    }

    context.put('basedProject', {
      branch: {
        name: branch,
        useDataFrom: null,
      },
    })

    options.push(...context.form.normalizeOptions(envs))

    if (options.length === 2 && branch) {
      context.print
        .pipe()
        .log(
          `You only have one env for project <b>${project}</b>, and it has the same name as your branch <b>${branch}</b>.`,
          false,
        )
        .log(
          `You can deploy using your <b>#branch</b> <dim>(${branch})</dim>, or directly to the <b>main</b> environment.`,
          false,
        )
    }

    const env = await context.form.select({
      message: context.i18n('commands.init.methods.env.select', project),
      input,
      options,
      required: true,
      validation: [
        context.form.collider(isValueInOptions(options), (project) =>
          context.i18n('commands.init.methods.env.notFound', project ?? input),
        ),
      ],
    })

    return env
  }

export const envCreate = async (
  context: AppContext,
  org: string,
  project: string,
  env: string,
  useDataFrom: string,
  skip: boolean,
  basedClientAdmin: BasedClient,
) => {
  if (!env) {
    return ''
  }

  const basedInfraFile = await getFile([
    'based.infra.ts',
    'based.infra.json',
    'based.infra.js',
  ])

  const options = [
    {
      label: `Create a small and clean env named: <b>'${env}'</b>`,
      value: '<new_env>',
      hint: 'Recommended',
    },
  ]

  if (useDataFrom) {
    options.push({
      label: `Create an env named: <b>'${env}'</b>, but cloning: <b>'${useDataFrom}'</b>`,
      value: '<clone_env>',
      hint: '',
    })
  }

  if (basedInfraFile) {
    options.push({
      label: `Create a new env named: <b>'${env}'</b>, but using my Based Infra file`,
      value: '<infra_file>',
      hint: '',
    })
  }

  let createEnv: string

  if (!skip) {
    createEnv = await context.form.select({
      message: `Couldn't validate your data in the cloud. No env found with the name <b>'${env}'</b>.`,
      input: '',
      options,
      required: true,
    })
  } else {
    createEnv = '<new_env>'
  }

  try {
    context.print.pipe()
    context.spinner.start('Creating your new env...')

    switch (createEnv) {
      case '<new_env>':
        await basedClientAdmin.call('create-env', {
          org,
          project,
          env,
          region: 'eu-central-1',
          config: 'small',
        })

        break
      case '<clone_env>':
        await basedClientAdmin.call('clone-env', {
          source: {
            org,
            project,
            env: useDataFrom,
          },
          dest: {
            org,
            project,
            env,
          },
          keepConfig: false,
        })

        break
      case '<infra_file>':
        await basedClientAdmin.call('create-env', {
          org,
          project,
          env,
          region: 'eu-central-1',
          envConfig: basedInfraFile,
        })

        break
    }

    context.print.success('You env is ready!')
    context.print.pipe()

    return true
  } catch (error) {
    throw new Error(error)
  }
}
