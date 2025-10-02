import type { Command } from 'commander'
import { isAfter, isBefore, isValid, parse } from 'date-fns'
import { AppContext } from '../../../context/index.js'
import { visualizer } from '../../../helpers/index.js'
import { dateAndTime, externalDateAndTime } from '../../../shared/index.js'

export const filter =
  (program: Command) =>
  async (args: Based.Logs.Filter.Command): Promise<void> => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const basedClient = await context.getBasedClient()
    const { skip } = context.getGlobalOptions()
    const logOptions: string[] = ['all', 'info', 'error']

    const errorMessage = (option: string, value: string | number) => {
      throw new Error(context.i18n('errors.901', option, value))
    }

    if (!args.stream && args.sort !== 'asc' && args.sort !== 'desc') {
      errorMessage(
        context.i18n('commands.logs.subCommands.filter.validations.sort'),
        args.sort,
      )
    }

    if (args.startDate && typeof args.startDate === 'string') {
      if (!isValid(parse(args.startDate, externalDateAndTime, new Date()))) {
        errorMessage(
          context.i18n(
            'commands.logs.subCommands.filter.validations.startDate',
          ),
          args.startDate,
        )
      } else {
        args.startDate = context.parse.date(
          args.startDate,
          externalDateAndTime,
          dateAndTime,
        )
      }
    }

    if (args.endDate && typeof args.endDate === 'string') {
      if (!isValid(parse(args.endDate, externalDateAndTime, new Date()))) {
        errorMessage(
          context.i18n('commands.logs.subCommands.filter.validations.endDate'),
          args.endDate,
        )
      } else {
        args.endDate = context.parse.date(
          args.endDate,
          externalDateAndTime,
          dateAndTime,
        )
      }
    }

    if (args.checksum) {
      args.checksum = Number.parseInt(args.checksum.toString())
      if (Number.isNaN(args.checksum)) {
        errorMessage(
          context.i18n('commands.logs.subCommands.filter.validations.checksum'),
          args.checksum,
        )
      }
    }

    if (args.level && !logOptions.includes(args.level)) {
      errorMessage(
        context.i18n('commands.logs.subCommands.filter.validations.logLevel'),
        args.level,
      )
    }

    if ((!args.stream && !args.limit) || Number.isNaN(Number(args.limit))) {
      args.limit = 100
    } else if (!args.stream && args.limit && args.limit > 1000) {
      args.limit = 1000
    }

    if (!args.sort || args.stream) {
      args.sort = 'asc'
    }

    if (!skip) {
      context.print.line()

      if (!args.endDate && !args.startDate && !args.stream) {
        const filterByDate: boolean = await context.input.confirm(
          context.i18n('commands.logs.subCommands.filter.methods.filterByDate'),
        )

        if (filterByDate) {
          args.startDate = await context.input.dateTime(
            context.i18n('commands.logs.subCommands.filter.methods.startDate'),
          )
          args.endDate = await context.input.dateTime(
            context.i18n('commands.logs.subCommands.filter.methods.endDate'),
          )
        }
      }

      if (!args.function || !args.function.length) {
        const filterByFunction: boolean = await context.input.confirm(
          context.i18n('commands.logs.subCommands.filter.methods.function'),
        )

        if (filterByFunction) {
          const { functions } = await basedClient
            .call(context.endpoints.LOGS_FILTER, {
              $db: 'config',
              functions: {
                $all: true,
                current: {
                  config: true,
                  $all: true,
                },
                $list: {
                  $find: {
                    $traverse: 'children',
                    $filter: {
                      $field: 'type',
                      $operator: '=',
                      $value: ['job', 'function'],
                    },
                  },
                },
              },
            })
            .get()

          const functionsItems = functions
            .filter(({ name }) => Boolean(name))
            .map(({ name }) => ({ value: name, name }))
            .sort((a, b) => (a.name > b.name ? 1 : -1))

          args.function = await context.input.select(
            context.i18n('commands.logs.subCommands.filter.methods.functions'),
            functionsItems,
            true,
          )
        }
      }

      // TODO get all the services running to conclude this feature
      // THE OPTION IS ALREADY DECLARED YOU JUST NEED TO ADD TO THE I18N TO SHOW IT
      // if (!filters.service || !filters.service.length) {
      //   const filterByService: boolean = await context.input.confirm(
      //     `Do you want to filter by service?`,
      //   )
      //
      //
      //
      //   if (filterByService) {
      //     filters.service = await context.input.select(
      //       'Please select the services: <dim>(A-Z)</dim>',
      //       [
      //         {
      //           name: 'env-hub',
      //           value: 'env-hub',
      //         },
      //         {
      //           name: 'admin-hub',
      //           value: 'admin-hub',
      //         },
      //       ],
      //       true,
      //       true,
      //     )
      //   }
      // }
    }

    if (
      typeof args.startDate !== 'string' &&
      typeof args.endDate !== 'string' &&
      args.startDate?.date &&
      args.endDate?.date
    ) {
      const message: string = context.i18n(
        'commands.logs.subCommands.filter.methods.startAndEndDates',
        args.startDate.value,
        args.endDate.value,
      )

      if (isBefore(args.endDate.date, args.startDate.date)) {
        errorMessage(
          context.i18n('commands.logs.subCommands.filter.validations.interval'),
          context.i18n(
            'commands.logs.subCommands.filter.methods.endDateWrong',
            message,
          ),
        )
      } else if (isAfter(args.startDate.date, new Date())) {
        errorMessage(
          context.i18n('commands.logs.subCommands.filter.validations.interval'),
          context.i18n(
            'commands.logs.subCommands.filter.methods.startDateWrong',
            message,
          ),
        )
      }
    }

    try {
      await visualizer(context, args)

      if (!args.stream) {
        basedClient.destroy()
      }

      return
    } catch (error) {
      throw new Error(error)
    }
  }
