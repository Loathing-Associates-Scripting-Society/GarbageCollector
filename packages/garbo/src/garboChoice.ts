import {
  availableChoiceOptions,
  ChoiceAdventureScript,
  runChoice,
} from "kolmafia";
import { highestPriorityOption } from "./resources/darts";

export const main: ChoiceAdventureScript = (choiceNumber: number) => {
  const options = availableChoiceOptions();
  switch (choiceNumber) {
    case 1525:
      return void runChoice(highestPriorityOption(options));
  }
};
