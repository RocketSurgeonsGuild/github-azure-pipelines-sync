import { AzureFunction, Context } from "@azure/functions";
import { githubGraphQL, gql, githubRest } from "../globals";
import labels, { labelUpdater } from "../labels";

const timerTrigger: AzureFunction = async function(
  context: Context,
  myTimer: any
): Promise<void> {
  await labelUpdater(context);
};

export default timerTrigger;
