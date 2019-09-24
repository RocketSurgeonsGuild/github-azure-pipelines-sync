import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { githubGraphQL, gql, githubRest } from "../globals";
import labels, { labelUpdater } from "../labels";

const buildComplete: AzureFunction = function(
  context: Context,
  req: HttpRequest
): Promise<void> {
  return labelUpdater(context);
};

export default buildComplete;
