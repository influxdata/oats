import { OpenAPIV3 } from "openapi-types"

import { generate } from "../src"

test("basic POST endpoint with no refs", async () => {
  const expected = `
type CreateFooParameters = {
  body: {name: string}
  query?: {bar: string}
}

type CreateFooResponse =
  | CreateFooOKResponse
  | CreateFooInternalServerErrorResponse

interface CreateFooResponse extends Response {
  status: 200
  statusText: "OK"
  json: () => Promise<{name: string}>
}

interface CreateFooInternalServerErrorResponse extends Response {
  status: 500
  statusText: "Internal Server Error"
  json: () => Promise<{message: string}>
}

export function createFoo(params: CreateFooParameters): Promise<CreateFooResponse> {
  const result = fetch('/foos', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}
`

  const actual = await generate("./fixtures/basic.yml")

  expect(actual.trim()).toEqual(expected.trim())
})

test.only("pet store", async () => {
  const expected = ""

  const actual = await generate("./fixtures/petstore.yml")

  expect(actual.trim()).toEqual(expected.trim())
})
