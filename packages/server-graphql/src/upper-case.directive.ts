import { getDirective, MapperKind, mapSchema } from "@graphql-tools/utils";
import {
  defaultFieldResolver,
  type GraphQLFieldResolver,
  type GraphQLSchema,
} from "graphql";

type ResolverArguments = Parameters<GraphQLFieldResolver<any, any>>;

export function upperDirectiveTransformer(
  schema: GraphQLSchema,
  directiveName: string,
): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const upperDirective = getDirective(
        schema,
        fieldConfig,
        directiveName,
      )?.[0];

      if (!upperDirective) {
        return undefined;
      }

      const resolve = (fieldConfig.resolve ??
        defaultFieldResolver) as GraphQLFieldResolver<any, any>;

      fieldConfig.resolve = async (...resolverArguments: ResolverArguments) => {
        const result = await resolve(...resolverArguments);
        if (typeof result === "string") {
          return result.toUpperCase();
        }

        return result;
      };

      return fieldConfig;
    },
  });
}
