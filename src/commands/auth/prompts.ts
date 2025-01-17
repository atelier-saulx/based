import type { BasedClient } from '@based/client'
import { authByEmail, authByState } from '../../helpers/auth/index.js'
import { type AppContext, getBranch } from '../../shared/index.js'
import { isEmailValid, isValueInOptions } from '../../shared/validations.js'

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
  ) =>
  async () => {
    if (users?.length) {
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

      const authorized = (await authByState(
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
  (context: AppContext, projects: unknown[], input: string) =>
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

    //   const newProjectOption = context.i18n('commands.init.methods.project.new')
    const options = [
      ...context.form.normalizeOptions(projects),
      // newProjectOption,
    ]

    // if (!userData?.[org]) {
    //   return newProject(results)
    // }

    input = !input && options.length === 1 ? options[0].value : input

    if (options.length === 1) {
      context.print
        .pipe()
        .info(`You only have one project for the org <b>${org}</b>.`, true)
        .info(`Project selected: <b>${input}</b>.`, true)
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

    // if (project === newProjectOption.value) {
    //   return newProject(results)
    // }

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

    // if (!orgs?.[org]?.[project]) {
    // return newEnv(results)
    // }

    const branch = await getBranch()

    const newEnvOptions = context.i18n('commands.init.methods.env.new')
    const options = [
      ...newEnvOptions,
      ...context.form.normalizeOptions(envs.filter((env) => env !== branch)),
    ]

    input = !input && options.length === 1 ? options[0].value : input

    if (options.length === 1) {
      context.print
        .pipe()
        .info(
          `You only have one env for project <b>${project}</b>, and it has the same name as your branch <b>${branch}</b>.`,
          true,
        )
        .info(`Deploying by #branch: <b>${branch}</b>.`, true)
        .pipe()
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

    if (env === newEnvOptions[0].value) {
      return branch
    }

    return env
  }
