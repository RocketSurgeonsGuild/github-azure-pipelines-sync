import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { syncLabels } from "../github_labels";

const buildComplete: AzureFunction = async function(
  context: Context,
  req: HttpRequest
): Promise<void> {
  await syncLabels(context, false);
};

export default buildComplete;
