import { generate } from "./generate"

if (require.main === module) {
  generate(process.argv[2]).then(result => console.log(result))
}

export { generate }
