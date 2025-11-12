// @ts-nocheck
import { parse } from '../src/index.js'

parse({
  types: {
    // youzi: {
    //   props: {
    //     name: 'number1',
    //   },
    // },
    barp: {
      props: {
        name: { type: 'string', piemel: 1 },
        // foo: {
        //   ref: 'youzi',
        //   prop: 'xxx',
        //   // type: 'references',
        //   // items: {
        //   //   ref: 'youzi',
        //   //   prop: 'foos',
        //   //   $bla: 'string1',
        //   // },
        // },
      },
    },
  },
})
