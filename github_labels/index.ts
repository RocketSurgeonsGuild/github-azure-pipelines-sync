import { AzureFunction, Context } from "@azure/functions";
import { githubGraphQL, gql, githubRest } from "../globals";
import labels from "../labels";

const timerTrigger: AzureFunction = async function(
  context: Context,
  myTimer: any
): Promise<void> {
  const {
    repositoryOwner
  }: {
    repositoryOwner: {
      id: string;
      login: string;
      repositories: {
        nodes: Array<{
          id: string;
          name: string;
          isArchived: boolean;
          owner: {
            name: string;
          };
          labels: {
            nodes: Array<{
              id: string;
              name: string;
              color: string;
              description: string;
            }>;
          };
        }>;
      };
    };
  } = await githubGraphQL(
    gql`
      query a($owner: String!) {
        repositoryOwner(login: $owner) {
          id
          login
          repositories(first: 100) {
            nodes {
              id
              name
              isArchived
              owner {
                name: login
              }
              labels(first: 100) {
                nodes {
                  id
                  name
                  color
                  description
                }
              }
            }
          }
        }
      }
    `,
    { owner: "RocketSurgeonsGuild" }
  );

  for (const repo of repositoryOwner.repositories.nodes) {
    if (repo.isArchived) continue;
    for (const definedLabel of labels) {
      if (
        repo.labels.nodes.some(
          repoLabel =>
            repoLabel.name === definedLabel.name &&
            // repoLabel.description === definedLabel.description &&
            repoLabel.color === definedLabel.color
        )
      ) {
        context.log("skipping", repo.owner.name, repo.name, definedLabel.name);
        continue;
      }

      if (
        repo.labels.nodes.some(
          repoLabel => repoLabel.name === definedLabel.name
        )
      ) {
        context.log("updating", repo.owner.name, repo.name, definedLabel.name);
        // call description manually?
        await githubRest.issues.updateLabel({
          description: definedLabel.description,
          owner: repo.owner.name,
          repo: repo.name,
          color: definedLabel.color,
          name: definedLabel.name,
          current_name: definedLabel.name
        });
      } else {
        context.log("creating", repo.owner.name, repo.name, definedLabel.name);

        await githubRest.issues.createLabel({
          owner: repo.owner.name,
          repo: repo.name,
          color: definedLabel.color,
          name: definedLabel.name,
          description: definedLabel.description
        });
      }
    }
  }
};

export default timerTrigger;
