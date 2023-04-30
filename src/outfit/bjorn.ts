import { Familiar, Item } from "kolmafia";
import { CrownOfThrones, findFairyMultiplier, findLeprechaunMultiplier, sum } from "libram";
import { garboValue } from "../session";
import { BonusEquipMode, useLimitedDrops, valueOfItem, valueOfMeat } from "./lib";

export function valueBjornModifiers(
  mode: BonusEquipMode,
  familiar: Familiar
): (ridingFamiliar: Familiar) => number {
  const meatValue = valueOfMeat(mode);
  const leprechaunMultiplier = findLeprechaunMultiplier(familiar);
  const leprechaunCoefficient =
    meatValue * (2 * leprechaunMultiplier + Math.sqrt(leprechaunMultiplier));

  const itemValue = valueOfItem(mode);
  const fairyMultiplier = findFairyMultiplier(familiar);
  const fairyCoefficient = itemValue * (fairyMultiplier + Math.sqrt(fairyMultiplier) / 2);

  return CrownOfThrones.createModifierValueFunction(["Familiar Weight", "Meat Drop", "Item Drop"], {
    "Familiar Weight": (mod) => mod * (fairyCoefficient + leprechaunCoefficient),
    "Item Drop": (mod) => mod * itemValue,
    "Meat Drop": (mod) => mod * meatValue,
  });
}

function dropsValueFunction(drops: Item[] | Map<Item, number>): number {
  return Array.isArray(drops)
    ? sum(drops, garboValue)
    : sum([...drops.entries()], ([item, quantity]) => quantity * garboValue(item));
}

export function chooseBjorn(
  mode: BonusEquipMode,
  familiar: Familiar,
  sim = false
): CrownOfThrones.FamiliarRider {
  const leprechaunMultiplier = findLeprechaunMultiplier(familiar);
  const fairyMultiplier = findFairyMultiplier(familiar);
  const ignoreLimitedDrops = sim || !useLimitedDrops(mode);

  const key = `Leprechaun:${leprechaunMultiplier.toFixed(2)};Fairy:${fairyMultiplier.toFixed(
    2
  )};ignoreLimitedDrops:${ignoreLimitedDrops}`;

  if (!CrownOfThrones.hasRiderMode(key)) {
    CrownOfThrones.createRiderMode(key, {
      ignoreLimitedDrops,
      modifierValueFunction: valueBjornModifiers(mode, familiar),
      dropsValueFunction,
    });
  }

  const result = CrownOfThrones.pickRider(key);

  if (!result) throw new Error(`Unable to choose rider for key ${key}`);

  return result;
}
