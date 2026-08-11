import { graphql } from "react-relay";

export const lifecycleItemQuery = graphql`
  query LifecycleItemQuery($id: ID!) {
    item(id: $id) {
      id
      label
    }
  }
`;
