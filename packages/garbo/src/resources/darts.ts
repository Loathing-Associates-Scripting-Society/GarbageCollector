import { $effect, $item, get, have, maxBy } from "libram";

export const guaranteedBullseye = () =>
  get("everfullDartPerks").includes("25% Better bullseye targeting") &&
  get("everfullDartPerks").includes("25% More Accurate bullseye targeting") &&
  get("everfullDartPerks").includes("25% better chance to hit bullseyes");

export const safeToAttemptBullseye = () =>
  have($item`Everfull Dart Holster`) &&
  (guaranteedBullseye() || have($item`spring shoes`)) &&
  !dartLevelTooHigh();

export const canBullseye = () =>
  !have($effect`Everything Looks Red`) &&
  (guaranteedBullseye() || !have($effect`Everything Looks Green`));

export const DARTS_KILL_BEFORE_RUN = 5;

const dartLevelTooHigh = () =>
  get("everfullDartPerks").split(",").length >= DARTS_KILL_BEFORE_RUN;

export const DART_PERKS: string[] = [
  "Bullseyes do not impress you much",
  "You are less impressed by bullseyes",
  "25% better chance to hit bullseyes",
  "25% More Accurate bullseye targeting",
  "25% Better bullseye targeting",
  "Extra stats from stats targets",
  "Expand your dart capacity by 1",
  "Throw a second dart quickly",
  "Butt awareness",
  "Increase Dart Deleveling from deleveling targets",
  "Add Hot Damage",
  "Add Cold Damage",
  "Add Sleaze Damage",
  "Add Spooky Damage",
  "Add Stench Damage",
  "Deal 25-50% more damage",
  "Deal 25-50% extra damage",
  "Deal 25-50% greater damage",
];

export function highestPriorityOption(options: { [key: number]: string }) {
  return Number(
    maxBy(
      Object.entries(options),
      ([text]) =>
        DART_PERKS.includes(text) ? DART_PERKS.indexOf(text) : Infinity,
      true,
    )[0],
  );
}
