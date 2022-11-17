export default async ({ update, based }) => {
  console.info('!!nice observe!')
  return based.observe(
    {
      children: true,
    },
    update
  )
}
