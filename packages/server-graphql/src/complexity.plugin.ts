import type {
  ApolloServerPlugin,
  GraphQLRequestListener,
} from "@apollo/server";
import { Plugin } from "@nestjs/apollo";
import { GraphQLSchemaHost } from "@nestjs/graphql";
import { GraphQLError } from "graphql";
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from "graphql-query-complexity";

export const DEFAULT_MAX_QUERY_COMPLEXITY = 20;
export const DEFAULT_QUERY_COMPLEXITY = 1;

@Plugin()
export class ComplexityPlugin implements ApolloServerPlugin {
  constructor(private gqlSchemaHost: GraphQLSchemaHost) {}

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const { schema } = this.gqlSchemaHost;

    return {
      async didResolveOperation({ request, document }) {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: DEFAULT_QUERY_COMPLEXITY }),
          ],
        });

        if (complexity >= DEFAULT_MAX_QUERY_COMPLEXITY) {
          throw new GraphQLError(
            `Query is too complex: ${complexity}. Maximum allowed complexity: ${DEFAULT_MAX_QUERY_COMPLEXITY}`,
          );
        }

        console.log("Query Complexity:", complexity);
      },
    };
  }
}
