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