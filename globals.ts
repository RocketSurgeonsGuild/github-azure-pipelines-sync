import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";

export const gql = (strings: TemplateStringsArray) => {
  return strings.join("");
};
export const githubGraphQL = graphql.defaults({
  headers: { authorization: `token ${process.env.GITHUB_TOKEN}` }
});
export const githubRest = new Octokit({
  auth: () => process.env.GITHUB_TOKEN!
});

export const FetchMilestones = gql`
  query getMilestones($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      fullname: nameWithOwner
      name
      milestones(last: 100, states: OPEN) {
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
          startCursor
        }
        totalCount
        nodes {
          id
          number
          title
          closed
        }
      }
    }
  }
`;
export type FetchMilestones = {
  repository: {
    fullename: string;
    name: string;
    milestones: {
      pageInfo: {
        endCursor: string;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
      };
      totalCount: number;
      nodes: [
        {
          id: string;
          number: number;
          title: string;
          closed: boolean;
        }
      ];
    };
  };
};
