import { githubRest, githubGraphQL, gql } from "./globals";
import { Context } from "@azure/functions";

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
    name: ":hammer: chore",
    color: "27127c",
    description: "Just keeping things neat and tidy"
  },
  {
    name: ":package: dependencies",
    color: "edc397",
    description: "Pull requests that update a dependency file"
  },
  {
    name: ":shipit: merge",
    color: "98ed98",
    description: "Shipit!"
  }
];

export default labels;
