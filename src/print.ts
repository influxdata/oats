import { PathOperation } from "./types"

const STATUS_CODE_NAMES = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "NoContent",
  400: "BadRequest",
  401: "Unauthorized",
  403: "Forbidden",
  404: "NotFound",
  413: "PayloadTooLarge",
  429: "TooManyRequests",
  500: "InternalServerError",
  503: "ServiceUnavailable",
  default: "Default"
}

function titleCase(s: string) {
  return s.length ? `${s[0].toUpperCase()}${s.slice(1).toLowerCase()}` : s
}

function depluralize(s: string) {
  return s.endsWith("s") ? s.slice(0, s.length - 1) : s
}

function niceifyName(pathName: string): string {
  return pathName
    .split("/")
    .filter(p => !p.startsWith("{"))
    .map(titleCase)
    .map((p, i, ps) => (i !== ps.length - 1 ? depluralize(p) : p))
    .join("")
}

export function printPathOperationTypes(pathOperation: PathOperation): string {
  const pathName = niceifyName(pathOperation.path)
  const typeNamePrefix = `${titleCase(
    pathOperation.operation
  )}${pathName}Params`

  const bodyField = pathOperation.bodyParam
    ? `  body${pathOperation.bodyParam.required ? "" : "?"}: ${
        pathOperation.bodyParam.type
      };\n`
    : ""

  const parametersType = `type ${typeNamePrefix} = {
${bodyField}
}`

  return `
${parametersType}
`
}

export function printPathOperation(pathOperation: PathOperation): string {
  return ""
}

export function isTypeNamed(type: string): boolean {
  const code = type.charCodeAt(0)

  // Assume that if a type starts with an alphabetical character, then it is a
  // named type
  return (code > 64 && code < 91) || (code > 96 && code < 123)
}
