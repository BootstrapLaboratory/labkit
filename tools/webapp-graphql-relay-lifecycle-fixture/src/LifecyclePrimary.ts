import { graphql } from "react-relay";

export const lifecyclePrimaryQuery = graphql`
  query LifecyclePrimaryQuery($id: ID!) {
    item(id: $id) {
      id
      label
    }
  }
`;
