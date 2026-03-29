import { describe, it, expect } from "vitest";
import { mergeTypeMappings } from "../../merge-type-mappings";

describe("mergeTypeMappings", () => {
  const defaultTypeMappings = {
    String: "string",
    Boolean: "boolean",
    Int: "number",
    Float: "number",
    ID: "string",
  };

  it("returns default scalar type mappings if it receives no custom types.", () => {
    expect(mergeTypeMappings({})).toEqual(defaultTypeMappings);
  });

  it("overwrites default values if they are provided as custom types.", () => {
    const overwrittenTypes = {
      String: "customStringType",
      Boolean: "customBooleanType",
      Int: "customIntType",
      Float: "customFloatType",
      ID: "customIDType",
    };

    expect(mergeTypeMappings(overwrittenTypes)).toEqual(overwrittenTypes);
  });

  it("combines defaults with added custom types.", () => {
    const customTypes = {
      foo: "bar",
    };

    const merged = {
      ...defaultTypeMappings,
      ...customTypes,
    };

    expect(mergeTypeMappings(customTypes)).toEqual(merged);
  });
});
