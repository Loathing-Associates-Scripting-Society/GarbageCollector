import { Quest } from "grimoire-kolmafia";
import { GarboTask } from "./engine";
import {
  $effect,
  $item,
  $items,
  $location,
  get,
  getActiveEffects,
  getModifier,
  have,
  maxBy,
  questStep,
  uneffect,
} from "libram";
import {
  abort,
  adv1,
  Effect,
  effectModifier,
  isShruggable,
  Item,
  mallPrice,
  myAdventures,
  myBuffedstat,
  retrieveItem,
  runChoice,
  Stat,
  use,
  visitUrl,
} from "kolmafia";
import { garboValue } from "../garboValue";
import { freeFightFamiliar } from "../familiar";
import { freeFightOutfit, meatTargetOutfit } from "../outfit";
import { GarboStrategy, Macro } from "../combat";
import { acquire } from "../acquire";
import { meatMood } from "../mood";
import { targetMeat } from "../lib";
import { copyTargetCount } from "../target";
import { potionSetup, VALUABLE_MODIFIERS } from "../potions";

function asEffect(thing: Item | Effect): Effect {
  return thing instanceof Effect ? thing : effectModifier(thing, "Effect");
}

function improvesStat(thing: Item | Effect, stat: Stat): boolean {
  const effect = asEffect(thing);
  return ([stat.toString(), `${stat.toString()} Percent`] as const).some(
    (modifier) => getModifier(modifier, effect) > 0,
  );
}

function improvedStats(thing: Item | Effect): Stat[] {
  return Stat.all().filter((stat) => improvesStat(thing, stat));
}
function improvesAStat(thing: Item | Effect): boolean {
  return improvedStats(thing).length > 0;
}

function isValuable(thing: Item | Effect): boolean {
  const effect = asEffect(thing);
  return VALUABLE_MODIFIERS.some(
    (modifier) => getModifier(modifier, effect) > 0,
  );
}

const debuffedEnough = () =>
  Stat.all().every((stat) => myBuffedstat(stat) <= 100);

function getBestDebuffItem(stat: Stat): Item {
  const itemBanList = $items`pill cup`;
  const debuffs = Item.all()
    .filter(
      (i) =>
        i.potion &&
        (i.tradeable || have(i)) &&
        !itemBanList.includes(i) &&
        !improvesAStat(i),
    )
    .map((item) => ({ item, effect: asEffect(item) }))
    .filter(
      ({ effect }) =>
        effect !== $effect.none &&
        !have(effect) &&
        getModifier(stat.toString(), effect) < 0,
    );

  return maxBy(
    debuffs,
    ({ item, effect }) =>
      mallPrice(item) / getModifier(stat.toString(), effect),
  ).item;
}

// Just checking for the gummi effects for now, maybe can check other stuff later?
function checkAndFixOvercapStats(): void {
  if (debuffedEnough()) return;

  for (const isShruggablePass of [true, false]) {
    for (const ef of getActiveEffects()) {
      // First check all shruggable buffs, then all unshruggable
      if (isShruggable(ef) !== isShruggablePass) continue;
      // Only shrug effects that buff at least one stat that's too high
      if (!improvedStats(ef).some((stat) => myBuffedstat(stat) > 100)) continue;
      // Don't shrug effects that give meat or other stuff
      if (isValuable(ef)) continue;

      uneffect(ef);

      if (debuffedEnough()) return;
    }
  }

  let debuffItemLoops = 0;
  while (!debuffedEnough()) {
    if (debuffItemLoops > 11) {
      abort("Spent too long trying to debuff for PirateRealm!");
    }

    debuffItemLoops++;
    for (const stat of Stat.all()) {
      if (myBuffedstat(stat) > 100) {
        const debuffPotion = getBestDebuffItem(stat);
        retrieveItem(debuffPotion);
        use(debuffPotion);
      }
    }
  }

  if (!debuffedEnough()) {
    abort(
      "Buffed stats are too high for PirateRealm! Check for equipment or buffs that we can add to prevent in the script",
    );
  }
}

function dessertIslandWorthIt(): boolean {
  // guesstimating value of giant crab at 3*VOA
  if (garboValue($item`cocoa of youth`) > 3 * get("valueOfAdventure")) {
    return true;
  }
  return false;
}

function crewRoleValue(crewmate: string): number {
  // Cuisinier is highest value if cocoa of youth is more meat than expected from giant crab
  if (dessertIslandWorthIt() && crewmate.includes("Cuisinier")) {
    return 50;
  }
  // Coxswain helps save turns if we run from storms
  if (crewmate.includes("Coxswain")) return 40;
  // Harquebusier gives us extra fun from combats
  if (crewmate.includes("Harquebusier")) return 30;
  // Crypto, Cuisinier (if cocoa not worth it), and Mixologist have small bonuses we care about less
  return 0;
}

function crewAdjectiveValue(crewmate: string): number {
  // Wide-Eyed give us bonus fun when counting birds in smooth sailing, and we'll mostly be doing that rather than spending limited grub/grog
  if (crewmate.includes("Wide-Eyed")) return 5;
  // Gluttonous can help when running out of grub, even though we usually shouldn't?
  if (crewmate.includes("Gluttonous")) return 4;
  // Beligerent, Dipsomaniacal, and Pinch-Fisted don't make much difference
  return 0;
}

function chooseCrew(): void {
  const bestChoice = maxBy([1, 2, 3], (choiceOption) => {
    const crewmatePref = `_pirateRealmCrewmate${choiceOption}`;
    const crewmate = get(crewmatePref);
    const roleValue = crewRoleValue(crewmate);
    const adjectiveValue = crewAdjectiveValue(crewmate);
    return roleValue + adjectiveValue;
  });
  runChoice(bestChoice);
}

function outfitBonuses() {
  const funPointValue = garboValue($item`PirateRealm guest pass`) / 600;
  return new Map([
    [
      $item`carnivorous potted plant`,
      get("valueOfAdventure") / (20 + get("_carnivorousPottedPlantWins")),
    ],
    [$item`Red Roger's red left foot`, funPointValue],
    [$item`PirateRealm party hat`, funPointValue],
  ]);
}

export const CockroachSetup: Quest<GarboTask> = {
  name: "Setup Cockroach Target",
  ready: () => get("pirateRealmUnlockedAnemometer"),
  completed: () =>
    get("_lastPirateRealmIsland") === $location`Trash Island` ||
    (questStep("_questPirateRealm") === 5 &&
      get("_lastPirateRealmIsland") === $location`Crab Island`),
  tasks: [
    // Tasks to progress pirate realm up to selecting Trash Island go here
    // We'll have to be careful about things like max stats becoming too high (bofa is annoying for this!)
    // To be optimal we would progress up until we're about to fight the giant giant crab, and then after buffing and fighting it, we then select trash island.
    // We might need some restructuring to do this nicely?
    {
      name: "Get PirateRealm Eyepatch",
      completed: () => have($item`PirateRealm eyepatch`),
      do: () => visitUrl("place.php?whichplace=realm_pirate&action=pr_port"),
      limit: { tries: 1 },
      spendsTurn: false,
    },
    {
      name: "Start PirateRealm Journey",
      ready: () => have($item`PirateRealm eyepatch`),
      completed: () => questStep("_questPirateRealm") > 0,
      prepare: (): void => {
        checkAndFixOvercapStats();
        if (myAdventures() < 40) {
          // do something?
        }
      },
      do: () => {
        visitUrl("place.php?whichplace=realm_pirate&action=pr_port");
        runChoice(1); // Head to Groggy's
        chooseCrew(); // Choose our crew
        runChoice(4); // Choose anemometer for trash island
        if (get("pirateRealmUnlockedClipper")) {
          runChoice(4); // Swift Clipper, if it's unlocked
        } else {
          runChoice(3); // Otherwise, Speedy Caravel
        }
        runChoice(1); // Head for the sea
      },
      outfit: { equip: $items`PirateRealm eyepatch` },
      limit: { tries: 1 },
      spendsTurn: false,
    },
    {
      name: "Choose First Island",
      ready: () => questStep("_questPirateRealm") === 1,
      completed: () => questStep("_questPirateRealm") > 1,
      prepare: () => checkAndFixOvercapStats(),
      do: () => adv1($location`Sailing the PirateRealm Seas`),
      outfit: () => freeFightOutfit({ acc3: $items`PirateRealm eyepatch` }),
      choices: () => ({
        1352:
          dessertIslandWorthIt() &&
          get("_pirateRealmCrewmate").includes("Cuisinier")
            ? 6
            : 1,
      }),
      limit: { tries: 1 },
      spendsTurn: false,
    },
    {
      name: "Sail to first Island",
      ready: () => questStep("_questPirateRealm") === 2,
      completed: () => questStep("_questPirateRealm") > 2,
      prepare: () => checkAndFixOvercapStats(),
      do: () => adv1($location`Sailing the PirateRealm Seas`),
      outfit: {
        equip: $items`PirateRealm eyepatch, PirateRealm party hat, Red Roger's red right foot`,
      },
      choices: () => ({
        1365: 1,
        1364: 2,
        1361: 1,
        1357: get("_pirateRealmGold") >= 50 ? 3 : 4,
        1360: 6, // Will need to add shop handling, perhaps to choice adventure script
        1356: 3,
        1362:
          get("_pirateRealmShipSpeed") - get("_pirateRealmSailingTurns") >= 2
            ? 2
            : 1,
        1363: 2,
        1359: 1, // Emergency grog adventure, choice one seems more consistent?
        1358: 1, // Emergency grub adventure, choice one seems more consistent?
        1367: 1, // Wrecked ship, this uses glue, need a pref for glue to make this not break if we don't have glue
      }),
      limit: { tries: 8 },
      spendsTurn: true,
    },
    {
      name: "Land Ho (First Island)",
      ready: () => questStep("_questPirateRealm") === 3,
      completed: () => questStep("_questPirateRealm") > 3,
      prepare: () => checkAndFixOvercapStats(),
      do: () => {
        // Should give us the Land-Ho adventure
        if (visitUrl("adventure.php?snarfblat=530").includes("Land Ho!")) {
          runChoice(1);
        } else {
          abort("Expected Land Ho! but didn't get it!");
        }
      },
      outfit: {
        equip: $items`PirateRealm eyepatch`,
      },
      limit: { tries: 1 },
      spendsTurn: false,
    },
    {
      name: "Standard Island Combats (Island 1)",
      ready: () => questStep("_questPirateRealm") === 4,
      completed: () => questStep("_questPirateRealm") > 4,
      prepare: () => {
        checkAndFixOvercapStats();
        if (
          mallPrice($item`windicle`) < 3 * get("valueOfAdventure") &&
          !get("_pirateRealmWindicleUsed")
        ) {
          acquire(1, $item`windicle`, 3 * get("valueOfAdventure"), true);
        }
      },
      do: () => adv1(get("_lastPirateRealmIsland", $location`none`)),
      outfit: () =>
        freeFightOutfit({
          equip: $items`PirateRealm eyepatch`,
          bonuses: outfitBonuses(),
          familiar: freeFightFamiliar({
            canChooseMacro: false,
            location: get("_lastPirateRealmIsland", $location`none`),
            allowAttackFamiliars: true,
            mode: "free",
          }),
          avoid: $items`Roman Candelabra`,
        }),
      combat: new GarboStrategy(() =>
        Macro.externalIf(
          mallPrice($item`windicle`) < 3 * get("valueOfAdventure") &&
            !get("_pirateRealmWindicleUsed") &&
            get("_pirateRealmIslandMonstersDefeated") <= 1,
          Macro.item($item`windicle`),
        ).basicCombat(),
      ),
      limit: { tries: 8 },
      spendsTurn: true,
    },
    {
      name: "Final Island Encounter (Island 1 (Dessert))",
      ready: () =>
        questStep("_questPirateRealm") === 5 &&
        get("_lastPirateRealmIsland") === $location`Dessert Island`,
      completed: () => questStep("_questPirateRealm") > 5,
      prepare: () => {
        checkAndFixOvercapStats();
      },
      do: () => {
        if (
          visitUrl("adventure.php?snarfblat=531").includes(
            "Chocolate Fountain of Youth",
          )
        ) {
          runChoice(1);
        } else {
          abort("Expected cocoa of youth but got something else!");
        }
      },
      outfit: () => {
        return {
          equip: $items`PirateRealm eyepatch`,
          avoid: $items`Roman Candelabra`,
        };
      },
      choices: { 1385: 1, 1368: 1 }, // Take cocoa of youth, fight crab
      combat: new GarboStrategy(() => Macro.delevel().meatKill()),
      limit: { tries: 1 },
      spendsTurn: true,
    },
    {
      name: "Choose Trash Island",
      ready: () => questStep("_questPirateRealm") === 6,
      completed: () => questStep("_questPirateRealm") > 6,
      prepare: () => checkAndFixOvercapStats(),
      do: () => adv1($location`Sailing the PirateRealm Seas`),
      outfit: { equip: $items`PirateRealm eyepatch` },
      choices: { 1353: 5 }, // Trash Island
      limit: { tries: 1 },
      spendsTurn: false,
    },
  ],
};

export const CockroachFinish: Quest<GarboTask> = {
  name: "Setup Cockroach Target",
  ready: () => get("pirateRealmUnlockedAnemometer"),
  completed: () => get("_lastPirateRealmIsland") === $location`Trash Island`,
  tasks: [
    {
      name: "Final Island Encounter (Island 1 (Giant Giant Crab))",
      ready: () =>
        questStep("_questPirateRealm") === 5 &&
        get("_lastPirateRealmIsland") === $location`Crab Island`,
      completed: () => questStep("_questPirateRealm") > 5,
      prepare: () => {
        meatMood(true, targetMeat()).execute(copyTargetCount());
        potionSetup(false);
        checkAndFixOvercapStats();
      },
      do: () => $location`Crab Island`,
      outfit: () => {
        const spec = meatTargetOutfit({
          modifier: ["meat"],
          equip: $items`PirateRealm eyepatch`,
          avoid: $items`Roman Candelabra`,
        });
        return spec;
      },
      choices: { 1385: 1, 1368: 1 }, // Take cocoa of youth, fight crab
      combat: new GarboStrategy(() => Macro.delevel().meatKill()),
      limit: { tries: 1 },
      spendsTurn: true,
    },
    {
      name: "Choose Trash Island",
      ready: () => questStep("_questPirateRealm") === 6,
      completed: () => questStep("_questPirateRealm") > 6,
      prepare: () => checkAndFixOvercapStats(),
      do: () => adv1($location`Sailing the PirateRealm Seas`),
      outfit: {
        equip: $items`PirateRealm eyepatch`,
        avoid: $items`Roman Candelabra`,
      },
      choices: { 1353: 5 }, // Trash Island
      limit: { tries: 1 },
      spendsTurn: false,
    },
  ],
};
