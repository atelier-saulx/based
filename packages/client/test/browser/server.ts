import based from '@based/client'

const client = based({
  url: 'ws://localhost:8081',
})

export default async ({ head, body }) => {
  const hello = await client
    .query('counter', { speed: 10 })
    .get()
    .catch((err) => err.message)

  return `<html>
<head>
    ${head}
</head>
<body>
${JSON.stringify(hello, null, 2)}
    ${body}
</body>
</html>`
}
