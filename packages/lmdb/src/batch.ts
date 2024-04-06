import db from './db.js'

console.log('DB:', db)

// drain write loop

// add write multiple
export const addWrite = () => {
  // buff
  // if anything goes wrong with a write loop retry
  // a set just gets the increased id back
}

// add read multiple
export const addRead = () => {
  // add single and multi - this is rly nice scince we need less promises
}
