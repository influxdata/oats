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

  // Assume that if a type starts with an alphabetical character, then it is a
  // named type
  return (code > 64 && code < 91) || (code > 96 && code < 123)
}

export function formatTypeDeclaration(name: string, impl: string): string {
  if (!impl.startsWith("{")) {
    return `type ${name} = ${impl}`
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
      return `type ${name} = ${impl}`
    }
  }

  return `interface ${name} ${impl}`
}

export function formatPathOps(pathOps: PathOperation[]): string {
  return `
interface RequestOptions {
  signal?: AbortSignal
}

${pathOps.map(pathOp => formatPathOpTypes(pathOp)).join("\n\n")}

export class Client {
  ${pathOps.map(pathOp => formatPathOpMethod(pathOp)).join("\n\n")}

  private async request(
    method: string,
    url: string,
    params: any = {},
    options: RequestOptions = {}
  ): Promise<any> {
    const requestHeaders = this.defaultHeaders()

    for (const [k, v] of Object.entries(params.headers || {})) {
      requestHeaders.set(k, v as string)
    }

    const contentType = requestHeaders.get("Content-Type") || ""

    const body =
      params.data && contentType.includes("json")
        ? JSON.stringify(params.data)
        : params.data

    const query = params.query ? \`?\${new URLSearchParams(params.query)}\` : ""

    const response = await fetch(\`\${url}\${query}\`, {
      method,
      body,
      credentials: "same-origin",
      signal: options.signal,
      headers: requestHeaders
    })

    const { status, headers } = response
    const responseContentType = headers.get("Content-Type")

    let data

    if (responseContentType.includes("json")) {
      data = await response.json()
    } else if (responseContentType.includes("octet-stream")) {
      data = await response.blob()
    } else if (responseContentType.includes("text")) {
      data = await response.text()
    }

    return { status, headers, data }
  }

  private defaultHeaders(): Headers {
    return new Headers()
  }
}


`.trim()
}

function formatPathOpMethod(pathOp: PathOperation): string {
  return `
public ${formatName(pathOp)}(
  params: ${paramsName(pathOp)},
  options: RequestOptions = {}
): Promise<${resultName(pathOp)}> {
  return this.request(
    "${pathOp.operation.toUpperCase()}",
    ${formatURL(pathOp)},
    ${formatParamsArg(pathOp)}
    options
  ) as Promise<${resultName(pathOp)}>
}
`.trim()
}

function formatParamsArg({ bodyParam }: PathOperation): string {
  if (!bodyParam) {
    return `params,`
  }

  return `{...params, 'Content-Type': '${bodyParam.mediaType}'},`
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
}
`.trim()

  return formatTypeDeclaration(paramsName(pathOp), impl)
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
