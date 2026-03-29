import { describe, it, expect } from "vitest";
import { isNamedFieldNode } from "../../helpers";
import { Kind, type FieldNode, type FragmentSpreadNode } from "graphql";

describe("isNamedFieldNode", () => {
  it("returns true for a field node with the correct name.", () => {
    const node: FieldNode = {
      kind: Kind.FIELD,
      name: {
        kind: Kind.NAME,
        value: "foo",
      },
    };

    expect(isNamedFieldNode(node, node.name.value)).toBe(true);
  });

  it("returns false for a field node with the wrong name.", () => {
    const node: FieldNode = {
      kind: Kind.FIELD,
      name: {
        kind: Kind.NAME,
        value: "foo",
      },
    };

    expect(isNamedFieldNode(node, "bar")).toBe(false);
  });

  it("returns false for other types of nodes.", () => {
    const node: FragmentSpreadNode = {
      kind: Kind.FRAGMENT_SPREAD,
      name: {
        kind: Kind.NAME,
        value: "foo",
      },
    };

    expect(isNamedFieldNode(node, node.name.value)).toBe(false);
  });
});
