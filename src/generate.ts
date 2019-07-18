import * as path from "path"
import { OpenAPIV3 } from "openapi-types"
import { bundle } from "swagger-parser"
import { format, resolveConfig } from "prettier"
import { get } from "lodash"

import { PathOperation, Operation, OPERATIONS } from "./types"
import { printPathOperation, printField, isTypeNamed } from "./print"

class Generator {
  private doc: OpenAPIV3.Document
  private pathOperations: PathOperation[] = []
  private namedTypes: { [name: string]: string } = {}

  constructor(doc: OpenAPIV3.Document) {
    this.doc = doc

    for (const [path, pathItemObj] of Object.entries(doc.paths)) {
      for (const op of OPERATIONS) {
        if (pathItemObj[op]) {
          this.registerPathOperation(path, op, pathItemObj[op])
        }
      }
    }
  }

  public print() {
    const namedTypesOutput = Object.entries(this.namedTypes)
      .map(([name, impl]) => `type ${name} = ${impl}`)
      .join("\n\n")

    const pathOperationsOutput = this.pathOperations
      .map(op => printPathOperation(op))
      .join("\n\n")

    const output = `${namedTypesOutput}\n\n${pathOperationsOutput}`

    return output
  }

  private registerPathOperation(
    path: string,
    operation: Operation,
    operationObj: OpenAPIV3.OperationObject
  ) {
    const parameters: OpenAPIV3.ParameterObject[] = (
      operationObj.parameters || []
    ).map(p => this.followReference(p))

    const pathOperation: PathOperation = {
      path,
      operation,
      summary: operationObj.summary,
      positionalParams: this.collectParameters(parameters, "path"),
      headerParams: this.collectParameters(parameters, "header"),
      queryParams: this.collectParameters(parameters, "query"), // TODO: Support "string[]" parameters
      bodyParam: this.collectBodyParam(operationObj),
      responses: this.collectResponses(operationObj.responses)
    }

    this.pathOperations.push(pathOperation)
  }

  private collectParameters(
    allParameters: OpenAPIV3.ParameterObject[],
    parameterLocation: "query" | "path" | "header"
  ) {
    return allParameters
      .filter(p => p.in === parameterLocation)
      .map(p => ({
        name: p.name,
        description: p.description,
        required: p.required,
        type: this.expectSimpleType(p)
      }))
  }

  private collectBodyParam(
    operationObj: OpenAPIV3.OperationObject
  ): PathOperation["bodyParam"] {
    if (!operationObj.requestBody) {
      return null
    }

    const requestBody: OpenAPIV3.RequestBodyObject = this.followReference(
      operationObj.requestBody
    )

    const jsonContent = get(requestBody, ["content", "application/json"])
    const { description, required = false } = requestBody

    if (!jsonContent) {
      return {
        description,
        required,
        type: "any"
      }
    }

    return {
      description,
      required,
      type: this.getType(jsonContent.schema)
    }
  }

  private collectResponses(
    responses?: OpenAPIV3.ResponsesObject
  ): PathOperation["responses"] {
    if (!responses) {
      return null
    }

    return Object.entries(responses).reduce(
      (acc, [responseCode, refOrResponse]) => {
        const responseObj: OpenAPIV3.ResponseObject = this.followReference(
          refOrResponse
        )

        if (!responseObj.content) {
          // If a response code is defined but
          return {
            ...acc,
            [responseCode]: {
              description: responseObj.description,
              mediaTypes: null
            }
          }
        }

        return {
          ...acc,
          [responseCode]: {
            description: responseObj.description,
            mediaTypes: Object.entries(responseObj.content).reduce(
              (acc, [mediaType, mediaTypeObj]) => ({
                ...acc,
                [mediaType]: {
                  type: this.getType(mediaTypeObj.schema)
                }
              }),
              {}
            )
          }
        }
      },
      {}
    )
  }

  private followReference(obj) {
    if ("$ref" in obj) {
      return get(this.doc, obj.$ref.split("/").slice(1))
    }

    return obj
  }

  private expectSimpleType(obj): "string" | "number" | "any" {
    switch (get(obj, "schema.type", null)) {
      case "string":
        return "string"
      case "integer":
      case "number":
        return "number"
      default:
        return "any"
    }
  }

  private getRefName(refString: string): string {
    const refParts = refString.split("/")
    const name = refParts[refParts.length - 1]

    return name
  }

  private getType(
    obj: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
  ): string {
    if ("$ref" in obj) {
      const typeName = this.getRefName(obj.$ref)
      const schema = this.followReference(obj)
      const typeImpl = this.getTypeFromSchemaObj(schema)

      this.registerType(typeName, typeImpl)

      return typeName
    }

    return this.getTypeFromSchemaObj(obj)
  }

  private getTypeFromSchemaObj(obj: OpenAPIV3.SchemaObject): string {
    switch (obj.type) {
      case "number":
      case "integer":
        return "number"
      case "boolean":
        return "boolean"
      case "string":
        return obj.enum ? obj.enum.map(v => `"${v}"`).join(" | ") : "string"
      case "null":
        return "null"
      case "array":
        return this.getTypeFromArraySchemaObj(obj)
      case "object":
      default:
        return this.getTypeFromObjectSchemaObj(obj)
    }
  }

  private getTypeFromArraySchemaObj(obj: OpenAPIV3.ArraySchemaObject): string {
    const type = this.getType(obj.items)

    return isTypeNamed(type) ? `${type}[]` : `Array<${type}>`
  }

  private getTypeFromObjectSchemaObj(
    obj: OpenAPIV3.NonArraySchemaObject
  ): string {
    if (obj.allOf) {
      return this.getTypeFromAllOf(obj)
    }

    if (obj.oneOf) {
      return this.getTypeFromOneOf(obj)
    }

    if (obj.anyOf) {
      return this.getTypeFromOneOf(obj)
    }

    if (obj.properties) {
      return this.getTypeFromPropertiesSchemaObj(obj)
    }

    return "any"
  }

  private getTypeFromPropertiesSchemaObj(
    obj: OpenAPIV3.NonArraySchemaObject
  ): string {
    const fields = Object.entries(obj.properties).map(([name, value]) => {
      const readOnly = (value as any).readOnly
      const required = (obj.required || []).includes(name)
      const description = (value as any).description

      return printField(
        readOnly,
        name,
        required,
        this.getType(value),
        description
      )
    })

    return `{\n  ${fields.join("\n  ")}\n}`
  }

  private getTypeFromAllOf(obj: OpenAPIV3.SchemaObject): string {
    return obj.allOf.map(childObj => this.getType(childObj)).join(" & ")
  }

  private getTypeFromOneOf(obj: OpenAPIV3.SchemaObject): string {
    return obj.oneOf
      .map(childObj => {
        const type = this.getType(childObj)

        if (obj.discriminator) {
          const mappingKey = Object.keys(obj.discriminator).find(
            key => obj.discriminator.mapping[key] === (childObj as any).$ref
          )

          const propertyValue = mappingKey ? `"${mappingKey}"` : "string"

          return `(${type} & {${obj.discriminator.propertyName}: ${propertyValue}})`
        }

        return type
      })
      .join(" | ")
  }

  private registerType(name: string, impl: string): void {
    if (this.namedTypes[name] && this.namedTypes[name] !== impl) {
      throw new Error(
        `cannot register conflicting implementations for type "${name}"`
      )
    }

    this.namedTypes[name] = impl
  }
}

export async function generate(
  docOrPathToDoc: string | OpenAPIV3.Document
): Promise<string> {
  const doc = (await bundle(docOrPathToDoc)) as OpenAPIV3.Document

  const prettierConfig = await resolveConfig(path.resolve(__dirname, "../.."))

  const output = format(new Generator(doc).print(), {
    ...prettierConfig,
    parser: "typescript"
  })

  return output
}
