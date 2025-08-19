import test from 'node:test'
import { SchemaProps, SchemaType } from '@based/schema'

await test('types', () => {
  // const notificationSubjects: string[] = [
  //   'flight',
  //   'incident',
  //   'workspace',
  //   'team',
  //   'training',
  //   'drone',
  //   'groundStation',
  //   'equipment',
  //   'battery',
  // ]
  // const notification: SchemaProps<false> = {
  //   subjectType: notificationSubjects,
  //   ...subjectRelations(),
  // }
  // function subjectRelations(): SchemaProps<false> {
  //   return notificationSubjects.reduce<SchemaType<false>>(
  //     (schema: SchemaType, subjectType) => ({
  //       ...schema,
  //       [subjectType]: {
  //         ref: subjectType,
  //         prop: 'notifications',
  //       },
  //     }),
  //     {} as SchemaProps<false>,
  //   ) as SchemaProps<false>
  // }
})
