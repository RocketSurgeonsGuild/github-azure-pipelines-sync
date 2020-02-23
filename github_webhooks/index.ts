// tslint:disable: typedef

// -------------------------------------
// Requires a repo or org web hook
// -------------------------------------

import { AzureFunction, Context, HttpRequest, Logger } from "@azure/functions";
import express from "express";
import WebhooksApi, {
  PayloadRepository,
  WebhookPayloadIssuesIssue,
  WebhookPayloadPullRequestPullRequest
} from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";
import { identity, maxBy, differenceBy, slice } from "lodash";
import semver from "semver";
import { githubGraphQL, githubRest, gql, FetchMilestones } from "../globals";

import AbortController from "abort-controller";
import { from, Observable, empty, of, forkJoin, zip } from "rxjs";
import { mergeMap, map, expand, filter, toArray, skip } from "rxjs/operators";
const createHandler = require("azure-function-express").createHandler;

const webhooks = new WebhooksApi({
  secret: process.env.GITHUB_WEBHOOKS_SECRET!
  // path: "/api/github/webooks/"
});

const app = express();
app
  .use((req, res, next) => {
    req.url = "/";
    next();
  })
  .use((req, res, next) => {
    webhooks.middleware(req, res, next);
  });

webhooks.on("milestone.created", async event => {
  await ensureMilestonesAreCorrect({
    owner: event.payload.repository.owner.login,
    repo: event.payload.repository.name
  }).forEach(a => {});
});

// webhooks.on("release.created", async event => {
//   if (event.payload.release.draft) return;
//   if (!event.payload.release.prerelease) return;
//   if (
//     event.payload.release.body &&
//     !(event.payload.release as any).body.match(/This list of changes was/i)
//   )
//     return;
//   await ensureMilestonesAreCorrect({
//     owner: event.payload.repository.owner.login,
//     repo: event.payload.repository.name
//   }).forEach(a => {});
// });

// webhooks.on("pull_request.closed", async event => {
//   await ensureMilestonesAreCorrect({
//     owner: event.payload.repository.owner.login,
//     repo: event.payload.repository.name
//   }).forEach(a => {});
// });

webhooks.on("pull_request.closed", async event => {
  console.log(event.payload);
  if (event.payload.pull_request.milestone) return;
  if (!event.payload.pull_request.merged) return;
  try {
    await assignToCurrentMilestone(
      event.payload.repository,
      event.payload.pull_request
    );
  } catch (e) {
    console.error(e);
  }
});

// webhooks.on("*", ({ id, name, payload }) => {
//   log.info(name, "event received", id, payload);
// });

async function assignToCurrentMilestone(
  payloadRepository: PayloadRepository,
  issue: WebhookPayloadPullRequestPullRequest
) {
  const { repository }: FetchMilestones = await githubGraphQL(FetchMilestones, {
    owner: payloadRepository.owner.login,
    name: payloadRepository.name
  }).then(x => x as any);

  const milestoneVersions = repository.milestones.nodes
    .filter(x => !x.closed)
    .map(x => semver.valid(x.title))
    .filter(x => !!x) as string[];

  var newestMilestoneVersion = semver.rsort(milestoneVersions)[0];
  var milestone = repository.milestones.nodes.find(
    z => semver.valid(z.title) === newestMilestoneVersion
  )!;

  console.log({ id: issue.node_id, milestoneId: milestone.id });

  const labels = [];
  issue.labels = issue.labels.filter(z => !z.includes("merge"));

  if (issue.labels && issue.labels.length) {
    labels.push(...issue.labels);
  } else {
    labels.push(":sparkles: mysterious");
  }

  await githubRest.issues.update({
    owner: payloadRepository.owner.login,
    repo: payloadRepository.name,
    issue_number: issue.number,
    milestone: milestone.number,
    labels: labels
  });
}

export default createHandler(app);

function ensureMilestonesAreCorrect(request: { owner: string; repo: string }) {
  const milestones = getVersionMilestones(request);
  const versions = getTagVersions(request);

  return forkJoin(milestones, versions).pipe(
    mergeMap(([milestones, versions]) => {
      const unlabledMilestones = differenceBy(
        milestones,
        versions,
        z => z.semver
      );
      const versionRange = [
        "refs/heads/master",
        ...versions.map(z => `refs/tags/${z.name}`)
      ];

      const versionRanges = zip(
        from(versionRange),
        from(versionRange).pipe(skip(1))
      ).pipe(
        mergeMap(([head, base]) =>
          getPullRequestsBetween({ ...request, base, head }).pipe(
            toArray(),
            map(pullRequests => ({ head, base, pullRequests }))
          )
        )
      );

      return versionRanges.pipe(
        mergeMap(set => {
          const name = set.head
            .replace("refs/tags/", "")
            .replace("refs/heads/", "");

          let milestone = milestones.find(z => z.title === name);
          if (name === "master" && unlabledMilestones.length) {
            milestone = unlabledMilestones[0];
          }

          if (milestone) {
            return from(set.pullRequests).pipe(
              mergeMap(pr => {
                console.log(`checking milestone for #${pr.id} - ${pr.title}`);
                if (
                  milestone &&
                  pr.milestone &&
                  pr.milestone.title !== milestone.title
                ) {
                  console.log(
                    `need to update milestone on ${pr.title} from ${pr.milestone.title} to ${milestone.title}`
                  );
                  return from(
                    githubRest.issues.update({
                      ...request,
                      milestone: milestone.number,
                      issue_number: pr.number
                    })
                  ).pipe(mergeMap(() => empty()));
                }
                return empty();
              })
            );
          }

          return empty();
        })
      );
    })
  );
}

function getTagVersions(request: { owner: string; repo: string }) {
  return rxifyRequest(githubRest, githubRest.repos.listTags, request).pipe(
    map(x => ({ ...x, semver: semver.parse(x.name)! })),
    filter(z => z.semver != null),
    toArray(),
    map(versions =>
      versions.sort((a, b) => semver.rcompare(a.semver, b.semver))
    ),
    map(z => slice(z, 0, 2))
  );
}

function getVersionMilestones(request: { owner: string; repo: string }) {
  return rxifyRequest(githubRest, githubRest.issues.listMilestonesForRepo, {
    ...request,
    state: "all"
  }).pipe(
    map(x => ({ ...x, semver: semver.parse(x.title)! })),
    filter(z => z.semver != null),
    toArray(),
    map(milestones =>
      milestones.sort((a, b) => semver.rcompare(a.semver, b.semver))
    ),
    map(z => slice(z, 0, 3))
  );
}

function getPullRequestsBetween(request: {
  head: string;
  base: string;
  owner: string;
  repo: string;
}) {
  const { owner, repo } = request;
  return rxifyRequest(
    githubRest,
    githubRest.repos.compareCommits,
    request
  ).pipe(
    mergeMap(commits =>
      from(commits.commits).pipe(
        mergeMap(
          commit =>
            rxifyRequest(
              githubRest,
              githubRest.repos.listPullRequestsAssociatedWithCommit,
              {
                owner,
                repo,
                commit_sha: commit.sha
              }
            ),
          4
        )
      )
    )
  );
}

type ValueOf<T> = T extends Array<infer R>
  ? R
  : T extends Promise<infer R>
  ? R
  : T extends Observable<infer R>
  ? R
  : T extends Iterator<infer R>
  ? R
  : T;

function rxifyRequest<T, R>(
  ocotokit: Octokit,
  method: (request: T) => Promise<Octokit.Response<R>>,
  request: T
) {
  delete (request as any).page;
  return new Observable<ValueOf<R>>(subscriber => {
    const controller = new AbortController();
    from(method({ ...request, request: { signal: controller.signal } }))
      .pipe(
        expand(({ headers }) => {
          if (headers.link) {
            const next = getLink(headers.link, "next");
            if (next) {
              return from(
                ocotokit.request({
                  url: next,
                  request: { signal: controller.signal }
                }) as Promise<Octokit.Response<R>>
              );
            }
          }
          return empty();
        }),
        mergeMap(
          results =>
            (Array.isArray(results.data)
              ? from(results.data)
              : of(results.data)) as Observable<ValueOf<R>>
        )
      )
      .subscribe(subscriber);
    return () => controller.abort();
  });
}

function getLink(value: string, name: string) {
  return (value.match(new RegExp(`<([^>]+)>;\\s*rel="${name}"`)) || [])[1];
}
