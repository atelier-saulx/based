import {
  AppContext,
  dateAndTime,
  externalDateAndTime,
} from '../../../shared/index.js'
import { isValid, parse, isBefore, isAfter } from 'date-fns'
import { visualizer } from '../../../helpers/index.js'
import { Command } from 'commander'

export const filter =
  (program: Command) =>
  async (filters: Based.Logs.Filter): Promise<void> => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const { basedClient, destroy } = await context.getBasedClients()
    const { skip } = context.getGlobalOptions()
    const logOptions: string[] = ['all', 'info', 'error']

    const errorMessage = (option: string, value: string | number) => {
      throw new Error(
        `The <b>${option}</b> provided is not valid: '<b>${value}</b>'. Check it and try again.`,
      )
    }

    if (!filters.stream && filters.sort !== 'asc' && filters.sort !== 'desc') {
      errorMessage('sort', filters.sort)
    }

    if (filters.startDate && typeof filters.startDate === 'string') {
      if (!isValid(parse(filters.startDate, externalDateAndTime, new Date()))) {
        errorMessage('start date', filters.startDate)
      } else {
        filters.startDate = context.parse.date(
          filters.startDate,
          externalDateAndTime,
          dateAndTime,
        )
      }
    }

    if (filters.endDate && typeof filters.endDate === 'string') {
      if (!isValid(parse(filters.endDate, externalDateAndTime, new Date()))) {
        errorMessage('end date', filters.endDate)
      } else {
        filters.endDate = context.parse.date(
          filters.endDate,
          externalDateAndTime,
          dateAndTime,
        )
      }
    }

    if (filters.checksum) {
      filters.checksum = parseInt(filters.checksum.toString())
      if (isNaN(filters.checksum)) {
        errorMessage('checksum', filters.checksum)
      }
    }

    if (filters.level && !logOptions.includes(filters.level)) {
      errorMessage('log level', filters.level)
    }

    if ((!filters.stream && !filters.limit) || isNaN(Number(filters.limit))) {
      filters.limit = 100
    } else if (!filters.stream && filters.limit && filters.limit > 1000) {
      filters.limit = 1000
    }

    if (!filters.sort || filters.stream) {
      filters.sort = 'desc'
    }

    if (!skip) {
      context.print.line()

      if (!filters.endDate && !filters.startDate && !filters.stream) {
        const filterByDate: boolean = await context.input.confirm(
          `Would you like to filter the logs by date and time?`,
        )

        if (filterByDate) {
          filters.startDate = await context.input.dateTime(
            `Please enter the start date and time for filtering logs:`,
          )
          filters.endDate = await context.input.dateTime(
            `Please enter the end date and time for filtering logs:`,
          )
        }
      }

      if (!filters.function || !filters.function.length) {
        const filterByFunction: boolean = await context.input.confirm(
          `Do you want to filter by function?`,
        )

        if (filterByFunction) {
          const { functions } = await basedClient
            .query('db', {
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

          filters.function = await context.input.select(
            `Please select the functions: <dim>(A-Z)</dim>`,
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
      typeof filters.startDate !== 'string' &&
      typeof filters.endDate !== 'string' &&
      filters.startDate?.date &&
      filters.endDate?.date
    ) {
      let message: string = `Start date: ${filters.startDate.value} | End date: ${filters.endDate.value}`

      if (isBefore(filters.endDate.date, filters.startDate.date)) {
        errorMessage(
          'date interval',
          `The end date cannot be before the start date. ${message}`,
        )
      } else if (isAfter(filters.startDate.date, new Date())) {
        errorMessage(
          'date interval',
          `The start date cannot be after now. ${message}`,
        )
      }
    }

    try {
      await visualizer(context, filters)

      if (!filters.stream) {
        destroy()
        return
      }
    } catch (error) {
      throw new Error(error)
    }
  }
