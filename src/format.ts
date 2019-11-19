import { camelize } from "humps"

import { PathOperation } from "./types"
import { STATUSES } from "./statuses"

export function formatTypeField(
  readOnly: boolean,
  name: string,
  required: boolean,
  type: string
) {
  return `${readOnly ? "readonly " : ""}${name}${required ? "" : "?"}: ${type};`
}

export function isTypeNamed(type: string): boolean {
  if (type.startsWith("interface")) {
    return false
  }

  const code = type.charCodeAt(0)
  const startsAlphaNumeric =
    (code > 64 && code < 91) || (code > 96 && code < 123)

  const includesUnion = type.includes("|")
  const includesIntersection = type.includes("&")

  return startsAlphaNumeric && !includesUnion && !includesIntersection
}

export function formatTypeDeclaration(name: string, impl: string): string {
  if (!impl.startsWith("{")) {
    return `export type ${name} = ${impl}`
  }

  let bracesCount = 0

  for (const c of impl) {
    if (c === "{") {
      bracesCount++
    }

    if (c === "}") {
      bracesCount--
    }

    if ((c === "|" || c === "&") && bracesCount === 0) {
      return `export type ${name} = ${impl}`
    }
  }

  return `export interface ${name} ${impl}`
}

export function formatPathOp(pathOp: PathOperation): string {
  const functionOutput = `
export const ${formatName(pathOp)} = (
  params: ${paramsName(pathOp)},
  options: RequestOptions = {}
): Promise<${resultName(pathOp)}> =>
  request(
    "${pathOp.operation.toUpperCase()}",
    ${formatURL(pathOp)},
    ${formatParamsArg(pathOp)},
    options,
  ) as Promise<${resultName(pathOp)}>
`.trim()

  return `${formatPathOpTypes(pathOp)}\n\n${functionOutput}`
}

function formatParamsArg({ bodyParam, headerParams }: PathOperation): string {
  if (!bodyParam) {
    return "params"
  }

  if (!headerParams.length) {
    return `{...params, headers: {'Content-Type': '${bodyParam.mediaType}'}}`
  }

  return `{...params, headers: {...params.headers, 'Content-Type': '${bodyParam.mediaType}'}}`
}

export function formatLib(): string {
  return `
interface RequestOptions {
  signal?: AbortSignal;
}

export type RequestHandler = (
  url: string,
  query: string,
  init: RequestInit
) => {url: string, query: string, init: RequestInit}
export type ResponseHandler = (
  status: number,
  headers: Headers,
  data: any
) => {status: number, headers: Headers, data: any}

const RequestContext = function(
  requestHandler: RequestHandler,
  responseHandler: ResponseHandler
) {
  this.requestHandler = requestHandler
  this.responseHandler = responseHandler
}

RequestContext.prototype.request = async function(
  method: string,
  url: string,
  params: any = {},
  options: RequestOptions = {}
): Promise<any> {
  const requestHeaders = new Headers(params.headers)
  const contentType = requestHeaders.get("Content-Type") || ""

  if (params.auth) {
    const credentials = btoa(\`\${params.auth.username}:\${params.auth.password}\`)

    requestHeaders.append('Authorization', \`Basic \${credentials}\`)
  }

  const body =
    params.data && contentType.includes("json")
      ? JSON.stringify(params.data)
      : params.data

  const query = params.query ? \`?\${new URLSearchParams(params.query)}\` : ""

  const {
    url: middlewareUrl,
    query: middlewareQuery,
    init,
  } = this.requestHandler(url, query, {
    method,
    body,
    credentials: 'same-origin',
    signal: options.signal,
    headers: requestHeaders,
  })

  const response = await fetch(\`\${middlewareUrl}\${middlewareQuery}\`, init)

  const { status, headers } = response
  const responseContentType = headers.get("Content-Type") || ""

  let data

  if (responseContentType.includes("json")) {
    data = await response.json()
  } else if (responseContentType.includes("octet-stream")) {
    data = await response.blob()
  } else if (responseContentType.includes("text")) {
    data = await response.text()
  }

  return this.responseHandler(status, headers, data)
}

RequestContext.prototype.setRequestHandler = function(requestHandler: RequestHandler) {
  this.requestHandler = requestHandler
}

RequestContext.prototype.setResponseHandler = function(responseHandler: ResponseHandler) {
  this.responseHandler = responseHandler
}

const rc = new RequestContext(
  (url, query, init) => {
    return {url, query, init}
  },
  (status, headers, data) => {
    return {status, headers, data}
  }
)
const request = rc.request.bind(rc)
const setRequestHandler = rc.setRequestHandler.bind(rc)
const setResponseHandler = rc.setResponseHandler.bind(rc)

export { request, setRequestHandler, setResponseHandler }

`.trim()
}

function uppercase1(s: string) {
  return s.length ? `${s[0].toUpperCase()}${s.slice(1)}` : s
}

function depluralize(s: string) {
  return s.endsWith("s") ? s.slice(0, s.length - 1) : s
}

function formatName({ path, operation }: PathOperation): string {
  const nicePathName = path
    .split("/")
    .map((p, i, ps) => {
      const isAddressingSingleResource =
        ["get", "patch", "put", "delete"].includes(operation) &&
        i === ps.length - 2 &&
        ps[i + 1].startsWith("{")

      const isCreatingResource = operation === "post" && i === ps.length - 1

      if (isCreatingResource || isAddressingSingleResource) {
        return depluralize(p)
      }

      return p
    })
    .filter(p => !p.startsWith("{"))
    .join("-")

  return camelize(`${operation}-${nicePathName}`)
}

function paramsName(pathOp: PathOperation): string {
  const pathOpName = formatName(pathOp)

  return `${uppercase1(pathOpName)}Params`
}

function resultName(pathOp: PathOperation): string {
  const pathOpName = formatName(pathOp)

  return `${uppercase1(pathOpName)}Result`
}

function resultVariantName(pathOp: PathOperation, code: string): string {
  const pathOpName = formatName(pathOp)

  return `${uppercase1(pathOpName)}${STATUSES[code]}Result`
}

function formatPathOpTypes(pathOperation: PathOperation): string {
  const paramsType = printParamsType(pathOperation)
  const responseTypes = printResultTypes(pathOperation)

  return `${paramsType}\n\n${responseTypes}`
}

function formatQueryParams({ queryParams }: PathOperation): string {
  if (!queryParams.length) {
    return ""
  }

  const fieldRequired = queryParams.some(d => d.required)

  const typeImpl = `{
  ${queryParams
    .map(d => formatTypeField(false, d.name, d.required, d.type))
    .join("\n")}
}`

  return formatTypeField(false, "query", fieldRequired, typeImpl)
}

function formatPathParams({ positionalParams }: PathOperation): string {
  if (!positionalParams.length) {
    return ""
  }

  return positionalParams
    .map(d => formatTypeField(false, d.name, d.required, d.type))
    .join("\n")
}

function formatHeadersParams({ headerParams }: PathOperation): string {
  if (!headerParams.length) {
    return ""
  }

  const fieldRequired = headerParams.some(d => d.required)

  const typeImpl = `{
  ${headerParams
    .map(d => formatTypeField(false, `"${d.name}"`, d.required, d.type))
    .join("\n")}
}`

  return formatTypeField(false, "headers", fieldRequired, typeImpl)
}

function printParamsType(pathOp: PathOperation): string {
  const dataField = pathOp.bodyParam
    ? formatTypeField(
        false,
        "data",
        pathOp.bodyParam.required,
        pathOp.bodyParam.type
      )
    : ""

  const impl = `
{
  ${formatPathParams(pathOp)}

  ${dataField}

  ${formatQueryParams(pathOp)}

  ${formatHeadersParams(pathOp)}

  ${formatBasicAuthParam(pathOp)}
}
`.trim()

  return formatTypeDeclaration(paramsName(pathOp), impl)
}

function formatBasicAuthParam(pathOp: PathOperation): string {
  if (!pathOp.basicAuth) {
    return ""
  }

  return `
auth: {
  username: string;
  password: string;
};
`.trim()
}

function printResultTypes(pathOp: PathOperation): string {
  const variants = pathOp.responses.map(({ code, mediaTypes }) =>
    printResultType(code, mediaTypes, resultVariantName(pathOp, code))
  )

  const responseTypes = `
type ${resultName(pathOp)} =
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
  let resolvedTypeImpl = "any"

  const jsonMediaType = mediaTypes.find(d =>
    d.mediaType.includes("application/json")
  )
  const textMediaType = mediaTypes.find(d => d.mediaType.includes("text"))
  const fallbackMediaType = mediaTypes[0]

  if (jsonMediaType) {
    resolvedTypeImpl = jsonMediaType.type
  } else if (textMediaType) {
    resolvedTypeImpl = textMediaType.type
  } else if (fallbackMediaType) {
    resolvedTypeImpl = fallbackMediaType.type
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

function formatURL({ path, server }: PathOperation) {
  const url = server + path.replace(/{/g, "${params.")

  return url.includes("$") ? "`" + url + "`" : `"${url}"`
}
