export type TypeImplementation = string;

export type Operation = "get" | "post" | "put" | "patch" | "delete";

export const OPERATIONS: Operation[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete"
];

// A PathOperation is created for each path and method combination in the
// OpenAPI doc. It represents all the information needed to print out an
// implementation of a function that makes an HTTP request to that endpoint.
export type PathOperation = {
  // e.g. "/scrapers/{id}/members"
  path: string;

  operation: Operation;

  // Corresponds to OpenAPI Operation Object summary field.
  //
  // e.g. "List all users with member privileges for a scraper target"
  summary: string;

  positionalParams: Array<{
    name: string;
    description: string;
    required: boolean;
    type: "string";
  }>;

  headerParams: Array<{
    name: string;
    description: string;
    required: boolean;
    type: "string" | "string[]" | "number" | "any";
  }>;

  queryParams: Array<{
    name: string;
    description: string;
    required: boolean;
    type: "string" | "string[]" | "number";
  }>;

  bodyParam: { name: "body"; type: TypeImplementation } | null;

  responses: {
    [code: string]: {
      description: string;

      mediaTypes: {
        [mediaType: string]: { type: TypeImplementation };
      };
    };
  };
};
