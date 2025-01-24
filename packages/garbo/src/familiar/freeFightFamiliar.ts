import {
  Familiar,
  familiarWeight,
  inebrietyLimit,
  Location,
  myInebriety,
} from "kolmafia";
import {
  $familiar,
  $item,
  $location,
  clamp,
  findLeprechaunMultiplier,
  get,
  getModifier,
  have,
  Snapper,
} from "libram";
import { canOpenRedPresent } from ".";
import { garboValue } from "../garboValue";
import getConstantValueFamiliars from "./constantValueFamiliars";
import getDropFamiliars from "./dropFamiliars";
import getExperienceFamiliars from "./experienceFamiliars";
import { GeneralFamiliar, snapperValue, timeToMeatify } from "./lib";
import { meatFamiliar } from "./meatFamiliar";
import { gooseDroneEligible, valueDrops } from "../lib";
import { globalOptions } from "../config";
import { copyTargetCount } from "../target";

type MenuOptions = Partial<{
  canChooseMacro: boolean;
  location: Location;
  extraFamiliars: GeneralFamiliar[];
  excludeFamiliar: Familiar[];
  includeExperienceFamiliars: boolean;
  allowAttackFamiliars: boolean;
  mode: "barf" | "free" | "target";
}>;

export function menu(
  {
    canChooseMacro = true,
    location = $location`none`,
    extraFamiliars = [],
    excludeFamiliar = [],
    includeExperienceFamiliars = true,
    allowAttackFamiliars = true,
    mode = "free",
  } = {} as MenuOptions,
): GeneralFamiliar[] {
  const familiarMenu = [
    ...getConstantValueFamiliars(mode),
    ...getDropFamiliars(),
    ...(includeExperienceFamiliars ? getExperienceFamiliars(mode) : []),
    ...extraFamiliars,
  ];

  if (canChooseMacro && myInebriety() <= inebrietyLimit()) {
    if (timeToMeatify()) {
      familiarMenu.push({
        familiar: $familiar`Grey Goose`,
        expectedValue:
          (Math.max(familiarWeight($familiar`Grey Goose`) - 5), 0) ** 4,
        leprechaunMultiplier: 0,
        limit: "experience",
      });
    }

    if (
      mode === "target" &&
      gooseDroneEligible() &&
      get("gooseDronesRemaining") < copyTargetCount()
    ) {
      familiarMenu.push({
        familiar: $familiar`Grey Goose`,
        expectedValue:
          // It takes 9 experience to go from level 5 to 6 and emit a drone
          clamp(
            getModifier("Familiar Experience") / 9,
            0,
            // The limit to how valuable any emission can be is how many drones are actually gonna hit the copyTarget
            copyTargetCount() - get("gooseDronesRemaining"),
          ) * valueDrops(globalOptions.target),
        leprechaunMultiplier: 0,
        limit: "experience",
      });
    }

    if (mode === "target" && Snapper.have()) {
      familiarMenu.push({
        familiar: $familiar`Red-Nosed Snapper`,
        expectedValue: snapperValue(),
        leprechaunMultiplier: 0,
        limit: "special",
      });
    }

    if (canOpenRedPresent()) {
      familiarMenu.push({
        familiar: $familiar`Crimbo Shrub`,
        expectedValue: 2500,
        leprechaunMultiplier: 0,
        limit: "special",
      });
    }

    if (
      location.zone === "Dinseylandfill" &&
      have($familiar`Space Jellyfish`)
    ) {
      familiarMenu.push({
        familiar: $familiar`Space Jellyfish`,
        expectedValue:
          garboValue($item`stench jelly`) /
          (get("_spaceJellyfishDrops") < 5
            ? get("_spaceJellyfishDrops") + 1
            : 20),
        leprechaunMultiplier: 0,
        limit: "special",
      });
    }
  }

  const meatFam = meatFamiliar();

  if (!familiarMenu.some(({ familiar }) => familiar === meatFam)) {
    familiarMenu.push({
      familiar: meatFam,
      expectedValue: 0,
      leprechaunMultiplier: findLeprechaunMultiplier(meatFam),
      limit: "none",
    });
  }

  return familiarMenu.filter(
    ({ familiar }) =>
      (allowAttackFamiliars ||
        !(familiar.physicalDamage || familiar.elementalDamage)) &&
      !excludeFamiliar.some(
        (excludedFamiliar) => excludedFamiliar === familiar,
      ),
  );
}

export function getAllJellyfishDrops(): {
  expectedValue: number;
  turnsAtValue: number;
}[] {
  if (!have($familiar`Space Jellyfish`)) {
    return [{ expectedValue: 0, turnsAtValue: 0 }];
  }

  const current = get("_spaceJellyfishDrops");
  const returnValue = [];

  for (
    let dropNumber = clamp(current + 1, 0, 6);
    dropNumber <= 6;
    dropNumber++
  ) {
    returnValue.push({
      expectedValue:
        garboValue($item`stench jelly`) / (dropNumber > 5 ? 20 : dropNumber),
      turnsAtValue: dropNumber > 5 ? Infinity : dropNumber,
    });
  }

  return returnValue;
}

export function freeFightFamiliarData(
  options: Partial<MenuOptions> = {},
): GeneralFamiliar {
  const compareFamiliars = (a: GeneralFamiliar, b: GeneralFamiliar) => {
    if (a === null) return b;
    if (a.expectedValue === b.expectedValue) {
      return a.leprechaunMultiplier > b.leprechaunMultiplier ? a : b;
    }
    return a.expectedValue > b.expectedValue ? a : b;
  };

  return menu(options).reduce(compareFamiliars, {
    familiar: $familiar.none,
    expectedValue: 0,
    leprechaunMultiplier: 0,
    limit: "none",
  });
}

export function freeFightFamiliar(options: MenuOptions = {}): Familiar {
  return freeFightFamiliarData(options).familiar;
}
