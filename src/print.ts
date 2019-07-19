import { PathOperation, Operation } from "./types"
import { STATUSES } from "./statuses"

function titleCase(s: string) {
  return s.length ? `${s[0].toUpperCase()}${s.slice(1).toLowerCase()}` : s
}

function uppercase1(s: string) {
  return s.length ? `${s[0].toUpperCase()}${s.slice(1)}` : s
}

function lowercase1(s: string) {
  return s.length ? `${s[0].toLowerCase()}${s.slice(1)}` : s
}

function depluralize(s: string) {
  return s.endsWith("s") ? s.slice(0, s.length - 1) : s
}

function printPathOpName({ path, operation }: PathOperation): string {
  const nicePathName = path
    .split("/")
    .map(titleCase)
    .map((p, i, ps) => {
      const isGettingSingleResource =
        operation === "get" && i === ps.length - 2 && ps[i + 1].startsWith("{")

      const isAddressingSingleResource =
        operation !== "get" && i === ps.length - 1

      if (isGettingSingleResource || isAddressingSingleResource) {
        return depluralize(p)
      }

      return p
    })
    .filter(p => !p.startsWith("{"))
    .join("")

  const verb = {
    get: "get",
    post: "create",
    put: "replace",
    patch: "update",
    delete: "delete"
  }[operation]

  return `${verb}${nicePathName}`
}

function printParamsName(pathOp: PathOperation): string {
  const pathOpName = printPathOpName(pathOp)

  return `${uppercase1(pathOpName)}Params`
}

function printResultName(pathOp: PathOperation): string {
  const pathOpName = printPathOpName(pathOp)

  return `${uppercase1(pathOpName)}Result`
}

function printResultVariantName(pathOp: PathOperation, code: string): string {
  const pathOpName = printPathOpName(pathOp)

  return `${uppercase1(pathOpName)}${STATUSES[code]}Result`
}

export function printField(
  readOnly: boolean,
  name: string,
  required: boolean,
  type: string,
  description?: string
) {
  return `${readOnly ? "readonly " : ""}${name}${required ? "" : "?"}: ${type};`
}

export function printPathOperationTypes(pathOperation: PathOperation): string {
  const paramsType = printParamsType(pathOperation)
  const responseTypes = printResultTypes(pathOperation)

  return `${paramsType}\n\n${responseTypes}`
}

function printParamsType(pathOp: PathOperation): string {
  const dataField = pathOp.bodyParam
    ? printField(
        false,
        "data",
        pathOp.bodyParam.required,
        pathOp.bodyParam.type,
        pathOp.bodyParam.description
      )
    : ""

  const queryField = ""

  const pathFields = []

  const headerField = ""

  const paramsType = `
interface ${printParamsName(pathOp)} {
  ${pathFields}

  ${dataField}

  ${queryField}

  ${headerField}
}
`.trim()

  return paramsType
}

function printResultTypes(pathOp: PathOperation): string {
  const variants = pathOp.responses.map(({ code, mediaTypes }) =>
    printResultType(code, mediaTypes, printResultVariantName(pathOp, code))
  )

  const responseTypes = `
type ${printResultName(pathOp)} =
  | ${variants.map(([name]) => name).join("\n  | ")}

${variants.map(([_, type]) => type).join("\n\n")}
`.trim()

  return responseTypes
}

function printResultType(
  code: string,
  mediaTypes: PathOperation["responses"][0]["mediaTypes"],
  name: string
): [string, string] {
  const mediaTypeObj: any =
    mediaTypes.find(d => d.mediaType === "application/json") || mediaTypes[0]

  let resolvedTypeImpl: string

  if (mediaTypeObj && mediaTypeObj.mediaType === "application/json") {
    resolvedTypeImpl = mediaTypeObj.type
  } else if (mediaTypeObj && mediaTypeObj.startsWith("text")) {
    resolvedTypeImpl = "string"
  } else {
    resolvedTypeImpl = "any"
  }

  const resultType = `
interface ${name} {
  status: ${code === "default" ? 500 : code};
  headers: Headers;
  data: ${resolvedTypeImpl};
}
`.trim()

  return [name, resultType]
}

export function printPathOperation(pathOp: PathOperation): string {
  const typesOutput = printPathOperationTypes(pathOp)

  const query = pathOp.queryParams.length
    ? "const query = params.query ? `?${new URLSearchParams(params.query as any).toString()}` : ''"
    : ""

  // TODO: server URL
  let url = pathOp.path.replace(/{/g, "${")

  let resultData = "data"

  let body
  let isJSON

  if (pathOp.bodyParam && pathOp.bodyParam.type === "any") {
    body = "body: params.data,"
    isJSON = false
  } else if (pathOp.bodyParam) {
    body = "body: JSON.stringify(params.data),"
    isJSON = true
  } else {
    body = ""
    isJSON = false
  }

  let contentTypeHeader = isJSON ? '"Content-Type": "application/json",' : ""

  const functionOutput = `
export async function ${printPathOpName(pathOp)}(params: ${printParamsName(
    pathOp
  )}, options): Promise<${printResultName(pathOp)}> {
  ${query}

  const response = await fetch(\`${url}${query ? "${query}" : ""}\`, {
    ${body}
    method: "${pathOp.operation}",
    credentials: "same-origin",
    signal: options.signal,
    headers: {
      ${contentTypeHeader}
      ${pathOp.headerParams.length ? "...headers," : ""}
    },
  })

  const result = {
    status: response.status,
    headers: response.headers,
    ${resultData}
  }

  return result as ${printResultName(pathOp)}
}
`.trim()

  return `${typesOutput}\n\n${functionOutput}`
}

export function isTypeNamed(type: string): boolean {
  const code = type.charCodeAt(0)

  // Assume that if a type starts with an alphabetical character, then it is a
  // named type
  return (code > 64 && code < 91) || (code > 96 && code < 123)
}

/*
  interface Foo {}
  
  interface AdditionalParams {
    signal?: AbortSignal
  }
  
  interface FooParams {
    barID: string
  
    headers?: {
      zapTrace?: string
    }
  
    query?: {
      limit?: number
    }
  
    data: Foo
  }
  
  type FooResult = FooOKResult | FooInternalServerErrorResult
  
  interface FooOKResult {
    ok: true
    status: 200
    statusText: "OK"
    headers: Headers
    data: {}
  }
  
  interface FooInternalServerErrorResult {
    ok: false
    status: 500
    statusText: "Internal Server Error"
    headers: Headers
    data: any
  }
  
  export async function getFoo(
    params: FooParams,
    additional: AdditionalParams
  ): Promise<FooResult> {
    const query = params.query // only include if query in params
      ? `?${new URLSearchParams(params.query as any).toString()}`
      : ""
  
    const response = await fetch(`/bars/${params.barID}/foo${query}`, {
      method: "POST",
      body: JSON.stringify(params.data), // just pass data directly if not application/json requestBody
      credentials: "same-origin",
      signal: additional.signal,
      headers: {
        Accept: "application/json", // comma seperated list of every possible response type, json first
        "Content-Type": "application/json", // only support json or single other string content type
        ...params.headers
      }
    })
  
    let data: any = null
  
    if (response.headers.get("Content-Type") === "application/json") {
      data = await response.json() // default to this if only json request type
    } else {
      data = await response.text()
    }
  
    const result = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data
    }
  
    return result as FooResult
  }
*/
