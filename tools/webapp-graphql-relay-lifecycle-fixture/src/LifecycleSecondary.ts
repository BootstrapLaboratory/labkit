import { graphql } from "react-relay";

export const lifecycleSecondaryQuery = graphql`
  query LifecycleSecondaryQuery($id: ID!) {
    secondaryItem(id: $id) {
      id
      label
    }
  }
`;
