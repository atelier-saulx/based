import test from 'ava'
import { BasedSchema, display } from '../src/index'

const schema: BasedSchema = {
  types: {
    thing: {
      prefix: 'ti',
      fields: {
        dateHuman: { type: 'timestamp', display: 'human' },
        dateTime: { type: 'timestamp', display: 'date-time' },
        dateTimeText: { type: 'timestamp', display: 'date-time-text' },
        time: { type: 'timestamp', display: 'time' },
        timePrecise: { type: 'timestamp', display: 'time-precise' },
        capitalize: {
          type: 'string',
          display: 'capitalize',
          format: 'lowercase',
        },
        upperCase: { type: 'string', display: 'uppercase' },
        lowerCase: { type: 'string', display: 'lowercase' },
        euros: { type: 'number', display: 'euro' },
        dollars: { type: 'number', display: 'dollar' },
        pounds: { type: 'number', display: 'pound' },
        bytes: { type: 'number', display: 'bytes' },
        humanNumber: { type: 'number', display: 'human' },
        ratio: { type: 'number', display: 'ratio' },
        short: { type: 'number', display: 'short' },
      },
    },
  },
  $defs: {},
  language: 'en',
  root: {
    fields: {},
  },
  prefixToTypeMapping: {
    bl: 'bla',
    ti: 'thing',
  },
}

test('date display', async (t) => {
  console.log([
    display('bla', schema.types.thing.fields.capitalize),
    display('b', schema.types.thing.fields.capitalize),
    display(undefined, schema.types.thing.fields.capitalize),
    display('', schema.types.thing.fields.capitalize),
    display('bla', schema.types.thing.fields.upperCase),
    display('BLA', schema.types.thing.fields.lowerCase),

    display(100000, schema.types.thing.fields.euros),
    display(100000, schema.types.thing.fields.dollars),

    display(10.21, schema.types.thing.fields.euros),
    display(10.2312234342, schema.types.thing.fields.dollars),

    display(1001.21212, schema.types.thing.fields.euros),
    display(1001.21212, schema.types.thing.fields.dollars),

    display(10000.21212, schema.types.thing.fields.euros),
    display(10000.21212, schema.types.thing.fields.dollars),

    display(100e6, schema.types.thing.fields.euros),
    display(100e6, schema.types.thing.fields.dollars),
  ])

  t.pass()
})
