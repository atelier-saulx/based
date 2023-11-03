import based from '@based/client'

const client = based({
  url: 'ws://localhost:8081',
})

const x = require('./meta.json')
// @ts-ignore
const keys = Object.keys(Object.values(x.outputs)[0].inputs)
// @ts-ignore
const info = Object.values(Object.values(x.outputs)[0].inputs)
  .map((v, k) => {
    // @ts-ignore
    return { key: keys[k], bytes: v.bytesInOutput }
  })
  .sort((a, b) => (a.bytes > b.bytes ? -1 : 1))

const staticHtml = async ({ head, body }) => {
  // const d = await client
  //   .query('text')
  //   .get()
  //   .catch((err) => err.message)
  return `<html>
<head>
    ${head}
</head>
<body>
<pre>${JSON.stringify(info, null, 2)}</pre>
  
</body>
</html>`
}

const normal = async ({ head, body }) => {
  const blp = await client
    .query('text')
    .get()
    .catch((err) => err.message)

  return `<html>
<head>
    ${head}
    ${client.genCacheScript()}
</head>
<body>
    ${body}
</body>
</html>`
}

export default staticHtml
