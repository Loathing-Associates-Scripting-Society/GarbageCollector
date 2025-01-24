import { OutfitSpec, Quest } from "grimoire-kolmafia";
import {
  cliExecute,
  getCampground,
  mallPrice,
  myClass,
  myMaxmp,
  myThrall,
  restoreMp,
  use,
  useSkill,
} from "kolmafia";
import {
  $class,
  $item,
  $location,
  $skill,
  $thrall,
  get,
  have,
  maxBy,
} from "libram";
import { baseMeat, setChoice } from "../lib";
import { estimatedGarboTurns } from "../turns";
import { GarboTask } from "./engine";
import { globalOptions } from "../config";
import { garboAdventure, Macro } from "../combat";

function bestVykeaLevel(): number {
  const vykeas = [
    { level: 1, dowelCost: 0 },
    { level: 2, dowelCost: 1 },
    { level: 3, dowelCost: 11 },
  ]; // excluding 4 and 5 as per bean's suggestion
  const vykeaProfit = (vykea: { level: number; dowelCost: number }) => {
    const { level, dowelCost } = vykea;
    return (
      estimatedGarboTurns() * baseMeat() * 0.1 * level -
      (5 * mallPrice($item`VYKEA rail`) +
        dowelCost * mallPrice($item`VYKEA dowel`) +
        5 * mallPrice($item`VYKEA plank`) +
        1 * mallPrice($item`VYKEA instructions`))
    );
  };

  if (vykeas.some((vykea) => vykeaProfit(vykea) > 0)) {
    return maxBy(vykeas, vykeaProfit).level;
  }
  return 0;
}

const PostFreeFightTasks: GarboTask[] = [
  {
    name: "Configure Vykea",
    ready: () => get("_VYKEACompanionLevel") === 0 && bestVykeaLevel() > 0,
    completed: () => get("_VYKEACompanionLevel") > 0,
    do: () => cliExecute(`create level ${bestVykeaLevel()} couch`),
    acquire: [{ item: $item`VYKEA hex key` }],
    spendsTurn: false,
  },
  {
    name: "Configure Thrall",
    ready: () =>
      myClass() === $class`Pastamancer` && have($skill`Bind Lasagmbie`),
    completed: () => myThrall() === $thrall`Lasagmbie`,
    do: () => useSkill($skill`Bind Lasagmbie`),
    outfit: (): OutfitSpec => {
      if (myMaxmp() >= 200) return {};
      return { modifier: "MP" };
    },
    prepare: () => restoreMp(200),
    spendsTurn: false,
  },
  {
    name: "Level Up Thrall",
    ready: () =>
      myClass() === $class`Pastamancer` &&
      have($item`experimental carbon fiber pasta additive`) &&
      myThrall() !== $thrall.none,
    completed: () => get("_pastaAdditive") || myThrall().level >= 10,
    do: () => use($item`experimental carbon fiber pasta additive`),
    spendsTurn: false,
  },
  {
    name: "Tend Mushroom Garden",
    ready: () =>
      (have($item`packet of mushroom spores`) ||
        getCampground()["packet of mushroom spores"] !== undefined) &&
      get("_mushroomGardenFights") > 0,
    completed: () => get("_mushroomGardenVisited") === true,
    do: () => {
      if (have($item`packet of mushroom spores`)) {
        use($item`packet of mushroom spores`);
      }
      setChoice(
        1410,
        globalOptions.ascend || get("mushroomGardenCropLevel") >= 11 ? 2 : 1,
      );
      garboAdventure($location`Your Mushroom Garden`, Macro.basicCombat());
      if (have($item`packet of tall grass seeds`)) {
        use($item`packet of tall grass seeds`);
      }
    },
    spendsTurn: false,
  },
];

export const PostFreeFightQuest: Quest<GarboTask> = {
  name: "Post Free Fight",
  tasks: PostFreeFightTasks,
};
