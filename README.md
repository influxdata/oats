An opinionated **O**pen**A**PI doc to **T**ype**S**cript HTTP client generator.

In comparison to [openapi-generator](https://github.com/OpenAPITools/openapi-generator):

- Strives to generate readable output
- Supports enums, `oneOf`, and `allOf`
- Does not require Java runtime
- Generates `fetch`-based HTTP client with typed error responses 

### Installation

```
yarn add -D @chnn/oats
```

### Usage

```
$ yarn run oats --help
```

```
Usage: oats [options] <spec>

Options:
  --types-only  only output type definitions
  -h, --help    output usage information
```
