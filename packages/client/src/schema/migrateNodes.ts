import { BasedDbClient } from '../index.js'
import { SchemaMutation } from '../types.js'
import { getValueByPath, pathToQuery } from '../util/index.js'

const PAGE_AMOUNT = 3e3
export const migrateNodes = async (
  client: BasedDbClient,
  mutations: SchemaMutation[]
) => {
  for (const mutation of mutations) {
    if (mutation.mutation === 'delete_type') {
      let finished = false
      while (!finished) {
        const nodeDeletions = []
        const query = {
          ids: {
            id: true,
            $list: {
              $limit: PAGE_AMOUNT,
              $find: {
                $traverse: 'descendants',
                $filter: {
                  $field: 'type',
                  $operator: '=',
                  $value: mutation.type,
                },
              },
            },
          },
        }
        const result = await client.get(query)
        const ids = result.ids?.map((node: any) => node.id) || []
        ids.forEach((id: string) => {
          nodeDeletions.push(client.delete({ $id: id, $recursive: true }))
        })
        await Promise.all(nodeDeletions)
        if (ids.length < PAGE_AMOUNT) {
          finished = true
        }
      }
    }

    if (mutation.mutation === 'remove_field') {
      let finished = false
      let page = 0
      while (!finished) {
        const nodeDeletions = []
        const query = {
          ids: {
            id: true,
            $list: {
              $offset: page * PAGE_AMOUNT,
              $limit: PAGE_AMOUNT,
              $find: {
                $traverse: 'descendants',
                $filter: {
                  $field: 'type',
                  $operator: '=',
                  $value: mutation.type,
                },
              },
            },
          },
        }
        const ids = (await client.get(query)).ids?.map((node: any) => node.id)
        if (ids) {
          ids.forEach((id: string) => {
            nodeDeletions.push(
              client.set({
                $id: id,
                [mutation.path[0]]: {
                  $delete: true,
                },
              })
            )
          })
          await Promise.all(nodeDeletions)
          if (ids.length === PAGE_AMOUNT) {
            page++
          } else {
            finished = true
          }
        } else {
          finished = true
        }
      }
    }

    if (mutation.mutation === 'change_field') {
      let finished = false
      let page = 0
      while (!finished) {
        const nodeGets = []
        const query = {
          ids: {
            id: true,
            $list: {
              $offset: page * PAGE_AMOUNT,
              $limit: PAGE_AMOUNT,
              $find: {
                $traverse: 'descendants',
                $filter: [
                  {
                    $field: 'type',
                    $operator: '=',
                    $value: mutation.type,
                  },
                  {
                    $field: mutation.path.join('.'),
                    $operator: 'exists',
                  },
                ],
              },
            },
          },
        }
        const ids = (await client.get(query)).ids?.map((node: any) => node.id)
        if (ids) {
          ids.forEach((id: string) => {
            const query = {
              $language: client.schema.language,
              $id: id,
              ...pathToQuery(mutation.path, true),
            }
            nodeGets.push(client.get(query))
          })
          const results = await Promise.all(nodeGets)
          const lowLevelSets = []
          ids.forEach((id: string, index: number) => {
            let oldValue = getValueByPath(results[index], mutation.path)
            let newValue: any
            try {
              switch (`${mutation.old.type}-${mutation.new.type}`) {
                case 'number-string':
                case 'integer-string':
                case 'integer-text':
                  newValue = String(oldValue)
                  break
                case 'string-number':
                case 'text-number':
                  newValue = parseFloat(oldValue)
                  break
                case 'string-integer':
                case 'text-integer':
                  newValue = Math.round(parseFloat(oldValue))
                  break
                case 'number-integer':
                  newValue = Math.round(oldValue)
                  break
                case 'integer-number':
                  newValue = parseFloat(oldValue)
                  break
                default:
                  // text-string
                  // string-text
                  newValue = oldValue
                  break
              }
            } catch (error) {
              console.warn(
                `Error running migration handler for ${id} on field ${mutation.path.join(
                  '.'
                )}`
              )
            }
            let selvaObjectType: string
            switch (mutation.new.type) {
              case 'number':
                selvaObjectType = 'f'
                break
              case 'integer':
                selvaObjectType = 'i'
                break
              default:
                selvaObjectType = 's'
                break
            }
            const path =
              mutation.new.type === 'text'
                ? mutation.path.concat(client.schema.language)
                : mutation.path
            lowLevelSets.push(
              client.command('object.set', [
                id,
                path.join('.'),
                selvaObjectType,
                String(newValue),
              ])
            )
          })

          await Promise.all(lowLevelSets)

          if (ids.length === PAGE_AMOUNT) {
            page++
          } else {
            finished = true
          }
        } else {
          finished = true
        }
      }
    }
  }
}
