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
Usage: oats [options] <spec>

Options:
  -h, --help    output usage information
```

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).
