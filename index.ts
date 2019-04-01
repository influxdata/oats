import { parse } from "swagger-parser";

interface Registry {
  functions: { [name: string]: string };
  types: { [name: string]: string };
}

const registerFunction = (
  registry: Registry,
  fnName: string,
  fn: string
): void => {
  const entry = registry.functions[fnName];

  if (entry && entry !== fn) {
    throw new Error(`attempt to register existing function "${fnName}"`);
  }

  registry.functions[fnName] = fn;
};

const registerType = (
  registry: Registry,
  typeName: string,
  type: string
): void => {
  const entry = registry.types[typeName];

  if (entry && entry !== type) {
    throw new Error(`attempt to register existing type "${type}"`);
  }

  registry.types[typeName] = type;
};

const titleCase = (s: string) =>
  s.length ? `${s[0].toUpperCase()}${s.slice(1).toLowerCase()}` : s;

const depluralize = (s: string) =>
  s.endsWith("s") ? s.slice(0, s.length - 1) : s;

const niceifyName = (pathName: string): string =>
  pathName
    .split("/")
    .filter(p => !p.startsWith("{"))
    .map(titleCase)
    .map((p, i, ps) => (i !== ps.length - 1 ? depluralize(p) : p))
    .join("");

const statusCodeNames = {
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
  503: "ServiceUnavailable",
  default: "Default"
};

const registerResultType = (
  methodName: string,
  pathName: string,
  statusCode: string,
  responseData
): string => {
  const resultName = `${titleCase(methodName)}${pathName}${
    statusCodeNames[statusCode]
  }Response`;

  // register result type for each content variant (e.g. json, toml)

  return resultName;
};

const registerResultTypes = (
  registry: Registry,
  pathName: string,
  methodName: string,
  methodData
): string => {
  const resultVariantNames = Object.entries(methodData.responses).map(
    ([statusCode, responseData]) =>
      registerResultType(methodName, pathName, statusCode, responseData)
  );

  const resultName = `${titleCase(methodName)}${pathName}Response`;
  const resultType = `type ${resultName} = ${resultVariantNames.join(" | ")}`;

  registerType(registry, resultName, resultType);

  return resultName;
};

const registerParamsType = (
  registry: Registry,
  pathName: string,
  methodName: string,
  methodData
): string => {
  return `${titleCase(methodName)}${pathName}Params`;
};

const registerSchema = (): string => {
  // register if necessary

  // basic string, oneOf (ref), oneOf (primative), ...

  // need to recursively resolve

  return "SchemaName";
};

const generatePathMethod = (
  registry: Registry,
  pathName: string,
  methodName: string,
  methodData
): void => {
  const functionName = `${methodName.toLowerCase()}${pathName}`;

  // handle parameter in path, header, cookie, query, requestBody
  //
  // interface Params {
  //   // dashboard to create
  //   body: CreateDashboardRequest
  //   zapTraceSpan?: string
  //   owner?: string
  //   sortBy?: 'ID' | 'CreatedAt' | 'UpdatedAt'
  //
  // }

  const paramsName = registerParamsType(
    registry,
    pathName,
    methodName,
    methodData
  );

  const resultName = registerResultTypes(
    registry,
    pathName,
    methodData,
    methodData
  );

  const fn = `async function ${functionName}(params: ${paramsName}, fetchInit?: FetchInit): Promise<${resultName}> {
  const resp = await fetch(url, fetchInit)

  return {
    response: resp
    json: resp.json()
  }
}`;

  // generate a type for the paramaters
  //
  // const fnName = (params: ParameterType, fetchInit) =>
  //
  // generate a type for each response
  // generate a union for all responses
  //

  // console.log(pathName, methodName);
};

const generatePath = (registry: Registry, pathName: string, pathData): void => {
  const niceName = niceifyName(pathName);

  for (const [methodName, methodData] of Object.entries(pathData)) {
    generatePathMethod(registry, niceName, methodName, methodData);
  }
};

const generate = async (inFileName: string): Promise<string> => {
  const api = await parse(inFileName);

  const registry = { functions: {}, types: {} };

  for (const [pathName, pathData] of Object.entries(api.paths)) {
    generatePath(registry, pathName, pathData);
  }

  const result = [
    ...Object.values(registry.types),
    ...Object.values(registry.functions)
  ].join("\n\n");

  return result;
};

generate(process.argv[2]).then(file => console.log(file));
