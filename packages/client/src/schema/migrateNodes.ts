import { SchemaMutations } from "../types";
import { BasedDbClient } from "..";

type MigrationScript = (oldValue: any) => any

const defaultMigrationScripts: {
  [name: string]: MigrationScript
} = {
  'number-string': async (oldValue) => String(oldValue)
}

export const migrateNodes = async (client: BasedDbClient, mutations: SchemaMutations) => {
  // console.log('----- mutations', JSON.stringify(mutations, null, 2))

  const nodeDeletions = []

  for (const mutation of mutations) {
    if (mutation.mutation === 'delete_type') {
      const ids = (await client.get({
        ids: {
          id: true,
          $list: {
            $find: {
              $traverse: 'descendants',
              $filter: {
                $field: 'type',
                $operator: '=',
                $value: mutation.type
              }
            }
          }
        }
      })).ids.map((node: any) => node.id)
      ids.forEach((id: string) => {
        nodeDeletions.push(client.delete({ $id: id }))
      })
    }
  }

  // TODO: Throttle this
  await Promise.all(nodeDeletions)
}
