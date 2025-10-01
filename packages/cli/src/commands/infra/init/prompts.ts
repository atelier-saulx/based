import type { BasedClient } from '@based/client'
import type { AppContext } from '../../../context/index.js'
import { isNotEmpty } from '../../../shared/validations.js'
import { envCreate } from '../../auth/prompts.js'

// type MachineList = {
//   name?: string
//   label: string
//   value: string
//   basedPrice?: string
//   cpus?: string
//   memory?: string
// }

// const newOrg = async () => {
//   const result = await context.form.text({
//     message: context.i18n('commands.init.methods.org.input'),
//     input: args.org,
//     required: true,
//     skip: false,
//     validation: [
//       context.form.collider(
//         isNotEmpty,
//         context.i18n('context.input.empty'),
//       ),
//       context.form.collider(isValueNotInOptions(orgOptions()), (org) =>
//         context.i18n('commands.init.methods.org.found', org),
//       ),
//     ],
//   })

//   await basedClient.call(context.endpoints.CREATE_ORG, {
//     org: result,
//     userId: basedClient.get('cluster').authState.userId,
//   })

//   return result
// }

export const newProject =
  (
    context: AppContext,
    basedClientAdmin: BasedClient,
    required: boolean,
    input: string = '',
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

    const newProject = await context.form.text({
      message: context.i18n('commands.init.methods.project.input', org),
      input,
      skip: false,
      required,
      validation: [
        context.form.collider(isNotEmpty, context.i18n('context.input.empty')),
      ],
    })

    if (newProject) {
      await envCreate(
        context,
        org,
        newProject,
        'main',
        '',
        true,
        basedClientAdmin,
      )
    }

    return newProject
  }

export const clusterText =
  (context: AppContext, required: boolean, input: string = '') =>
  async () =>
    context.form.text({
      message: context.i18n('commands.init.methods.cluster'),
      input,
      skip: true,
      required, //: !skip,
      validation: [
        context.form.collider(isNotEmpty, context.i18n('context.input.empty')),
      ],
    })

export const infraInit = async (
  context: AppContext,
  args: ReturnType<typeof infraInit>,
) => {
  const basedClient = await context.getBasedClient()

  return {
    env: async (results: {
      results: { [key: string]: string }
    }) => {
      if (!results) {
        return ''
      }

      const {
        results: { org, project },
      } = results

      const isEnvFound = async (env: string) => {
        try {
          await basedClient
            .call(context.endpoints.INFRA_GET, {
              org,
              project,
              env,
            })
            .get()

          return true
        } catch {
          return false
        }
      }

      return context.form.text({
        message: context.i18n('commands.init.methods.env.input', project),
        input: args.env,
        skip: false,
        required: true,
        validation: [
          context.form.collider(
            isNotEmpty,
            context.i18n('context.input.empty'),
          ),
          context.form.collider(isEnvFound, (env) =>
            context.i18n('commands.init.methods.env.found', env),
          ),
        ],
      })
    },
    // machine: async () => {
    //   const machineList: MachineList[] = await basedClient
    //     .call(context.endpoints.INFRA_MACHINE_TYPES)
    //     .get()

    //   const nameWidth = 12
    //   const typeWidth = 14
    //   const hardwareWidth = 12
    //   const priceWidth = 11

    //   let options = machineList

    //   options = options.map((item) => {
    //     let { name, value, basedPrice, cpus, memory } = item
    //     name = name.padEnd(nameWidth)
    //     const type = `(${value})`.padEnd(typeWidth)
    //     const monthlyPrice =
    //       `${context.i18n('currency', basedPrice)}/${context.i18n('monthlySubscription')}`.padEnd(
    //         priceWidth,
    //       )
    //     cpus = `${cpus}CPU`
    //     memory = `${memory}GB`
    //     const hardware = `${cpus}/${memory}`.padEnd(hardwareWidth)

    //     return {
    //       label: `<reset><b>${name}</b> <dim>${type}</dim> ${hardware} ${monthlyPrice}</reset>`,
    //       value,
    //     }
    //   })

    //   return context.form.select({
    //     message: context.i18n(
    //       'commands.infra.subCommands.init.methods.machine',
    //     ),
    //     input: args.machine,
    //     options,
    //     required: true,
    //     validation: [
    //       context.form.collider(
    //         isNotEmpty,
    //         validationMessage(
    //           context.i18n('commands.infra.validations.machine'),
    //         ),
    //       ),
    //     ],
    //   })
    // },
  }
}
