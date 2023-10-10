import {
  fullnessLimit,
  inebrietyLimit,
  myAdventures,
  myFullness,
  myInebriety,
  myTurncount,
} from "kolmafia";
import { $familiar, $item, clamp, get, have } from "libram";
import { globalOptions } from "./config";
// Dumb circular import stuff
import { usingThumbRing } from "./outfit/dropsgearAccessories";
import { embezzlerCount } from "./embezzler";
import {
  digitizedMonstersRemainingForTurns,
  ESTIMATED_OVERDRUNK_TURNS,
  howManySausagesCouldIEat,
} from "./lib";

/**
 * Computes the estimated number of turns during which garbo will run
 * @returns A guess of how many runs garbo will run in total
 */
export function estimatedGarboTurns(): number {
  // Assume roughly 2 fullness from pantsgiving and 8 adventures/fullness.
  const pantsgivingAdventures = have($item`Pantsgiving`)
    ? Math.max(0, 2 - get("_pantsgivingFullness")) * 8
    : 0;
  const sausageAdventures = howManySausagesCouldIEat();
  const thesisAdventures = have($familiar`Pocket Professor`) && !get("_thesisDelivered") ? 11 : 0;
  const nightcapAdventures =
    globalOptions.ascend && myInebriety() <= inebrietyLimit() && have($item`Drunkula's wineglass`)
      ? ESTIMATED_OVERDRUNK_TURNS
      : 0;
  const thumbRingMultiplier = usingThumbRing() ? 1 / 0.96 : 1;

  let turns;
  if (globalOptions.stopTurncount) turns = globalOptions.stopTurncount - myTurncount();
  else if (globalOptions.nobarf) turns = embezzlerCount();
  else if (globalOptions.saveTurns > 0 || !globalOptions.ascend) {
    turns =
      (myAdventures() +
        sausageAdventures +
        pantsgivingAdventures +
        thesisAdventures -
        globalOptions.saveTurns) *
      thumbRingMultiplier;
  } else {
    turns =
      (myAdventures() +
        sausageAdventures +
        pantsgivingAdventures +
        nightcapAdventures +
        thesisAdventures) *
      thumbRingMultiplier;
  }

  return turns;
}

/**
 * Computes the estimated number of turns left that the user will use outside garbo
 * @returns A guess of how many turns will be used outside garbo
 */
export function remainingUserTurns(): number {
  const dietAdventures = Math.max(
    potentialFullnessAdventures() + potentialInebrietyAdventures() + potentialNonOrganAdventures(),
    0,
  );
  const turns = myAdventures() + dietAdventures - estimatedGarboTurns() + globalOptions.saveTurns;
  return turns;
}

export const estimatedTurnsTomorrow = 400 + clamp((get("valueOfAdventure") - 4000) / 8, 0, 600);

function potentialFullnessAdventures(): number {
  const distentionPillSpace = have($item`distention pill`) && !get("_distentionPillUsed") ? 1 : 0;

  return (fullnessLimit() - myFullness() + distentionPillSpace) * 8;
}

function potentialInebrietyAdventures(): number {
  const syntheticPillSpace =
    have($item`synthetic dog hair pill`) && !get("_syntheticDogHairPillUsed") ? 1 : 0;
  const shotglassSpace = have($item`mime army shotglass`) && !get("_mimeArmyShotglassUsed") ? 1 : 0;
  const sweatSpace = have($item`designer sweatpants`) ? 3 - get("_sweatOutSomeBoozeUsed") : 0;

  return (inebrietyLimit() - myInebriety() + syntheticPillSpace + sweatSpace + shotglassSpace) * 7;
}

function potentialNonOrganAdventures(): number {
  const borrowedTimeAdventures = globalOptions.ascend && !get("_borrowedTimeUsed") ? 20 : 0;
  const chocolateAdventures = ((3 - get("_chocolatesUsed")) * (4 - get("_chocolatesUsed"))) / 2;
  const bufferAdventures = 30; // We don't know if garbo would decide to use melange/voraci tea/sweet tooth to get more adventures

  return borrowedTimeAdventures + chocolateAdventures + bufferAdventures;
}

export function digitizedMonstersRemaining() {
  return digitizedMonstersRemainingForTurns(estimatedGarboTurns());
}
