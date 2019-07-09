import { generate } from "./generate";

test("basic POST endpoint with no refs", async () => {
  const spec = {
    openapi: "3.0.0",
    info: {
      title: "test",
      version: "1.0.0"
    },
    paths: {
      "/foos": {
        post: {
          parameters: [
            {
              in: "query",
              name: "bar",
              required: false,
              schema: { type: "string" }
            }
          ],
          requestBody: {
            content: {
              "application/json": {
                type: "object",
                properties: {
                  name: { type: "string" }
                }
              }
            }
          },
          responses: {
            "200": {
              content: {
                "application/json": {
                  type: "object",
                  properties: { name: { type: "string" } }
                }
              }
            },
            "500": {
              content: {
                "application/json": {
                  type: "object",
                  properties: { message: { type: "string" } }
                }
              }
            }
          }
        }
      }
    },
    components: {}
  };

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
`;

  const actual = await generate(spec);

  expect(actual.trim()).toEqual(expected.trim());
});
