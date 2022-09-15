An opinionated OpenAPI doc to TypeScript HTTP client generator.

In comparison to [openapi-generator](https://github.com/OpenAPITools/openapi-generator):

- Strives to generate readable output
- Supports enums, `oneOf`, and `allOf`
- Does not require Java runtime
- Generates `fetch`-based HTTP client with typed error responses 
- Does not support significant portions of the OpenAPI spec


## Installation

```
yarn add -D @influxdata/oats
```

## Usage

```
$ yarn run oats --help
```

```
Usage: oats [options] <openApiSpec...>

An opinionated OpenAPI doc to TypeScript HTTP client generator

Options:
  -V, --version                output the version number
  -i, --include <parts>        comma sepated list of code parts to generate (all by default: "types,request,operations")
  -p, --prettier [true/false]  prettier output code (default: true)
  --withDoc [true/false]       document generated types (default: true)
  --patchScript <file>         apply script that modifies openapi document (example: https://github.com/influxdata/influxdb-client-js/blob/master/packages/apis/scripts/patchSwagger.js)
  --storeOperations <file>     store operations to file
  -h, --help                   output usage information
  ```

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).
