import type { BasedFunction } from '@based/functions'
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator'

// wiohfwepofhew

const hello: BasedFunction = async (based) => {
  let x = ''
  // Generate a text of 400 characters
  x = `Lorem ipsum dol${~~(Math.random() * 100000)}, consectetur adipisci, nisi nisl aliquam enim, eget facilisis enim nisl nec elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Suspendisse potenti. Etiam euismod, urna eu tincidunt consectetur, nisi nisl aliquam enim, eget facilisis enim nisl nec elit. Pellentesque habitant morbi.`
  // const y = []
  // for (let i = 0; i < 10; i++) {
  //   await new Promise((resolve) => setTimeout(resolve, 1))
  //   console.info(
  //     i,
  //     uniqueNamesGenerator({
  //       dictionaries: [adjectives, animals, colors],
  //       separator: ' ',
  //       length: 2,
  //     }),
  //   )
  // }
  console.info(x)
  // const bla = () => {
  //   console.error(new Error('derp'))
  // }

  // bla()

  // await based.db.setSchema({
  //   types: {
  //     thing: {
  //       name: 'string',
  //       x: 'string',
  //     },
  //   },
  // })

  // console.log(' ???  ???xxx?')

  // await based.db.create('thing', {
  //   name: 'derp',
  // })

  // await based.db.query('thing').get().inspect()

  // console.warn('derp')
  // console.debug('derp')
  // console.log('derp')
  // console.trace('derp')
  // throw new Error('COOKIE PANTS')
  // return 'FLAP DROOLxx'

  return based.db.schema
}

export default hello
