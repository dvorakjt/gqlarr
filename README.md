# GQLARR

GQLARR (GraphQL Almighty Root Resolver, pronounced "G-Clar") is a 
[GraphQL Codegen](https://the-guild.dev/graphql/codegen) plugin that 
streamlines the process of implementing the [Almighty Root Resolver](https://medium.com/smartive/advanced-graphql-patterns-the-almighty-root-resolver-f284872397cb) pattern.


## Installation

```
npm i graphql @graphql-codegen/cli gqlarr
```

Note that `gqlarr` should be not be installed as a dev dependency. In addition 
to the main plugin, there are several helper functions that it exports which 
your application will require during runtime.

## Type Generation

Create a `codegen.config.ts` file in the root directory of your project, and 
add contents like these:

```ts
import type { CodegenConfig } from '@graphql-codegen/cli';
import type { GQLARRConfig } from 'gqlarr';

const gqlarrConfig: GQLARRConfig = {
  types: {
    DateTime: 'string', // The DateTime scalar will be typed as a string in the output
    InputCoordinates: 'Point', // The InputCoordinates input object type will be typed as a Point
  },
  imports: {
    './point': ['Point'], // Import the Point type from the same directory as the output
  },
};

const config: CodegenConfig = {
  // The location of your schema files
  schema: './src/graphql/**/*.graphql',
  generates: {
    // The file to write output to
    'src/model/graphql-types.ts': {
      plugins: ['gqlarr'], // Specify only gqlarr, the gqlarr plugin does not require the TypeScript plugin
    },
  },
  config: gqlarrConfig,
};

export default config;

```

## Generate the Types

```
npx graphql-codegen --config codegen.config.ts
```

## Create Your Resolvers

A `gqlarr` object will be created in the type definition file that is generated. This object has methods specific to the operation types in your schema which can retrieve information about individual fields of those top-level operations. In turn, the retrieved field has information about its fields, and so on. You can use these inside top-level resolvers to build up a database query representing all of the information requested by the client.

Each field object extends the following basic structure:

```
interface Field {
  name: string;
  on: string;
  alias: string;
  arguments: Record<string, unknown>;
  fields: Field[];
}
```

All properties except alias, though, will be typed according to your schema. So, for instance, name will actually be a union of string literals representing the possible field names on a given parent. The `on` property represents the type of the field's parent node. This can be used to resolve fields for specific implementations of an interface when the user has requested them using fragments. `arguments` contains the actual arguments passed to the field request. The `alias` property contains an alias if one was provided, but defaults to the name of the field, so you should always use it to name the resultant property in the object you send back to the client. `fields` is an array of the actual fields requested by the client, and you can switch on the `name` and `on` properties of each field to return the correct values to the client. You should get great intellisense in compatible IDEs for all of these properties.

