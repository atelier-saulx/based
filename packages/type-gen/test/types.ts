import test from "ava"
import { updateTypes } from "../src/index.js"
import { readFile } from "fs/promises"
import { readJSON } from "fs-extra/esm"
import { dirname, join } from "node:path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDirname = __dirname.replace("/dist/test", "/test")

test("Generate types file from examples", async (t) => {
  const result = await updateTypes([
    {
      config: await readJSON(
        join(srcDirname, "/examples/helloWorld/based.config.json")
      ),
      path: join(srcDirname, "/examples/helloWorld/index.ts"),
    },
    {
      config: await readJSON(
        join(srcDirname, "./examples/query/based.config.json")
      ),
      path: join(srcDirname, "/examples/query/index.ts"),
    },
    {
      config: { name: "db:set", type: "function" },
      payload: "any",
      result: "any",
    },
    {
      config: { name: "db:update-schema", type: "function" },
      payload: "any",
      result: "any",
    },
    {
      config: { name: "db", type: "query" },
      payload: "any",
      result: "any",
    },
    {
      config: { name: "db:schema", type: "query" },
      payload: "any",
      result: "any",
    },
  ])

  const files = await Promise.all(
    ["client/dist/src/index.d.ts", "functions/dist/client.d.ts"].map((f) =>
      readFile(join(srcDirname, "../../" + f), {
        encoding: "utf-8",
      })
    )
  )

  t.is(result.clientPath, join(srcDirname, "../../client/dist/src/index.d.ts"))
  t.is(
    result.functionPath,
    join(srcDirname, "../../functions/dist/client.d.ts")
  )

  for (const file of files) {
    t.true(file.includes("counter"))
    t.true(file.includes("db:schema"))
    t.true(file.includes("db:update-schema"))
    t.true(file.includes("db:set"))
    t.true(file.includes("hello-world"))
  }
})
