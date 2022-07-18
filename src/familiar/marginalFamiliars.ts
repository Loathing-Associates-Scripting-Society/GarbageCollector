import {
  equippedItem,
  Familiar,
  familiarWeight,
  inebrietyLimit,
  Item,
  myInebriety,
  numericModifier,
  print,
  Slot,
  useFamiliar,
  weightAdjustment,
} from "kolmafia";
import {
  $familiar,
  $item,
  $items,
  $slots,
  findLeprechaunMultiplier,
  get,
  getModifier,
  have,
  Requirement,
  sum,
} from "libram";
import { NumericModifier } from "libram/dist/modifierTypes";
import { bonusGear } from "../dropsgear";
import { estimatedTurns } from "../embezzler";
import { baseMeat, HIGHLIGHT } from "../lib";
import { meatOutfit } from "../outfit";
import { garboValue } from "../session";
import { getAllDrops } from "./dropFamiliars";
import { getExperienceFamiliarLimit } from "./experienceFamiliars";
import { menu } from "./freeFightFamiliar";
import { GeneralFamiliar, timeToMeatify } from "./lib";
import { meatFamiliar } from "./meatFamiliar";

type CachedOutfit = {
  weight: number;
  meat: number;
  item: number;
  bonus: number;
};

const outfitCache = new Map<number, CachedOutfit>();
const outfitSlots = $slots`hat, back, shirt, weapon, off-hand, pants, acc1, acc2, acc3, familiar`;

function getCachedOutfitValues(fam: Familiar) {
  const lepMult = findLeprechaunMultiplier(fam);
  const currentValue = outfitCache.get(lepMult);
  if (currentValue) return currentValue;

  useFamiliar(fam);
  meatOutfit(
    false,
    new Requirement([], {
      preventEquip: $items`Kramco Sausage-o-Matic™, cursed magnifying glass, protonic accelerator pack, "I Voted!" sticker`,
    })
  );

  const outfit = outfitSlots.map((slot) => equippedItem(slot));
  const bonuses = bonusGear("barf");

  const values = {
    weight: sum(outfit, (eq: Item) => getModifier("Familiar Weight", eq)),
    meat: sum(outfit, (eq: Item) => getModifier("Meat Drop", eq)),
    item: sum(outfit, (eq: Item) => getModifier("Item Drop", eq)),
    bonus: sum(outfit, (eq: Item) => bonuses.get(eq) ?? 0),
  };
  outfitCache.set(lepMult, values);
  return values;
}

type MarginalFamiliar = GeneralFamiliar & { outfitValue: number };

function calculateOutfitValue(f: GeneralFamiliar): MarginalFamiliar {
  const currentOutfitWeight = sum(outfitSlots, (slot: Slot) =>
    getModifier("Familiar Weight", equippedItem(slot))
  );
  const passiveWeight = weightAdjustment() - currentOutfitWeight;

  const familiarModifier = (familiar: Familiar, modifier: NumericModifier) => {
    const cachedOutfitWeight = getCachedOutfitValues(familiar).weight;

    const totalWeight = familiarWeight(familiar) + passiveWeight + cachedOutfitWeight;

    return numericModifier(familiar, modifier, totalWeight, $item`none`);
  };

  const outfit = getCachedOutfitValues(f.familiar);
  const outfitValue =
    outfit.bonus +
    ((outfit.meat + familiarModifier(f.familiar, "Meat Drop")) * baseMeat) / 100 +
    (outfit.item + familiarModifier(f.familiar, "Item Drop")) * 0.72;

  return { ...f, outfitValue };
}
export function barfFamiliar(): Familiar {
  if (timeToMeatify()) return $familiar`Grey Goose`;
  if (get("garboIgnoreMarginalFamiliars", false)) return meatFamiliar();

  const baseMenu = menu(false);

  if (have($familiar`Space Jellyfish`) && myInebriety() <= inebrietyLimit()) {
    baseMenu.push({
      familiar: $familiar`Space Jellyfish`,
      expectedValue:
        garboValue($item`stench jelly`) /
        (get("_spaceJellyfishDrops") < 5 ? get("_spaceJellyfishDrops") + 1 : 20),
      leprechaunMultiplier: 0,
      limit: "none",
    });
  }

  const fullMenu = baseMenu.map(calculateOutfitValue);

  const meatFamiliarEntry = fullMenu.find(({ familiar }) => familiar === meatFamiliar());

  if (!meatFamiliarEntry) throw new Error("Something went wrong when initializing familiars!");

  const viableMenu = fullMenu.filter(
    ({ expectedValue, outfitValue }) =>
      expectedValue + outfitValue > meatFamiliarEntry.expectedValue + meatFamiliarEntry.outfitValue
  );

  if (viableMenu.every(({ limit }) => limit !== "none")) {
    const turnsNeeded = sum(viableMenu, (option: MarginalFamiliar) =>
      turnsNeededForFamiliar(
        option,
        meatFamiliarEntry.expectedValue + meatFamiliarEntry.outfitValue
      )
    );

    if (turnsNeeded < estimatedTurns()) {
      return meatFamiliar();
    }
  }

  if (viableMenu.length === 0) meatFamiliar();

  const best = viableMenu.reduce((a, b) =>
    a.expectedValue + a.outfitValue > b.expectedValue + b.outfitValue ? a : b
  );

  print(
    HIGHLIGHT,
    `Choosing to use ${best.familiar} (expected value of ${
      best.expectedValue + best.outfitValue - meatFamiliarEntry.outfitValue
    }) over ${meatFamiliarEntry.familiar} (expected value of ${meatFamiliarEntry.expectedValue}).`
  );

  return best.familiar;
}

function turnsNeededForFamiliar(
  { familiar, limit, outfitValue }: MarginalFamiliar,
  baselineToCompareAgainst: number
): number {
  switch (limit) {
    case "drops":
      return sum(
        getAllDrops(familiar).filter(
          (x) => x.expectedValue + outfitValue > baselineToCompareAgainst
        ),
        ({ expectedTurns }) => expectedTurns
      );

    case "experience":
      return getExperienceFamiliarLimit(familiar);

    case "none":
      return 0;
  }
}
