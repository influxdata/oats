import { PathOperation, Operation } from "./types"
import { STATUSES } from "./statuses"

function titleCase(s: string) {
  return s.length ? `${s[0].toUpperCase()}${s.slice(1).toLowerCase()}` : s
}

function camelCase(s: string) {
  return s.length ? `${s[0].toLowerCase()}${s.slice(1)}` : s
}

function depluralize(s: string) {
  return s.endsWith("s") ? s.slice(0, s.length - 1) : s
}

function printPathOpName(path: string, op: Operation): string {
  const nicePathName = path
    .split("/")
    .map(titleCase)
    .map((p, i, ps) => {
      if (i === ps.length - 2 && ps[i + 1].startsWith("{")) {
        return depluralize(p)
      }

      return p
    })
    .filter(p => !p.startsWith("{"))
    .join("")

  const verb = {
    get: "Get",
    post: "Create",
    put: "Replace",
    patch: "Update",
    delete: "Delete"
  }[op]

  return `${verb}${nicePathName}`
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
  const responseTypes = printResponseTypes(pathOperation)

  return `${paramsType}\n\n${responseTypes}`
}

function printParamsType(pathOperation: PathOperation): string {
  const pathOpName = printPathOpName(
    pathOperation.path,
    pathOperation.operation
  )

  const bodyField = pathOperation.bodyParam
    ? printField(
        false,
        "body",
        pathOperation.bodyParam.required,
        pathOperation.bodyParam.type,
        pathOperation.bodyParam.description
      )
    : ""

  const queryField = ""

  const pathFields = []

  const headerField = ""

  const paramsType = `
interface ${pathOpName}Params {
  ${pathFields}

  ${bodyField}

  ${queryField}

  ${headerField}
}
`.trim()

  return paramsType
}

function printResponseTypes(pathOperation: PathOperation): string {
  const pathOpName = printPathOpName(
    pathOperation.path,
    pathOperation.operation
  )

  const variants = Object.entries(pathOperation.responses).map(([code, resp]) =>
    printResponseType(code, resp, pathOpName)
  )

  const responseTypes = `
type ${pathOpName}Response =
  | ${variants.map(([name]) => name).join("\n  | ")}

${variants.map(([_, type]) => type).join("\n\n")}
`.trim()

  return responseTypes
}

function printResponseType(
  code: string,
  response: PathOperation["responses"]["code"],
  pathOpName: string
): [string, string] {
  const mediaTypes = Object.entries(response.mediaTypes)

  if (mediaTypes.length > 1) {
    throw new Error("multiple response media types not supported")
  }

  const [mediaType, { type: typeImpl }] = mediaTypes[0]
  const responseTypeName = `${pathOpName}${STATUSES[code]}Response`

  if (mediaType !== "application/json") {
    return [responseTypeName, "Response"]
  }

  const responseType = `
interface ${responseTypeName} extends Response {
  status: ${code === "default" ? 500 : code}
  json: () => Promise<${typeImpl}>
}
`

  return [responseTypeName, responseType]
}

export function printPathOperation(pathOperation: PathOperation): string {
  const typesOutput = printPathOperationTypes(pathOperation)

  const pathOpName = printPathOpName(
    pathOperation.path,
    pathOperation.operation
  )

  const functionOutput = `
export function ${camelCase(
    pathOpName
  )}(params: ${pathOpName}Params): ${pathOpName}Response {
  // TODO
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
