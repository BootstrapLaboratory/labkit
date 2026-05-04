import { Scalar, type CustomScalar } from "@nestjs/graphql";
import { Kind, type ValueNode } from "graphql";

@Scalar("Date", () => Date)
export class DateScalar implements CustomScalar<number, Date | null> {
  description = "Date custom scalar type";

  parseValue(value: unknown): Date | null {
    if (typeof value !== "number") {
      return null;
    }

    return new Date(value);
  }

  serialize(value: unknown): number {
    if (!(value instanceof Date)) {
      throw new TypeError("DateScalar can only serialize Date instances");
    }

    return value.getTime();
  }

  parseLiteral(ast: ValueNode): Date | null {
    if (ast.kind === Kind.INT) {
      return new Date(Number(ast.value));
    }

    return null;
  }
}
