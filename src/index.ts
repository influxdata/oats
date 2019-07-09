import { generate } from "./generate";

generate(process.argv[2]).then(result => console.log(result));
