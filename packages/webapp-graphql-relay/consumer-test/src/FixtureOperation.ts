import { graphql } from "react-relay";

export const fixtureConsumerContractQuery = graphql`
  query FixtureOperationQuery {
    viewer {
      id
      name
    }
  }
`;
