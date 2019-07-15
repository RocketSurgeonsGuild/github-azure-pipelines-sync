import { AzureFunction, Context } from "@azure/functions";
import { githubGraphQL, gql, githubRest } from "../globals";

const labels = [
  {
    name: ":beetle: bug",
    color: "d73a4a",
    description: "Something isn't working"
  },
  {
    name: ":blue_book: documentation",
    color: "0075ca",
    description: "Improvements or additions to documentation"
  },
  {
    name: ":family: duplicate",
    color: "cfd3d7",
    description: "This issue or pull request already exists"
  },
  {
    name: ":fire: enhancement",
    color: "a2eeef",
    description: "New feature or request"
  },
  {
    name: ":raised_hand: help wanted",
    color: "008672",
    description: "Extra attention is needed"
  },
  {
    name: ":raised_hand: good first issue",
    color: "7057ff",
    description: "Good for newcomers"
  },
  {
    name: ":x: invalid",
    color: "e4e669",
    description: "This doesn't seem right"
  },
  {
    name: ":grey_question: question",
    color: "d876e3",
    description: "Further information is requested"
  },
  {
    name: ":lock: wontfix",
    color: "ffffff",
    description: "This will not be worked on"
  },
  {
    name: ":rocket: feature",
    color: "ccf5ff",
    description: "This adds some form of new functionality"
  },
  {
    name: ":boom: breaking change",
    color: "efa7ae",
    description: "This breaks existing behavior"
  },
  {
    name: ":sparkles: mysterious",
    color: "cccccc",
    description: "We forgot to label this"
  },
  {
    name: ":squirrel: chore",
    color: "27127c",
    description: "Just keeping things neat and tidy"
  },
];

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
    // const labelsToDelete = [];
    // for (const repoLabel of repo.labels.nodes) {
    //   context.log(repoLabel.name);
    //   if (labels.some(definedLabel => repoLabel.name === definedLabel.name))
    //     continue;
    //   labelsToDelete.push(
    //     githubRest.issues.deleteLabel({
    //       name: repoLabel.name,
    //       owner: repo.owner.name,
    //       repo: repo.name
    //     })
    //   );
    // }

    // try {
    //   await Promise.all(labelsToDelete);
    // } catch (e) {}
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
