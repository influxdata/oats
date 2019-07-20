import { generate } from "../src"

test.only("petstore", async () => {
  const expected = ""

  const actual = await generate("./fixtures/petstore.yml")

  expect(actual.trim()).toEqual(expected.trim())
})
