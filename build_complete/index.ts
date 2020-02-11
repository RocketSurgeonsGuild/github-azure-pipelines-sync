import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import semver from "semver";
import { githubRest, githubGraphQL, FetchMilestones } from "../globals";

const buildComplete: AzureFunction = async function(
  context: Context,
  req: HttpRequest
): Promise<void> {
  const body: BuildComplete = req.body;

  if (body.eventType !== "build.complete") {
    context.res = {
      status: 200
    };
    return;
  }

  //   console.log(body.resource);
  console.log(body.resource.status, body.resource.result);
  if (
    !(
      body.resource.status === "completed" &&
      body.resource.result === "succeeded"
    )
  ) {
    context.res = {
      status: 200
    };
    return;
  }

  //   console.log(body.resource);

  const version = semver.parse(body.resource.buildNumber, {
    includePrerelease: true,
    loose: true
  });

  if (body.resource.repository.type !== "GitHub") {
    context.res = {
      status: 200,
      body: `This webhook only works with GitHub repositories`
    };
    return;
  }

  if (!version) {
    context.res = {
      status: 200,
      body: `Version returned by build was not a valid semver ${body.resource.buildNumber}`
    };
    return;
  }

  console.log(version, `v${version.major}.${version.minor}.${version.patch}`);
  const milestone = `v${version.major}.${version.minor}.${version.patch}`;

  const [owner, repo] = body.resource.repository.id.split("/");

  const { repository }: FetchMilestones = await githubGraphQL(FetchMilestones, {
    owner,
    name: repo
  }).then(x => x as any);

  const existingMilestone = repository.milestones.nodes.find(
    z => z.title === milestone
  );
  if (existingMilestone) {
    if (body.resource.buildNumber === milestone) {
      var existingMilestones = await githubRest.issues.listMilestonesForRepo({
        owner,
        repo,
        state: "open",
        per_page: 100
      });
      var foundMilestone = existingMilestones.data.find(
        z => z.title === milestone
      )!;

      await githubRest.issues.updateMilestone({
        milestone_number: foundMilestone.id,
        owner,
        repo,
        title: milestone,
        state: "closed"
      });
    } else {
      context.res = {
        status: 200,
        body: `Milestone ${milestone} already exists!`
      };
    }
    return;
  }

  await githubRest.issues.createMilestone({
    owner,
    repo,
    title: milestone,
    state: "open"
  });

  context.res = {
    status: 200,
    body: `Milestone ${milestone} created!`
  };
};

export default buildComplete;

export interface BuildComplete {
  subscriptionId: string;
  notificationId: number;
  id: string;
  eventType: string;
  publisherId: string;
  message: MessageOrDetailedMessage;
  detailedMessage: MessageOrDetailedMessage;
  resource: Resource;
  resourceVersion: string;
  resourceContainers: ResourceContainers;
  createdDate: string;
}
export interface MessageOrDetailedMessage {
  text: string;
  html: string;
  markdown: string;
}
export interface Resource {
  _links: Links;
  properties: PropertiesOrTriggerInfo;
  tags?: null[] | null;
  validationResults?: null[] | null;
  plans?: PlansEntityOrOrchestrationPlan[] | null;
  triggerInfo: PropertiesOrTriggerInfo;
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  queueTime: string;
  startTime: string;
  finishTime: string;
  url: string;
  definition: Definition;
  buildNumberRevision: number;
  project: Project;
  uri: string;
  sourceBranch: string;
  sourceVersion: string;
  queue: Queue;
  priority: string;
  reason: string;
  requestedFor: RequestedForOrRequestedByOrLastChangedBy;
  requestedBy: RequestedForOrRequestedByOrLastChangedBy;
  lastChangedDate: string;
  lastChangedBy: RequestedForOrRequestedByOrLastChangedBy;
  parameters: string;
  orchestrationPlan: PlansEntityOrOrchestrationPlan;
  logs: Logs;
  repository: Repository;
  keepForever: boolean;
  retainedByRelease: boolean;
  triggeredByBuild?: null;
}
export interface Links {
  self: SelfOrWebOrSourceVersionDisplayUriOrTimelineOrBadgeOrAvatar;
  web: SelfOrWebOrSourceVersionDisplayUriOrTimelineOrBadgeOrAvatar;
  sourceVersionDisplayUri: SelfOrWebOrSourceVersionDisplayUriOrTimelineOrBadgeOrAvatar;
  timeline: SelfOrWebOrSourceVersionDisplayUriOrTimelineOrBadgeOrAvatar;
  badge: SelfOrWebOrSourceVersionDisplayUriOrTimelineOrBadgeOrAvatar;
}
export interface SelfOrWebOrSourceVersionDisplayUriOrTimelineOrBadgeOrAvatar {
  href: string;
}
export interface PropertiesOrTriggerInfo {}
export interface PlansEntityOrOrchestrationPlan {
  planId: string;
}
export interface Definition {
  drafts?: null[] | null;
  id: number;
  name: string;
  url: string;
  uri: string;
  path: string;
  type: string;
  queueStatus: string;
  revision: number;
  project: Project;
}
export interface Project {
  id: string;
  name: string;
  url: string;
  state: string;
  revision: number;
  visibility: string;
  lastUpdateTime: string;
}
export interface Queue {
  id: number;
  name: string;
  pool: Pool;
}
export interface Pool {
  id: number;
  name: string;
  isHosted: boolean;
}
export interface RequestedForOrRequestedByOrLastChangedBy {
  displayName: string;
  url: string;
  _links: Links1;
  id: string;
  uniqueName: string;
  imageUrl: string;
  descriptor: string;
}
export interface Links1 {
  avatar: SelfOrWebOrSourceVersionDisplayUriOrTimelineOrBadgeOrAvatar;
}
export interface Logs {
  id: number;
  type: string;
  url: string;
}
export interface Repository {
  id: string;
  type: string;
  clean?: null;
  checkoutSubmodules: boolean;
}
export interface ResourceContainers {
  collection: CollectionOrAccountOrProject;
  account: CollectionOrAccountOrProject;
  project: CollectionOrAccountOrProject;
}
export interface CollectionOrAccountOrProject {
  id: string;
  baseUrl: string;
}
