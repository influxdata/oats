import { PathOperation, TypeImplementation } from "./types";

export class Registry {
  public pathOperations: PathOperation[] = [];
  public namedTypes: { [name: string]: TypeImplementation } = {};

  public registerType(name: string, impl: TypeImplementation): void {
    if (this.namedTypes[name] && this.namedTypes[name] !== impl) {
      throw new Error(
        `cannot register conflicting implementations for type "${name}"`
      );
    }

    this.namedTypes[name] = impl;
  }
}
