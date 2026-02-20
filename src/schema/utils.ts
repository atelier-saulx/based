// writer.$role
// snurf
// writer.*
// writer.**
// writer.flap[0]
// writer.flap[-1]
// writer.

// writer + opts
// *
// **

// getPropsFromPaths(['writer.description.nl'], schema, type, langCode)
// {
// def: PropDef
// resultPath: ['writer', 'description', 'nl']
// lang: langcode
// select: false
// }[]

// getPropsFromPaths(['writer.flap[0..5]'], schema, type, langCode)
// {
// def: PropDef
// resultPath: ['writer', 'flap']
// lang: langcode
// opts: { start: 10, end: 14 }
// }[]

/*


 .query('user')
        .filter('nr', '>', 8)
        .and('nr' '<', 10)
        .and(filter => filter('nr', >,  5).or('nr', <, 10) )
        .and('flap', '>', 10)
        .and('writer.$role', '=', 'admin')
        .or(() => {
          filter('nr', '<', 1).or('nr', '=', 5)
        })

{
   type: 'user',     
  // target: 21 // [21,21,23]
   
        and: [
        
             props: {
        nr: { ops: [
            { val: 8, op: '>' },
            { val: 10, op: '<' }
        ]},
        writer: {
            props: {
                $role: { 
                ops: [
                    {val: 'admin', op: ''}
]}
            },
            ops: [{ val: 23, op: '='}]
        },
}
        {
            props: { nr: { ops: [{val: 1, op: '<}] } },
            or: [{ nr: { val: 5, op: '='}}]
        }],
        or: [{
            props: { nr: [{ val: 1, op: '<'}] }
            or: [{
                nr: [{ val: 5, op: '='}]
            }],
        }]
     }
   locale: 'en',
   sort: { prop: 'nr', order: 'asc' },
   include: {
        props: {
            writer: {
                props: {
                    '*': { opts: {} },
                    $rating: { opts: {} },

                }
            },
            likes: {
                select: { start: 2, end: 10 }
            },
            flap: {
                props: {},
                filter: ...
            }
        }
   }
    // agg?
}

// validateQuery()


*/
