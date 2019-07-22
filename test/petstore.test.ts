import { generate } from "../src"

test.only("petstore", async () => {
  const expected = `
type Pets = Pet[];

type Pet = Dog | Cat;

type Dog = BasePet & {
  weight: number;
};

interface BasePet {
  id: number;
  name: string;
  category?: number;
  tag?: string;
  sex?: "male" | "female";
}

type Cat = BasePet & {
  fluffy: boolean;
};

interface Error {
  code: number;
  message: string;
}

interface RequestOptions {
  signal?: AbortSignal;
}

interface RequestParams {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  url: string;
  params: { [k: string]: any };
  options: { signal?: AbortSignal };
  contentType?: string;
  accept?: string;
}

async function request({
  method,
  url,
  params,
  options,
  contentType,
  accept
}: RequestParams) {
  const requestHeaders = params.headers;

  if (contentType) {
    requestHeaders["Content-Type"] = contentType;
  }

  if (accept) {
    requestHeaders["Accept"] = accept;
  }

  let body;

  if (params.data && contentType.includes("json")) {
    body = JSON.stringify(params.data);
  } else if (params.data) {
    body = params.data;
  }

  const query = params.query ? \`?\${new URLSearchParams(params.query)}\` : "";

  const resp = await fetch(\`\${url}\${query}\`, {
    method,
    body,
    credentials: "same-origin",
    signal: options.signal,
    headers: requestHeaders
  });

  const { status, headers } = resp;
  const respContentType = headers.get("Content-Type");

  let data;

  if (respContentType.includes("json")) {
    data = await resp.json();
  } else if (respContentType.includes("octet-stream")) {
    data = await resp.blob();
  } else if (respContentType.includes("text")) {
    data = await resp.text();
  }

  return { status, headers, data };
}

interface GetPetsParams {
  query?: {
    limit?: number;
  };
}

type GetPetsResult = GetPetsOKResult | GetPetsDefaultResult;

interface GetPetsOKResult {
  status: 200;
  headers: Headers;
  data: Pets;
}

interface GetPetsDefaultResult {
  status: 500;
  headers: Headers;
  data: Error;
}

export async function getPets(
  params: GetPetsParams,
  options: RequestOptions = {}
): Promise<GetPetsResult> {
  const response = await request({
    method: "GET",
    url: "http://petstore.swagger.io/v1/pets",
    params,
    options
  });

  return response as GetPetsResult;
}

interface PostPetParams {
  data: Pet;
}

type PostPetResult = PostPetOKResult | PostPetDefaultResult;

interface PostPetOKResult {
  status: 200;
  headers: Headers;
  data: {
    pet: Pet;
  };
}

interface PostPetDefaultResult {
  status: 500;
  headers: Headers;
  data: Error;
}

export async function postPet(
  params: PostPetParams,
  options: RequestOptions = {}
): Promise<PostPetResult> {
  const response = await request({
    method: "POST",
    url: "http://petstore.swagger.io/v1/pets",
    params,
    options,
    contentType: "application/json"
  });

  return response as PostPetResult;
}

interface GetPetParams {
  petID: string;
}

type GetPetResult = GetPetOKResult | GetPetDefaultResult;

interface GetPetOKResult {
  status: 200;
  headers: Headers;
  data: Pets;
}

interface GetPetDefaultResult {
  status: 500;
  headers: Headers;
  data: Error;
}

export async function getPet(
  params: GetPetParams,
  options: RequestOptions = {}
): Promise<GetPetResult> {
  const response = await request({
    method: "GET",
    url: "http://petstore.swagger.io/v1/pets/\${params.petID}",
    params,
    options
  });

  return response as GetPetResult;
}

`

  const actual = await generate("./fixtures/petstore.yml")

  expect(actual.trim()).toEqual(expected.trim())
})
