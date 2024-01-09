import test from 'ava'
import { BasedSchema, display } from '../src/index.js'

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
  const now = 1701695869765

  const parsed = [
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
    display(100e6, schema.types.thing.fields.bytes),
    display(100e9, schema.types.thing.fields.bytes),

    display(100e9, schema.types.thing.fields.short),

    // display(now + 20e3, schema.types.thing.fields.dateTimeText),
    // display(now + 20e3, schema.types.thing.fields.timePrecise),
    // display(now+ 20e3, schema.types.thing.fields.dateTime),
    // display(now + 20e3, schema.types.thing.fields.time),
  ]

  t.deepEqual(parsed, [
    'Bla',
    'B',
    undefined,
    '',
    'BLA',
    'bla',
    '€100k',
    '$100k',
    '€10,21',
    '$10.23',
    '€1001,21',
    '$1001.21',
    '€10k',
    '$10k',
    '€100m',
    '$100m',
    '95.37 mb',
    '93.13 gb',
    '100b',
    // 'December 4, 2023, 2:18:09 PM',
    // '14:18:09',
    // '14:18 4/12/2023',
    // '14:18',
  ])

  t.regex(
    String(display(now + 20e3, schema.types.thing.fields.dateTimeText)),
    /^December 4, 2023, *./
  )
  t.regex(
    String(display(now + 20e3, schema.types.thing.fields.timePrecise)),
    /^[0-9]{2}:18:09$/
  )
  t.regex(
    String(display(now + 20e3, schema.types.thing.fields.dateTime)),
    /^[0-9]{2}:18 4\/12\/2023$/
  )
  t.regex(
    String(display(now + 20e3, schema.types.thing.fields.time)),
    /^[0-9]{2}:18$/
  )
})
