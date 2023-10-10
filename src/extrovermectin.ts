import {
  canEquip,
  cliExecute,
  equip,
  haveEffect,
  Item,
  itemType,
  mallPrice,
  myFury,
  Phylum,
  retrieveItem,
  retrievePrice,
  Skill,
  toPhylum,
  toSkill,
  useFamiliar,
  useSkill,
  visitUrl,
  weaponHands,
} from "kolmafia";
import {
  $effect,
  $item,
  $items,
  $location,
  $monster,
  $skill,
  $slot,
  clamp,
  CrystalBall,
  get,
  getBanishedMonsters,
  have,
  maxBy,
  property,
  Requirement,
  set,
  tryFindFreeRun,
} from "libram";
import { freeFightFamiliar } from "./familiar";
import {
  freeRunConstraints,
  getUsingFreeBunnyBanish,
  ltbRun,
  setChoice,
  userConfirmDialog,
} from "./lib";
import { garboAdventure, Macro } from "./combat";
import { acquire } from "./acquire";

const embezzler = $monster`Knob Goblin Embezzler`;
const crate = $monster`crate`;

type GregSource = {
  copies: number;
  skillSource: "habitat" | "extro";
  replaces: number;
  extra: number;
};

export function expectedGregs(skillSource: "habitat" | "extro"): number[] {
  const habitatCharges = have($skill`Just the Facts`) ? 3 - get("_monsterHabitatsRecalled", 0) : 0;

  const habitatGregs: GregSource[] = new Array(habitatCharges).fill({
    copies: 5,
    skillSource: "habitat",
    replaces: 0,
    extra: 0,
  });

  const extroGregs = new Array(50).fill({
    copies: 3,
    skillSource: "extro",
    replaces: 0,
    extra: 0,
  });

  const baseGregs: GregSource[] = [...habitatGregs, ...extroGregs];

  const replacementsPerGreg = (source: GregSource) =>
    have($skill`Transcendent Olfaction`)
      ? Math.floor((source.copies * 7) / 3)
      : Math.floor((source.copies * 5) / 3);

  const timeSpunGregs = have($item`Time-Spinner`)
    ? Math.floor((10 - get("_timeSpinnerMinutesUsed")) / 3)
    : 0;

  const orbGregs = have($item`miniature crystal ball`) ? 1 : 0;

  const macrometeors = have($skill`Meteor Lore`) ? 10 - get("_macrometeoriteUses") : 0;
  const replaceEnemies = have($item`Powerful Glove`)
    ? Math.floor((100 - get("_powerfulGloveBatteryPowerUsed")) / 10)
    : 0;

  const firstReplaces = clamp(replacementsPerGreg(baseGregs[0]), 0, macrometeors + replaceEnemies);
  const initialCast: { replacesLeft: number; sources: GregSource[] } = {
    replacesLeft: macrometeors + replaceEnemies - firstReplaces,
    sources: [
      {
        ...baseGregs[0],
        replaces: firstReplaces,
        extra: timeSpunGregs + orbGregs,
      },
    ],
  };

  return baseGregs
    .slice(1)
    .reduce((acc, curr): { replacesLeft: number; sources: GregSource[] } => {
      const currentReplaces = clamp(replacementsPerGreg(curr), 0, acc.replacesLeft);
      return {
        replacesLeft: acc.replacesLeft - currentReplaces,
        sources: [
          ...acc.sources,
          {
            ...curr,
            replaces: currentReplaces,
            extra: orbGregs,
          },
        ],
      };
    }, initialCast)
    .sources.filter((source) => source.skillSource === skillSource)
    .map((source) => source.copies + source.replaces + source.extra);
}

export function doingGregFight(): boolean {
  const extrovermectin = get("beGregariousCharges") > 0 || get("beGregariousFightsLeft") > 0;
  const habitat =
    have($skill`Just the Facts`) &&
    (get("_monsterHabitatsRecalled") < 3 || get("_monsterHabitatsFightsLeft") > 0);

  return extrovermectin || habitat;
}

export function crateStrategy(): "Sniff" | "Saber" | "Orb" | null {
  if (!doingGregFight()) return null;
  if (
    (have($skill`Transcendent Olfaction`) &&
      (property.getString("olfactedMonster") === "crate" || get("_olfactionsUsed") < 2)) ||
    (have($skill`Long Con`) && (get("longConMonster") === crate || get("_longConUsed") < 4))
  ) {
    return "Sniff";
  }
  if (have($item`miniature crystal ball`)) return "Orb";
  if (have($item`Fourth of May Cosplay Saber`) && get("_saberForceUses") < 5) return "Saber";
  return null;
}

export function hasMonsterReplacers(): boolean {
  return (
    (have($skill`Meteor Lore`) && get("_macrometeoriteUses") < 10) ||
    (have($item`Powerful Glove`) && get("_powerfulGloveBatteryPowerUsed") < 90)
  );
}

/**
 * Saberfriends a crate if we are able to do so.
 */
export function saberCrateIfSafe(): void {
  const canSaber = have($item`Fourth of May Cosplay Saber`) && get("_saberForceUses") < 5;
  const isSafeToSaber = get("beGregariousFightsLeft") === 0 || get("_saberForceMonsterCount") > 0;
  if (!canSaber || !isSafeToSaber) return;

  do {
    const run = tryFindFreeRun(freeRunConstraints(false)) ?? ltbRun();

    useFamiliar(run.constraints.familiar?.() ?? freeFightFamiliar({ canChooseMacro: false }));
    run.constraints.preparation?.();
    new Requirement([], {
      forceEquip: $items`Fourth of May Cosplay Saber`,
      preventEquip: $items`Kramco Sausage-o-Matic™`,
    })
      .merge(run.constraints.equipmentRequirements?.() ?? new Requirement([], {}))
      .maximize();
    setChoice(1387, 2);
    garboAdventure(
      $location`Noob Cave`,
      Macro.if_(crate, Macro.skill($skill`Use the Force`))
        .if_($monster`sausage goblin`, Macro.kill())
        .ifHolidayWanderer(run.macro)
        .abort(),
    );
  } while (
    [
      "Puttin' it on Wax",
      "Wooof! Wooooooof!",
      "Playing Fetch*",
      "Your Dog Found Something Again",
    ].includes(get("lastEncounter"))
  );
}

/**
 * Equip the miniature crystal ball if the current prediction is good for us.
 */
export function equipOrbIfDesired(): void {
  if (
    have($item`miniature crystal ball`) &&
    !(get("_saberForceMonster") === crate && get("_saberForceMonsterCount") > 0) &&
    crateStrategy() !== "Sniff" &&
    [undefined, crate].includes(CrystalBall.ponder().get($location`Noob Cave`))
  ) {
    equip($slot`familiar`, $item`miniature crystal ball`);
  }
}

/**
 * Pre-olfact/saber crates, for extrovermectin/gregarious reasons.
 */
function initializeCrates(): void {
  do {
    // We use the force while olfacting sometimes, so we'll need to refresh mafia's knowledge of olfaction
    if (property.getString("olfactedMonster") !== "crate") {
      visitUrl(`desc_effect.php?whicheffect=${$effect`On the Trail`.descid}`);
    }
    // if we have olfaction, that's our primary method for ensuring crates
    if (
      (crateStrategy() === "Sniff" &&
        (property.getString("olfactedMonster") !== "crate" ||
          !have($effect`On the Trail`) ||
          property.getString("longConMonster") !== "crate" ||
          get("_longConUsed") <= 0)) ||
      (crateStrategy() === "Orb" &&
        ((get("_gallapagosMonster") !== crate && have($skill`Gallapagosian Mating Call`)) ||
          (have($item`latte lovers member's mug`) && !get("_latteCopyUsed"))))
    ) {
      const run = tryFindFreeRun(freeRunConstraints(true)) ?? ltbRun();
      setChoice(1387, 2); // use the force, in case we decide to use that

      // Sniff the crate in as many ways as humanly possible
      const macro = Macro.trySkill($skill`Transcendent Olfaction`)
        .trySkill($skill`Long Con`)
        .trySkill($skill`Offer Latte to Opponent`)
        .externalIf(
          get("_gallapagosMonster") !== crate && have($skill`Gallapagosian Mating Call`),
          Macro.trySkill($skill`Gallapagosian Mating Call`),
        )
        .trySkill($skill`Use the Force`)
        .step(run.macro);

      // equip latte and saber for lattesniff and saberfriends, if we want to
      // Crank up ML to make sure the crate survives several rounds; we may have some passive damage
      useFamiliar(run.constraints.familiar?.() ?? freeFightFamiliar({ canChooseMacro: false }));
      run.constraints.preparation?.();
      new Requirement(["100 Monster Level"], {
        forceEquip: $items`latte lovers member's mug, Fourth of May Cosplay Saber`.filter((item) =>
          have(item),
        ),
        preventEquip: $items`carnivorous potted plant`,
      })
        .merge(run.constraints.equipmentRequirements?.() ?? new Requirement([], {}))
        .maximize();
      garboAdventure(
        $location`Noob Cave`,
        Macro.if_(crate, macro).ifHolidayWanderer(run.macro).abort(),
      );
      visitUrl(`desc_effect.php?whicheffect=${$effect`On the Trail`.descid}`);
    } else if (
      crateStrategy() === "Saber" &&
      (get("_saberForceMonster") !== crate || get("_saberForceMonsterCount") === 0) &&
      get("_saberForceUses") < 5
    ) {
      saberCrateIfSafe();
    } else break; // we can break the loop if there's nothing to do
  } while (!["crate", "Using the Force"].includes(get("lastEncounter"))); // loop until we actually hit a crate
}

function getClub() {
  if (have($skill`Iron Palm Technique`) && !have($effect`Iron Palms`)) {
    useSkill($skill`Iron Palm Technique`);
  }
  const availableClub =
    Item.all().find(
      (i) =>
        have(i) &&
        canEquip(i) &&
        weaponHands(i) === 2 &&
        (itemType(i) === "club" || (have($effect`Iron Palms`) && itemType(i) === "sword")),
    ) ?? $item`amok putter`;
  retrieveItem(availableClub);
  return availableClub;
}

const MAX_BANISH_PRICE = 100000; // price of nanobrawny

type Banish = {
  name: string;
  macro: () => Macro;
  available: () => boolean;
  price?: () => number;
  prepare?: () => void;
};

const combatItem = (item: Item, maxPrice?: number): Banish => ({
  name: `${item}`,
  available: () => mallPrice(item) < (maxPrice ?? MAX_BANISH_PRICE),
  macro: () => Macro.item(item),
  price: () => mallPrice(item),
  prepare: () => acquire(1, item, maxPrice ?? MAX_BANISH_PRICE), // put a sanity ceiling of 50k on the banish
});

const longBanishes: Banish[] = [
  combatItem($item`human musk`),
  combatItem($item`tryptophan dart`),
  combatItem($item`Daily Affirmation: Be a Mind Master`),
  {
    name: "Batter Up!",
    available: () => myFury() >= 5 && have($skill`Batter Up!`),
    macro: () => Macro.skill($skill`Batter Up!`),
    prepare: () => {
      const club = getClub();
      new Requirement(["100 Monster Level"], {
        preventEquip: $items`carnivorous potted plant`,
        forceEquip: [club],
      }).maximize();
    },
  },
  {
    name: "Nanobrawny",
    available: () => true,
    price: () => mallPrice($item`pocket wish`) * 2, // could be 3 if you are unlucky
    macro: () => Macro.skill($skill`Unleash Nanites`),
    prepare: () => {
      while (haveEffect($effect`Nanobrawny`) < 40) {
        acquire(1, $item`pocket wish`, 50000);
        cliExecute(`genie effect Nanobrawny`);
      }
    },
  },
];

const freeBunnyBanish: Banish = {
  name: "Mafia Middle Finger Ring",
  available: () => !get("_mafiaMiddleFingerRingUsed"),
  macro: () => Macro.skill($skill`Show them your ring`),
  prepare: () => {
    new Requirement([], {
      preventEquip: $items`carnivorous potted plant`,
      forceEquip: [$item`mafia middle finger ring`],
    }).maximize();
  },
};

const iceHouseBanish: Banish = {
  name: "Ice House",
  available: () => true,
  macro: () => Macro.item($item`ice house`),
  prepare: () => acquire(1, $item`ice house`, 1000000),
};

const shortBanishes = [
  combatItem($item`Louder Than Bomb`, 10000),
  combatItem($item`tennis ball`, 10000),
];

function iceHouseAllowed(): boolean {
  if (get("garboDisallowIceHouseNotify", false) || globalOptions.prefs.autoUserConfirm) {
    return false;
  }

  if (
    userConfirmDialog(
      "Would you like to allow garbo to ice house a fluffy bunny? This saves significant costs on banishers in the long run.",
      false,
    )
  ) {
    return true;
  }
  set("garboDisallowIceHouseNotify", true);
  return false;
}

function banishBunny(): void {
  const banishes = [
    ...longBanishes,
    ...(!have($item`miniature crystal ball`) ? shortBanishes : []),
  ].filter((b) => b.available());

  const usingIceHouseBanish =
    getBanishedMonsters().get($item`ice house`) !== $monster`fluffy bunny` &&
    retrievePrice($item`ice house`) < 1000000 &&
    iceHouseAllowed();

  const banish = usingIceHouseBanish
    ? iceHouseBanish
    : getUsingFreeBunnyBanish()
    ? freeBunnyBanish
    : maxBy(banishes, (banish: Banish) => banish.price?.() ?? 0, true);
  do {
    banish.prepare?.();
    garboAdventure(
      $location`The Dire Warren`,
      Macro.if_($monster`fluffy bunny`, banish.macro()).embezzler(),
    );
  } while (
    "fluffy bunny" !== get("lastEncounter") &&
    !get("banishedMonsters").includes("fluffy bunny")
  );
}

function getBanishedPhyla(): Map<Skill | Item, Phylum> {
  const phylumBanish = new Map<Skill | Item, Phylum>();
  const banishPart = get("banishedPhyla").split(":").slice(0, 2);

  if (banishPart.length === 2) {
    const [skill, phylum] = banishPart;
    // for now, the only phylum banish is Patriotic Screech, a skill
    phylumBanish.set(toSkill(skill), toPhylum(phylum));
  }

  return phylumBanish;
}

export function initializeDireWarren(): void {
  visitUrl("museum.php?action=icehouse");

  const banishedMonsters = getBanishedMonsters();
  const banishedPhyla = getBanishedPhyla();

  if ([...banishedMonsters.values()].find((m) => m === $monster`fluffy bunny`)) return;
  if ([...banishedPhyla.values()].find((p) => p === $monster`fluffy bunny`.phylum)) return;

  banishBunny();
}

export function initializeExtrovermectinZones(): void {
  if (get("beGregariousFightsLeft") === 0) {
    if (hasMonsterReplacers()) initializeCrates();
    initializeDireWarren();
  }
}

export function gregReady(): boolean {
  return (
    (get("beGregariousMonster") === embezzler && get("beGregariousFightsLeft") > 0) ||
    (get("_monsterHabitatsMonster") === embezzler && get("_monsterHabitatsFightsLeft") > 0)
  );
}

export function totalGregCharges(countPartial: boolean): number {
  const extroPartial = get("beGregariousFightsLeft") > 0 ? 1 : 0;
  const habitatPartial = get("_monsterHabitatsFightsLeft") > 0 ? 1 : 0;

  return (
    get("beGregariousCharges") +
    (have($skill`Just the Facts`) ? 3 - get("_monsterHabitatsRecalled") : 0) +
    (countPartial ? extroPartial + habitatPartial : 0)
  );
}

export function possibleGregCrystalBall(): number {
  if (have($item`miniature crystal ball`)) {
    const ponderCount = CrystalBall.ponder().get($location`The Dire Warren`) === embezzler ? 1 : 0;
    return totalGregCharges(true) + ponderCount;
  }
  return 0;
}
