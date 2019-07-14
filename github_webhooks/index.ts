// tslint:disable: typedef

// -------------------------------------
// Requires a repo or org web hook
// -------------------------------------

import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import express from "express";
import WebhooksApi, {
  PayloadRepository,
  WebhookPayloadIssuesIssue,
  WebhookPayloadPullRequestPullRequest
} from "@octokit/webhooks";
import { identity, maxBy } from "lodash";
import semver from "semver";
import { githubGraphQL, githubRest, gql, FetchMilestones } from "../globals";
const createHandler = require("azure-function-express").createHandler;

const webhooks = new WebhooksApi({
  secret: process.env.GITHUB_WEBHOOKS_SECRET!
  // path: "/api/github/webooks/"
});

const app = express();
app
  .use((req, res, next) => {
    req.url = "/";
    console.log(req.url);
    next();
  })
  .use((req, res, next) => {
    webhooks.middleware(req, res, next);
  });

webhooks.on("pull_request.closed", async event => {
  // console.log(event.payload);
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

webhooks.on("*", ({ id, name, payload }) => {
  // console.log(name, "event received", id, payload);
});

async function assignToCurrentMilestone(
  payloadRepository: PayloadRepository,
  issue: WebhookPayloadIssuesIssue | WebhookPayloadPullRequestPullRequest
) {
  const { repository }: FetchMilestones = await githubGraphQL(FetchMilestones, {
    owner: payloadRepository.owner.login,
    name: payloadRepository.name
  });

  const milestoneVersions = repository.milestones.nodes
    .filter(x => !x.closed)
    .map(x => semver.valid(x.title))
    .filter(x => !!x) as string[];

  var newestMilestoneVersion = semver.rsort(milestoneVersions)[0];
  var milestone = repository.milestones.nodes.find(
    z => semver.valid(z.title) === newestMilestoneVersion
  )!;

  console.log({ id: issue.node_id, milestoneId: milestone.id });

  githubRest.issues.update({
    owner: payloadRepository.owner.login,
    repo: payloadRepository.name,
    issue_number: issue.number,
    milestone: milestone.number
  });
}

export default createHandler(app);

// const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
//   context.log('HTTP trigger function processed a request.');
//   const name = (req.query.name || (req.body && req.body.name));

//   if (name) {
//       context.res = {
//           // status: 200, /* Defaults to 200 */
//           body: "Hello " + (req.query.name || req.body.name)
//       };
//   }
//   else {
//       context.res = {
//           status: 400,
//           body: "Please pass a name on the query string or in the request body"
//       };
//   }
// };

// export default httpTrigger;
