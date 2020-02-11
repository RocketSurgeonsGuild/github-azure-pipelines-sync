import { AzureFunction, Context } from "@azure/functions";
import { githubGraphQL, gql, githubRest } from "../globals";
import labels from "../labels";
import { from } from "rxjs";
import { groupBy, toArray, map, mergeAll } from "rxjs/operators";

const timerTrigger: AzureFunction = async function(
  context: Context,
  myTimer: any
): Promise<void> {
  await syncLabels(context);
};

export async function syncLabels(context: Context, skip = true) {
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
  ).then(x => x as any);

  function getLabelName(name: string) {
    let match = name.match(/^:\w+: (.*)$/);
    if (match) return match[1];
    match = name.match(/^(.*) :\w+:$/);
    if (match) return match[1];
    return name;
  }

  for (const repo of repositoryOwner.repositories.nodes) {
    if (repo.isArchived) continue;
    const groups = await from(repo.labels.nodes)
      .pipe(
        groupBy(x => getLabelName(x.name)),
        map(x =>
          x.pipe(
            toArray(),
            map(values => [x.key, values] as const)
          )
        ),
        mergeAll(),
        toArray()
      )
      .toPromise();
    for (const [key, values] of groups) {
      if (values.length > 1) {
        for (const value of values) {
          if (labels.some(l => l.name === value.name)) continue;
          context.log(
            "deleting extra label",
            repo.owner.name,
            repo.name,
            value.name
          );
          await githubRest.issues.deleteLabel({
            owner: repo.owner.name,
            repo: repo.name,
            name: value.name
          });
        }
      } else {
        if (
          labels.some(
            label => getLabelName(label.name) === getLabelName(values[0].name)
          )
        )
          continue;

        context.log(
          "deleting label",
          repo.owner.name,
          repo.name,
          values[0].name
        );
        await githubRest.issues.deleteLabel({
          owner: repo.owner.name,
          repo: repo.name,
          name: values[0].name
        });
      }
    }

    context.log("repo", repo.owner.name, repo.name);
    for (const definedLabel of labels) {
      if (
        skip &&
        repo.labels.nodes.some(
          repoLabel =>
            repoLabel.name === definedLabel.name &&
            repoLabel.description === definedLabel.description &&
            repoLabel.color === definedLabel.color
        )
      ) {
        context.log(
          "skipping label",
          repo.owner.name,
          repo.name,
          definedLabel.name
        );
        continue;
      }

      if (
        repo.labels.nodes.some(
          repoLabel =>
            getLabelName(definedLabel.name) === getLabelName(repoLabel.name)
        )
      ) {
        context.log(
          "updating label",
          repo.owner.name,
          repo.name,
          definedLabel.name
        );
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
        context.log(
          "creating label",
          repo.owner.name,
          repo.name,
          definedLabel.name
        );

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
}

export default timerTrigger;
