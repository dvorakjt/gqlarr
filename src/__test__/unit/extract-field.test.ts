import { describe, it, expect } from "vitest";
import { extractField } from "../../helpers";
import {
  GraphQLSchema,
  GraphQLObjectType,
  Kind,
  type FieldNode,
  type ArgumentNode,
  type GraphQLResolveInfo,
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLID,
  OperationTypeNode,
  GraphQLInterfaceType,
  GraphQLString,
  GraphQLList,
  GraphQLBoolean,
} from "graphql";

describe("extractField", () => {
  it("returns the correct field information for a given node.", () => {
    const coordinatesType = new GraphQLObjectType({
      name: "Coordinates",
      fields: {
        latitude: {
          type: GraphQLFloat,
        },
        longitude: {
          type: GraphQLFloat,
        },
      },
    });

    const inputCoordinatesType = new GraphQLInputObjectType({
      name: "InputCoordinates",
      fields: {
        latitude: {
          type: GraphQLFloat,
        },
        longitude: {
          type: GraphQLFloat,
        },
      },
    });

    const distanceUnitsEnumType = new GraphQLEnumType({
      name: "DistanceUnits",
      values: {
        KILOMETERS: {
          value: "KILOMETERS",
        },
        MILES: {
          value: "MILES",
        },
      },
    });

    const locationType = new GraphQLObjectType({
      name: "Location",
      fields: {
        id: {
          type: GraphQLID,
        },
        coordinates: {
          type: coordinatesType,
        },
        distance: {
          type: GraphQLFloat,
          args: {
            from: {
              type: inputCoordinatesType,
            },
            units: {
              type: distanceUnitsEnumType,
            },
          },
        },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields: {
          location: {
            type: locationType,
            args: {
              id: {
                type: GraphQLID,
              },
            },
          },
        },
      }),
    });

    const node: FieldNode = {
      kind: Kind.FIELD,
      name: {
        kind: Kind.NAME,
        value: "location",
      },
      arguments: [
        {
          kind: Kind.ARGUMENT,
          name: {
            kind: Kind.NAME,
            value: "id",
          },
          value: {
            kind: Kind.STRING,
            value: "4ff33567-8a36-4b49-a1f5-559017d290fb",
          },
        },
      ],
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FIELD,
            name: {
              kind: Kind.NAME,
              value: "id",
            },
          },
          {
            kind: Kind.FIELD,
            name: {
              kind: Kind.NAME,
              value: "coordinates",
            },
            selectionSet: {
              kind: Kind.SELECTION_SET,
              selections: [
                {
                  kind: Kind.FIELD,
                  name: {
                    kind: Kind.NAME,
                    value: "latitude",
                  },
                },
                {
                  kind: Kind.FIELD,
                  name: {
                    kind: Kind.NAME,
                    value: "longitude",
                  },
                },
              ],
            },
          },
          {
            kind: Kind.FIELD,
            name: {
              kind: Kind.NAME,
              value: "distance",
            },
            arguments: [
              {
                kind: Kind.ARGUMENT,
                name: {
                  kind: Kind.NAME,
                  value: "from",
                },
                value: {
                  kind: Kind.OBJECT,
                  fields: [
                    {
                      kind: Kind.OBJECT_FIELD,
                      name: {
                        kind: Kind.NAME,
                        value: "latitude",
                      },
                      value: {
                        kind: Kind.FLOAT,
                        value: "33.744371862996815",
                      },
                    },
                    {
                      kind: Kind.OBJECT_FIELD,
                      name: {
                        kind: Kind.NAME,
                        value: "longitude",
                      },
                      value: {
                        kind: Kind.FLOAT,
                        value: "-117.77332257472057",
                      },
                    },
                  ],
                },
              },
              {
                kind: Kind.ARGUMENT,
                name: {
                  kind: Kind.NAME,
                  value: "units",
                },
                value: {
                  kind: Kind.ENUM,
                  value: "MILES",
                },
              },
            ],
          },
        ],
      },
    };

    const info: GraphQLResolveInfo = {
      fieldName: "location",
      fieldNodes: [node],
      returnType: locationType,
      parentType: schema.getQueryType()!,
      schema,
      fragments: {},
      rootValue: {},
      operation: {
        kind: Kind.OPERATION_DEFINITION,
        operation: "query" as OperationTypeNode,
        variableDefinitions: [],
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [node],
        },
        directives: [],
      },
      variableValues: {},
      path: {
        prev: undefined,
        key: "location",
        typename: "Location",
      },
    };

    const expectedOutput = {
      name: "location",
      alias: "location",
      on: "Query",
      arguments: {
        id: "4ff33567-8a36-4b49-a1f5-559017d290fb",
      },
      fields: [
        {
          name: "id",
          alias: "id",
          on: "Location",
          arguments: {},
          fields: [],
        },
        {
          name: "coordinates",
          alias: "coordinates",
          on: "Location",
          arguments: {},
          fields: [
            {
              name: "latitude",
              alias: "latitude",
              on: "Coordinates",
              arguments: {},
              fields: [],
            },
            {
              name: "longitude",
              alias: "longitude",
              on: "Coordinates",
              arguments: {},
              fields: [],
            },
          ],
        },
        {
          name: "distance",
          alias: "distance",
          on: "Location",
          arguments: {
            from: {
              latitude: 33.744371862996815,
              longitude: -117.77332257472057,
            },
            units: "MILES",
          },
          fields: [],
        },
      ],
    };

    expect(extractField(node, "Query", info)).toEqual(expectedOutput);
  });
});
