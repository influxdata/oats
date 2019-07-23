import { generate } from "../src"

test("petstore", async () => {
  const actual = await generate("./fixtures/petstore.yml")

  expect(actual).toMatchSnapshot()
})
