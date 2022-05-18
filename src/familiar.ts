import {
  Familiar,
  familiarWeight,
  haveEffect,
  inebrietyLimit,
  Item,
  myAdventures,
  myFamiliar,
  myInebriety,
  totalTurnsPlayed,
  weightAdjustment,
} from "kolmafia";
import {
  $effect,
  $familiar,
  $familiars,
  $item,
  $items,
  findFairyMultiplier,
  findLeprechaunMultiplier,
  get,
  have,
  propertyTypes,
} from "libram";
import { argmax, globalOptions } from "./lib";
import { garboAverageValue, garboValue } from "./session";

let _meatFamiliar: Familiar;
export function meatFamiliar(): Familiar {
  if (!_meatFamiliar) {
    if (
      myInebriety() > inebrietyLimit() &&
      have($familiar`Trick-or-Treating Tot`) &&
      have($item`li'l pirate costume`)
    ) {
      _meatFamiliar = $familiar`Trick-or-Treating Tot`;
    } else if (have($familiar`Robortender`)) {
      _meatFamiliar = $familiar`Robortender`;
    } else {
      const bestLeps = Familiar.all()
        // The commerce ghost canot go underwater in most circumstances, and cannot use an amulet coin
        // We absolutely do not want that
        .filter((fam) => have(fam) && fam !== $familiar`Ghost of Crimbo Commerce`)
        .sort((a, b) => findLeprechaunMultiplier(b) - findLeprechaunMultiplier(a));
      const bestLepMult = findLeprechaunMultiplier(bestLeps[0]);
      _meatFamiliar = bestLeps
        .filter((familiar) => findLeprechaunMultiplier(familiar) === bestLepMult)
        .sort((a, b) => findFairyMultiplier(b) - findFairyMultiplier(a))[0];
    }
  }
  return _meatFamiliar;
}

function myFamiliarWeight(familiar: Familiar | null = null) {
  if (familiar === null) familiar = myFamiliar();
  return familiarWeight(familiar) + weightAdjustment();
}

// 5, 10, 15, 20, 25 +5/turn: 5.29, 4.52, 3.91, 3.42, 3.03
const rotatingFamiliars: {
  [index: string]: { expected: number[]; drop: Item; pref: propertyTypes.NumericProperty };
} = {
  "Fist Turkey": {
    expected: [3.91, 4.52, 4.52, 5.29, 5.29],
    drop: $item`Ambitious Turkey`,
    pref: "_turkeyBooze",
  },
  "Llama Lama": {
    expected: [3.42, 3.91, 4.52, 5.29, 5.29],
    drop: $item`llama lama gong`,
    pref: "_gongDrops",
  },
  "Astral Badger": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`astral mushroom`,
    pref: "_astralDrops",
  },
  "Li'l Xenomorph": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`transporter transponder`,
    pref: "_transponderDrops",
  },
  "Rogue Program": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`Game Grid token`,
    pref: "_tokenDrops",
  },
  "Bloovian Groose": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`groose grease`,
    pref: "_grooseDrops",
  },
  "Baby Sandworm": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`agua de vida`,
    pref: "_aguaDrops",
  },
  "Green Pixie": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`tiny bottle of absinthe`,
    pref: "_absintheDrops",
  },
  "Blavious Kloop": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`devilish folio`,
    pref: "_kloopDrops",
  },
  "Galloping Grill": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`hot ashes`,
    pref: "_hotAshesDrops",
  },
  "Grim Brother": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`grim fairy tale`,
    pref: "_grimFairyTaleDrops",
  },
  "Golden Monkey": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`powdered gold`,
    pref: "_powderedGoldDrops",
  },
  "Unconscious Collective": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`Unconscious Collective Dream Jar`,
    pref: "_dreamJarDrops",
  },
  "Ms. Puck Man": {
    expected: Array($familiar`Ms. Puck Man`.dropsLimit).fill(12.85),
    drop: $item`power pill`,
    pref: "_powerPillDrops",
  },
  "Puck Man": {
    expected: Array($familiar`Puck Man`.dropsLimit).fill(12.85),
    drop: $item`power pill`,
    pref: "_powerPillDrops",
  },
  "Adventurous Spelunker": {
    expected: [7.0],
    drop: $item`Tales of Spelunking`,
    pref: "_spelunkingTalesDrops",
  },
  "Angry Jung Man": {
    expected: [30.0],
    drop: $item`psychoanalytic jar`,
    pref: "_jungDrops",
  },
  "Grimstone Golem": {
    expected: [45.0],
    drop: $item`grimstone mask`,
    pref: "_grimstoneMaskDrops",
  },
};

let savedMimicDropValue: number | null = null;
function mimicDropValue() {
  return (
    savedMimicDropValue ??
    (savedMimicDropValue =
      garboAverageValue(...$items`Polka Pop, BitterSweetTarts, Piddles`) / (6.29 * 0.95 + 1 * 0.05))
  );
}

const gooseExp =
  $familiar`Grey Goose`.experience || (have($familiar`Shorter-Order Cook`) ? 100 : 0);

export function freeFightFamiliar(canMeatify = false): Familiar {
  if (canMeatify && timeToMeatify()) return $familiar`Grey Goose`;
  const familiarValue: [Familiar, number][] = [];

  if (
    have($familiar`Pocket Professor`) &&
    $familiar`Pocket Professor`.experience < 400 &&
    !get("_thesisDelivered")
  ) {
    // Estimate based on value to charge thesis.
    familiarValue.push([$familiar`Pocket Professor`, 3000]);
  }

  if (
    have($familiar`Grey Goose`) &&
    $familiar`Grey Goose`.experience < 400 &&
    !get("_meatifyMatterUsed") &&
    myInebriety() <= inebrietyLimit()
  ) {
    const experienceNeeded = 400 - (globalOptions.ascending ? gooseExp : 25);
    const meatFromCast = 15 ** 4;
    const estimatedExperience = 12;
    familiarValue.push([
      $familiar`Grey Goose`,
      meatFromCast / (experienceNeeded / estimatedExperience),
    ]);
  }
  for (const familiarName of Object.keys(rotatingFamiliars)) {
    const familiar: Familiar = Familiar.get(familiarName);
    if (have(familiar)) {
      const { expected, drop, pref } = rotatingFamiliars[familiarName];
      const dropsAlready = get(pref);
      if (dropsAlready >= expected.length) continue;
      const value = garboValue(drop) / expected[dropsAlready];
      familiarValue.push([familiar, value]);
    }
  }

  if (have($familiar`Stocking Mimic`)) {
    const mimicWeight = myFamiliarWeight($familiar`Stocking Mimic`);
    const actionPercentage = 1 / 3 + (haveEffect($effect`Jingle Jangle Jingle`) ? 0.1 : 0);
    const mimicValue = mimicDropValue() + ((mimicWeight * actionPercentage * 1) / 4) * 10 * 4 * 1.2;
    familiarValue.push([$familiar`Stocking Mimic`, mimicValue]);
  }

  if (have($familiar`Robortender`)) familiarValue.push([$familiar`Robortender`, 200]);

  for (const familiar of $familiars`Hobo Monkey, Cat Burglar, Urchin Urchin, Leprechaun`) {
    if (have(familiar)) familiarValue.push([familiar, 1]);
  }

  familiarValue.push([$familiar`none`, 0]);

  return argmax(familiarValue);
}

export function pocketProfessorLectures(): number {
  return 2 + Math.ceil(Math.sqrt(familiarWeight($familiar`Pocket Professor`) + weightAdjustment()));
}

export function timeToMeatify(): boolean {
  if (
    !have($familiar`Grey Goose`) ||
    get("_meatifyMatterUsed") ||
    myInebriety() > inebrietyLimit()
  ) {
    return false;
  } else if ($familiar`Grey Goose`.experience >= 400) return true;
  else if (!globalOptions.ascending || myAdventures() > 50) return false;

  // Check Wanderers
  const totalTurns = totalTurnsPlayed();
  const baseMeat = have($item`SongBoom™ BoomBox`) ? 275 : 250;
  const usingLatte =
    have($item`latte lovers member's mug`) &&
    get("latteModifier").split(",").includes("Meat Drop: 40");

  const nextProtonicGhost = have($item`protonic accelerator pack`)
    ? Math.max(1, get("nextParanormalActivity") - totalTurns)
    : Infinity;
  const nextVoteMonster =
    have($item`"I Voted!" sticker`) && get("_voteFreeFights") < 3
      ? Math.max(0, ((totalTurns % 11) - 1) % 11)
      : Infinity;
  const nextVoidMonster =
    have($item`cursed magnifying glass`) &&
    get("_voidFreeFights") < 5 &&
    get("valueOfFreeFight", 2000) / 13 > baseMeat * (usingLatte ? 0.75 : 0.6)
      ? -get("cursedMagnifyingGlassCount") % 13
      : Infinity;

  // If any of the above are 0, then
  // (1) We should be fighting a free fight
  // (2) We meatify if Grey Goose is sufficiently heavy and we don't have another free wanderer in our remaining turns

  const freeFightNow =
    get("questPAGhost") !== "unstarted" || nextVoteMonster === 0 || nextVoidMonster === 0;
  const delay = [
    nextProtonicGhost,
    nextVoteMonster === 0 ? (get("_voteFreeFights") < 2 ? 11 : Infinity) : nextVoteMonster,
    nextVoidMonster === 0 ? 13 : nextVoidMonster,
  ].reduce((a, b) => (a < b ? a : b));

  if (delay < myAdventures()) return false;
  // We can wait for the next free fight
  else if (freeFightNow || $familiar`Grey Goose`.experience >= 121) return true;

  return false;
}
