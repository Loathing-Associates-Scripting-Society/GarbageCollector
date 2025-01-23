import {
  adv1,
  booleanModifier,
  canEquip,
  Location,
  myLocation,
  use,
} from "kolmafia";
import {
  $effect,
  $familiar,
  $item,
  $location,
  CrystalBall,
  get,
  have,
  questStep,
  withChoice,
  withChoices,
} from "libram";
import { DraggableFight } from "garbo-lib";
import { OutfitSpec } from "grimoire-kolmafia";

import { waterBreathingEquipment } from "../outfit";
import { Macro } from "../combat";
import { globalOptions } from "../config";

/**
 * Configure the behavior of the fights in use in different parts of the fight engine
 * @interface TargetFightConfigOptions
 * @member {OutfitSpec} spec maximizer requirements to use for this fight (defaults to empty)
 * @member {draggableFight?} draggable if this fight can be pulled into another zone and what kind of draggable it is (defaults to undefined)
 * @member {boolean?} canInitializeWandererCounters if this fight can be used to initialize wanderers (defaults to false)
 * @member {boolean?} gregariousReplace if this is a "monster replacement" fight - pulls another monster from the CSV (defautls to false)
 * @member {boolean?} wrongEncounterName if mafia does not update the lastEncounter properly when doing this fight (defaults to value of gregariousReplace)
 */
export interface TargetFightConfigOptions {
  spec?: OutfitSpec;
  draggable?: DraggableFight;
  canInitializeWandererCounters?: boolean;
  wrongEncounterName?: boolean;
  gregariousReplace?: boolean;
  location?: Location;
}

export interface RunOptions {
  macro: Macro;
  location: Location;
  useAuto: boolean;
  action: string;
}

export function checkUnderwater(): boolean {
  // first check to see if underwater even makes sense
  if (
    questStep("questS01OldGuy") >= 0 &&
    !(get("_envyfishEggUsed") || have($item`envyfish egg`)) &&
    (get("_garbo_weightChain", false) || !have($familiar`Pocket Professor`)) &&
    (booleanModifier("Adventure Underwater") ||
      waterBreathingEquipment.some((item) => have(item) && canEquip(item))) &&
    (have($effect`Fishy`) ||
      (have($item`fishy pipe`) && !get("_fishyPipeUsed")))
  ) {
    if (!have($effect`Fishy`) && !get("_fishyPipeUsed")) use($item`fishy pipe`);

    return have($effect`Fishy`);
  }

  return false;
}

type ChangeLastAdvLocationMethod = "hiddencity" | "dailydungeon";
export function getChangeLastAdvLocationMethod(): ChangeLastAdvLocationMethod {
  if (questStep("questL11Worship") > 3) {
    return "hiddencity";
  } else {
    return "dailydungeon";
  }
}

// for now, return a psuedo task since target fights are not grimoirized
export function changeLastAdvLocationTask(): {
  ready: () => boolean;
  completed: () => boolean;
  do: () => void;
} {
  const base = {
    ready: () =>
      CrystalBall.ponder().get($location`The Dire Warren`) !==
      globalOptions.target,
    completed: () => myLocation() !== $location`The Dire Warren`,
  };
  switch (getChangeLastAdvLocationMethod()) {
    case "hiddencity":
      return {
        ...base,
        do: () =>
          withChoice(785, 6, () =>
            adv1($location`An Overgrown Shrine (Northeast)`, -1, ""),
          ),
      };
    case "dailydungeon":
      return {
        ...base,
        do: () =>
          // at this point, we're either at an NC we can walk away from or the whole DD is done
          // only track the choices we need to walk away since hitting it when it is done does nothing
          withChoices({ 692: 8, 693: 3 }, () =>
            adv1($location`The Daily Dungeon`, -1, ""),
          ),
      };
  }
}

export function puttyLeft(): number {
  const havePutty = have($item`Spooky Putty sheet`);
  const havePuttyMonster = have($item`Spooky Putty monster`);
  const haveRainDoh = have($item`Rain-Doh black box`);
  const haveRainDohMonster = have($item`Rain-Doh box full of monster`);

  const puttyUsed = get("spookyPuttyCopiesMade");
  const rainDohUsed = get("_raindohCopiesMade");
  const hardLimit = 6 - puttyUsed - rainDohUsed;
  let monsterCount = 0;
  let puttyLeft = 5 - puttyUsed;
  let rainDohLeft = 5 - rainDohUsed;

  if (!havePutty && !havePuttyMonster) {
    puttyLeft = 0;
  }
  if (!haveRainDoh && !haveRainDohMonster) {
    rainDohLeft = 0;
  }

  if (havePuttyMonster) {
    if (get("spookyPuttyMonster") === globalOptions.target) {
      monsterCount++;
    } else {
      puttyLeft = 0;
    }
  }
  if (haveRainDohMonster) {
    if (get("rainDohMonster") === globalOptions.target) {
      monsterCount++;
    } else {
      rainDohLeft = 0;
    }
  }
  const naiveLimit = Math.min(puttyLeft + rainDohLeft, hardLimit);
  return naiveLimit + monsterCount;
}
