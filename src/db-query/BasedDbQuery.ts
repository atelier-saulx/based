// QUERY TIME
// you need to pass hooks

// basedClient.db
// toJSON() based DB query -> .ast
// toObject()
// new BasedDbQuery(type, target?, {
//. subscribeSchema
//  subscribe
//  get
// }?)

//  const b = new BasedDbQuery('user').include('name')
// console.log(b.ast)

// {
// query () {

//}
//} query(type, ddf)
// db.query('type', target?)  => new BasedDbQuery(type, target, this.hooks)

// client.query('ui-query', dbQuery('user', 1).include('x').filter('x', '>', 10)) <-- ast
// db.query(DBQUERY-AST).subscribe()
// .include('name'))

// const x = await db.query('user').include('name').get()
