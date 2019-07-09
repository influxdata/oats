import { OpenAPIV3 } from "openapi-types";
import { bundle } from "swagger-parser";
import { format } from "prettier";
import { get } from "lodash";

import {
  PathOperation,
  TypeImplementation,
  Operation,
  OPERATIONS
} from "./types";
import { Registry } from "./registry";
import { printPathOperation } from "./print";

class Generator {
  doc: OpenAPIV3.Document;
  pathOperations: PathOperation[] = [];
  namedTypes: { [name: string]: TypeImplementation } = {};

  constructor(doc: OpenAPIV3.Document) {
    this.doc = doc;

    for (const [path, pathItemObj] of Object.entries(doc.paths)) {
      for (const op of OPERATIONS) {
        if (pathItemObj[op]) {
          this.registerPathOperation(path, op, pathItemObj[op]);
        }
      }
    }
  }

  registerPathOperation(
    path: string,
    operation: Operation,
    operationObj: OpenAPIV3.OperationObject
  ) {
    const parameters: OpenAPIV3.ParameterObject[] = operationObj.parameters.map(
      p => this.followReference(p)
    );

    const positionalParams = [];

    const headerParams = this.resolveHeaderParams(parameters); // TODO

    const positionParams = []; // TODO

    const queryParams = []; // TODO

    const bodyParam = null; // TODO

    const responses = {}; // TODO

    const pathOperation: PathOperation = {
      path,
      operation,
      summary: operationObj.summary,
      positionalParams,
      headerParams,
      queryParams,
      bodyParam,
      responses
    };

    this.pathOperations.push(pathOperation);
  }

  resolveHeaderParams(
    allParameters: OpenAPIV3.ParameterObject[]
  ): PathOperation["headerParams"] {
    const headerParams = allParameters
      .filter(p => p.in === "header")
      .map(p => ({
        name: p.name,
        description: p.description,
        required: p.required,
        type: this.expectPrimativeType(p)
      }));

    return headerParams;
  }

  resolvePositionParams(
    allParameters: OpenAPIV3.ParameterObject[]
  ): PathOperation["positionalParams"] {
    const positionalParameters = allParameters
      .filter(p => p.in === "path")
      .map(p => ({
        name: p.name,
        description: p.description,
        required: p.required,
        type: this.expectPrimativeType(p) as "string"
      }));

    return positionalParameters;
  }

  followReference(obj) {
    if (!obj.$ref) {
      return obj;
    }

    const parts = obj.$ref.split("/").slice(1);

    return get(this.doc, parts);
  }

  // Get a primative typescript type from an object that might have a `schema` field
  expectPrimativeType(obj): "any" | "string" | "number" {
    switch (get(obj, "schema.type", null)) {
      case "string":
        return "string";
      case "integer":
      case "number":
        return "number";
      default:
        // TODO: Resolve array types
        return "any";
    }
  }

  registerType(name: string, impl: TypeImplementation): void {
    if (this.namedTypes[name] && this.namedTypes[name] !== impl) {
      throw new Error(
        `cannot register conflicting implementations for type "${name}"`
      );
    }

    this.namedTypes[name] = impl;
  }

  print() {
    const namedTypesOutput = Object.values(this.namedTypes).join("\n\n");

    const pathOperationsOuput = this.pathOperations
      .map(op => printPathOperation(op))
      .join("\n\n");

    const output = `${namedTypesOutput}\n\n${pathOperationsOuput}`;

    return output;
  }
}

export async function generate(
  docOrPathToDoc: string | OpenAPIV3.Document
): Promise<string> {
  const doc = (await bundle(docOrPathToDoc)) as OpenAPIV3.Document;

  const output = format(new Generator(doc).print(), { parser: "typescript" });

  return output;
}
