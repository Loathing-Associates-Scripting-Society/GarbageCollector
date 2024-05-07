import { $familiar, ChestMimic, get } from "libram";
import { globalOptions } from "../config";

export const mimicExperienceNeeded = () =>
  50 * (11 - get("_mimicEggsObtained")) + (globalOptions.ascend ? 0 : 550);

export function shouldChargeMimic(): boolean {
  /* If we can't make any more eggs tomorrow, don't charge the mimic more */
  return $familiar`Chest Mimic`.experience < mimicExperienceNeeded();
}

export function shouldMakeEgg(barf: boolean): boolean {
  const experienceNeeded =
    50 * (11 - get("_mimicEggsObtained")) + (barf ? 50 : 0);
  return (
    $familiar`Chest Mimic`.experience >= experienceNeeded &&
    get("_mimicEggsObtained") < 11
  );
}

export const minimumMimicExperience = () =>
  50 + (ChestMimic.differentiableQuantity(globalOptions.target) ? 0 : 100);
