import {
  abort,
  canAdventure,
  cliExecute,
  getClanLounge,
  haveEquipped,
  isBanished,
  itemAmount,
  Location,
  mallPrice,
  myAdventures,
  myHash,
  myRain,
  print,
  retrieveItem,
  runChoice,
  runCombat,
  toInt,
  use,
  userConfirm,
  useSkill,
  visitUrl,
} from "kolmafia";
import { DraggableFight } from "garbo-lib";
import { OutfitSpec } from "grimoire-kolmafia";
import {
  $effect,
  $familiar,
  $item,
  $items,
  $location,
  $locations,
  $monster,
  $skill,
  AprilingBandHelmet,
  ChateauMantegna,
  ChestMimic,
  clamp,
  CombatLoversLocket,
  Counter,
  CrystalBall,
  get,
  getBanishedMonsters,
  have,
  HeavyRains,
  property,
  set,
  SourceTerminal,
  sum,
  Witchess,
} from "libram";
import { MonsterProperty, NumericProperty } from "libram/dist/propertyTypes";

import {
  garboAdventure,
  garboAdventureAuto,
  Macro,
  withMacro,
} from "../combat";
import {
  averageTargetNet,
  getBestLuckyAdventure,
  getUsingFreeBunnyBanish,
  HIGHLIGHT,
  ltbRun,
  setChoice,
  WISH_VALUE,
} from "../lib";
import {
  crateStrategy,
  doingGregFight,
  equipOrbIfDesired,
  gregReady,
  possibleGregCrystalBall,
  shouldAugustCast,
} from "../resources";
import { acquire } from "../acquire";
import { globalOptions } from "../config";

import {
  changeLastAdvLocationTask,
  TargetFightConfigOptions as CopyTargetFightConfigOptions,
  RunOptions,
} from "./lib";

export class CopyTargetFight implements CopyTargetFightConfigOptions {
  name: string;
  available: () => boolean;
  potential: () => number;
  execute: (options: RunOptions) => void;
  spec: OutfitSpec;
  draggable?: DraggableFight;
  canInitializeWandererCounters: boolean;
  wrongEncounterName: boolean;
  gregariousReplace: boolean;
  location?: Location;

  /**
   * This is the class that creates all the different ways to fight copy targets
   * @classdesc Copy Target Fight enc
   * @prop {string} name The name of the source of this fight, primarily used to identify special cases.
   * @prop {() => boolean} available Returns whether or not we can do this fight right now (this may change later in the day).
   * @prop {() => number} potential Returns the number of targets we expect to be able to fight from this source given the current state of hte character
   *  This is used when computing turns for buffs, so it should be as accurate as possible to the number of KGE we will fight
   * @prop {(options: RunOptions) => void} execute This runs the combat, optionally using the provided location and macro. Location is used only by draggable fights.
   *  This is the meat of each fight. How do you initialize the fight? Are there any special considerations?
   * @prop {TargetFightConfigOptions} options configuration options for this fight. see TargetFightConfigOptions for full details of all available options
   * @example
   * // suppose that we wanted to add a fight that will use print screens repeatedly, as long as we have them in our inventory
   * new CopyTargetFight(
   *  "Print Screen Monster",
   *  () => have($item`screencapped monster`) && get('screencappedMonster') === globalOptions.target, // in order to start this fight, a KGE must already be screen capped
   *  () => availableAmount($item`screencapped monster`) + availableAmount($item`print screen button`) // the total of potential of this fight is the number of already copied KGE + the number of potentially copiable KGE
   *  () => (options: RunOptions) => {
   *    const macro = Macro
   *      .externalIf(have($item`print screen button`), Macro.tryItem($item`print screen button`))
   *      .step(options.macro); // you should always include the macro passed in via options, as it may have special considerations for this fight
   *    withMacro(macro, () => useItem($item`screen capped monster`));
   *  },
   *  {
   *    canInitializeWandererCounts: false; // this copy cannot be used to start wanderer counters, since the combats are not adv.php
   *  }
   * )
   */
  constructor(
    name: string,
    available: () => boolean,
    potential: () => number,
    execute: (options: RunOptions) => void = (options: RunOptions) => {
      const adventureFunction = options.useAuto
        ? garboAdventureAuto
        : garboAdventure;
      adventureFunction(options.location, options.macro, options.macro);
    },
    options: CopyTargetFightConfigOptions = {},
  ) {
    this.name = name;
    this.available = available;
    this.potential = potential;
    this.execute = execute;
    this.spec = options.spec ?? {};
    this.draggable = options.draggable;
    this.canInitializeWandererCounters =
      options.canInitializeWandererCounters ?? false;
    this.gregariousReplace = options.gregariousReplace ?? false;
    this.wrongEncounterName =
      options.wrongEncounterName ?? this.gregariousReplace;
    this.location = options.location;
  }

  run(options: RunOptions): void {
    if (!this.available() || !myAdventures()) return;
    print(
      `Now running ${globalOptions.target} fight: ${this.name}. Stay tuned for details.`,
    );
    this.execute(options);
  }
}

export const chainStarters = [
  new CopyTargetFight(
    "Witchess",
    () =>
      Witchess.have() &&
      Witchess.pieces.includes(globalOptions.target) &&
      Witchess.fightsDone() < 5,
    () =>
      Witchess.have() && Witchess.pieces.includes(globalOptions.target)
        ? Math.max(5 - Witchess.fightsDone(), 0)
        : 0,
    (options: RunOptions) => {
      withMacro(
        options.macro,
        () => Witchess.fightPiece(globalOptions.target),
        options.useAuto,
      );
    },
  ),
  new CopyTargetFight(
    "Chateau Painting",
    () =>
      ChateauMantegna.have() &&
      !ChateauMantegna.paintingFought() &&
      ChateauMantegna.paintingMonster() === globalOptions.target,
    () =>
      ChateauMantegna.have() &&
      !ChateauMantegna.paintingFought() &&
      ChateauMantegna.paintingMonster() === globalOptions.target
        ? 1
        : 0,
    (options: RunOptions) => {
      withMacro(
        options.macro,
        () => ChateauMantegna.fightPainting(),
        options.useAuto,
      );
    },
  ),
  new CopyTargetFight(
    "Combat Lover's Locket",
    () =>
      CombatLoversLocket.availableLocketMonsters().includes(
        globalOptions.target,
      ),
    () =>
      CombatLoversLocket.availableLocketMonsters().includes(
        globalOptions.target,
      )
        ? 1
        : 0,
    (options: RunOptions) => {
      withMacro(
        options.macro,
        () => CombatLoversLocket.reminisce(globalOptions.target),
        options.useAuto,
      );
    },
  ),
  new CopyTargetFight(
    "Fax",
    () =>
      have($item`Clan VIP Lounge key`) &&
      !get("_photocopyUsed") &&
      have($item`photocopied monster`) &&
      property.get("photocopyMonster") === globalOptions.target &&
      getClanLounge()["deluxe fax machine"] !== undefined,
    () =>
      have($item`Clan VIP Lounge key`) &&
      !get("_photocopyUsed") &&
      have($item`photocopied monster`) &&
      property.get("photocopyMonster") === globalOptions.target &&
      getClanLounge()["deluxe fax machine"] !== undefined
        ? 1
        : 0,
    (options: RunOptions) => {
      withMacro(
        options.macro,
        () => use($item`photocopied monster`),
        options.useAuto,
      );
    },
  ),
  new CopyTargetFight(
    "Scepter Semirare",
    () =>
      canAdventure($location`Cobb's Knob Treasury`) &&
      shouldAugustCast($skill`Aug. 2nd: Find an Eleven-Leaf Clover Day`) &&
      globalOptions.target === $monster`Knob Goblin Embezzler`,
    () => 0, // prevent circular reference
    (options: RunOptions) => {
      retrieveItem($item`august scepter`);
      useSkill($skill`Aug. 2nd: Find an Eleven-Leaf Clover Day`);
      if (!have($effect`Lucky!`)) {
        set("_aug2Cast", true);
        return;
      }
      const adventureFunction = options.useAuto
        ? garboAdventureAuto
        : garboAdventure;
      adventureFunction(
        $location`Cobb's Knob Treasury`,
        options.macro,
        options.macro,
      );
    },
  ),
  new CopyTargetFight(
    "Saxophone semirare",
    () =>
      getBestLuckyAdventure().phase === "target" &&
      getBestLuckyAdventure().value() > 0 &&
      canAdventure($location`Cobb's Knob Treasury`) &&
      AprilingBandHelmet.canPlay($item`Apriling band saxophone`) &&
      globalOptions.target === $monster`Knob Goblin Embezzler`,
    () => 0,
    (options: RunOptions) => {
      AprilingBandHelmet.play($item`Apriling band saxophone`);
      if (!have($effect`Lucky!`)) return;
      const adventureFunction = options.useAuto
        ? garboAdventureAuto
        : garboAdventure;
      adventureFunction(
        $location`Cobb's Knob Treasury`,
        options.macro,
        options.macro,
      );
    },
  ),
  new CopyTargetFight(
    "Pillkeeper Semirare",
    () =>
      have($item`Eight Days a Week Pill Keeper`) &&
      canAdventure($location`Cobb's Knob Treasury`) &&
      !get("_freePillKeeperUsed") &&
      !have($effect`Lucky!`) &&
      globalOptions.target === $monster`Knob Goblin Embezzler`,
    () =>
      have($item`Eight Days a Week Pill Keeper`) &&
      canAdventure($location`Cobb's Knob Treasury`) &&
      !get("_freePillKeeperUsed") &&
      !have($effect`Lucky!`) &&
      globalOptions.target === $monster`Knob Goblin Embezzler`
        ? 1
        : 0,
    (options: RunOptions) => {
      retrieveItem($item`Eight Days a Week Pill Keeper`);
      cliExecute("pillkeeper semirare");
      if (!have($effect`Lucky!`)) {
        set("_freePillKeeperUsed", true);
        return;
      }
      const adventureFunction = options.useAuto
        ? garboAdventureAuto
        : garboAdventure;
      adventureFunction(
        $location`Cobb's Knob Treasury`,
        options.macro,
        options.macro,
      );
    },
  ),
  new CopyTargetFight(
    "Mimic Eggs",
    () => ChestMimic.differentiableQuantity(globalOptions.target) >= 1,
    () =>
      ChestMimic.differentiableQuantity(globalOptions.target) +
      clamp(
        Math.floor($familiar`Chest Mimic`.experience / 50),
        0,
        11 - get("_mimicEggsObtained"),
      ),
    (options: RunOptions) => {
      withMacro(
        options.macro,
        () => ChestMimic.differentiate(globalOptions.target),
        options.useAuto,
      );
    },
  ),
  new CopyTargetFight(
    "Rain Main",
    () => have($skill`Rain Man`) && myRain() >= 50,
    () => Math.floor(myRain() / 50),
    (options: RunOptions) => {
      withMacro(
        options.macro,
        () => HeavyRains.rainMan(globalOptions.target),
        options.useAuto,
      );
    },
  ),
];

export const copySources = [
  new CopyTargetFight(
    "Time-Spinner",
    () =>
      have($item`Time-Spinner`) &&
      $locations`Noob Cave, The Dire Warren, The Haunted Kitchen`.some(
        (location) => location.combatQueue.includes(globalOptions.target.name),
      ) &&
      get("_timeSpinnerMinutesUsed") <= 7,
    () =>
      have($item`Time-Spinner`) &&
      $locations`Noob Cave, The Dire Warren, The Haunted Kitchen`.some(
        (location) =>
          location.combatQueue.includes(globalOptions.target.name) ||
          get("beGregariousCharges") > 0,
      )
        ? Math.floor((10 - get("_timeSpinnerMinutesUsed")) / 3)
        : 0,
    (options: RunOptions) => {
      withMacro(
        options.macro,
        () => {
          visitUrl(`inv_use.php?whichitem=${toInt($item`Time-Spinner`)}`);
          runChoice(1);
          visitUrl(
            `choice.php?whichchoice=1196&monid=${globalOptions.target.id}&option=1`,
          );
          runCombat();
        },
        options.useAuto,
      );
    },
  ),
  new CopyTargetFight(
    "Spooky Putty & Rain-Doh",
    () =>
      (have($item`Spooky Putty monster`) &&
        get("spookyPuttyMonster") === globalOptions.target) ||
      (have($item`Rain-Doh box full of monster`) &&
        get("rainDohMonster") === globalOptions.target),
    () => {
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
    },
    (options: RunOptions) => {
      const macro = options.macro;
      withMacro(
        macro,
        () => {
          if (have($item`Spooky Putty monster`)) {
            return use($item`Spooky Putty monster`);
          }
          return use($item`Rain-Doh box full of monster`);
        },
        options.useAuto,
      );
    },
  ),
  new CopyTargetFight(
    "4-d Camera",
    () =>
      have($item`shaking 4-d camera`) &&
      get("cameraMonster") === globalOptions.target &&
      !get("_cameraUsed"),
    () =>
      have($item`shaking 4-d camera`) &&
      get("cameraMonster") === globalOptions.target &&
      !get("_cameraUsed")
        ? 1
        : 0,
    (options: RunOptions) => {
      withMacro(
        options.macro,
        () => use($item`shaking 4-d camera`),
        options.useAuto,
      );
    },
  ),
  new CopyTargetFight(
    "Ice Sculpture",
    () =>
      have($item`ice sculpture`) &&
      get("iceSculptureMonster") === globalOptions.target &&
      !get("_iceSculptureUsed"),
    () =>
      have($item`ice sculpture`) &&
      get("iceSculptureMonster") === globalOptions.target &&
      !get("_iceSculptureUsed")
        ? 1
        : 0,
    (options: RunOptions) => {
      withMacro(
        options.macro,
        () => use($item`ice sculpture`),
        options.useAuto,
      );
    },
  ),
  new CopyTargetFight(
    "Green Taffy",
    () =>
      have($item`envyfish egg`) &&
      get("envyfishMonster") === globalOptions.target &&
      !get("_envyfishEggUsed"),
    () =>
      have($item`envyfish egg`) &&
      get("envyfishMonster") === globalOptions.target &&
      !get("_envyfishEggUsed")
        ? 1
        : 0,
    (options: RunOptions) => {
      withMacro(options.macro, () => use($item`envyfish egg`), options.useAuto);
    },
  ),
  new CopyTargetFight(
    "Screencapped Monster",
    () =>
      have($item`screencapped monster`) &&
      property.get("screencappedMonster") === globalOptions.target,
    () =>
      property.get("screencappedMonster") === globalOptions.target
        ? itemAmount($item`screencapped monster`)
        : 0,
    (options: RunOptions) => {
      withMacro(
        options.macro,
        () => use($item`screencapped monster`),
        options.useAuto,
      );
    },
  ),
  new CopyTargetFight(
    "Sticky Clay Homunculus",
    () =>
      have($item`sticky clay homunculus`) &&
      property.get("crudeMonster") === globalOptions.target,
    () =>
      property.get("crudeMonster") === globalOptions.target
        ? itemAmount($item`sticky clay homunculus`)
        : 0,
    (options: RunOptions) =>
      withMacro(
        options.macro,
        () => use($item`sticky clay homunculus`),
        options.useAuto,
      ),
  ),
];

export const wanderSources = [
  new CopyTargetFight(
    "Lucky!",
    () =>
      canAdventure($location`Cobb's Knob Treasury`) &&
      have($effect`Lucky!`) &&
      globalOptions.target === $monster`Knob Goblin Embezzler`,
    () =>
      canAdventure($location`Cobb's Knob Treasury`) &&
      have($effect`Lucky!`) &&
      globalOptions.target === $monster`Knob Goblin Embezzler`
        ? 1
        : 0,
    undefined,
    {
      location: $location`Cobb's Knob Treasury`,
    },
  ),
  new CopyTargetFight(
    "Digitize",
    () =>
      get("_sourceTerminalDigitizeMonster") === globalOptions.target &&
      Counter.get("Digitize Monster") <= 0,
    () =>
      SourceTerminal.have() && SourceTerminal.getDigitizeUses() === 0 ? 1 : 0,
    undefined,
    {
      draggable: "wanderer",
    },
  ),
  new CopyTargetFight(
    "Guaranteed Romantic Monster",
    () =>
      get("_romanticFightsLeft") > 0 &&
      Counter.get("Romantic Monster window begin") <= 0 &&
      Counter.get("Romantic Monster window end") <= 0,
    () => 0,
    undefined,
    {
      draggable: "wanderer",
    },
  ),
  new CopyTargetFight(
    "Enamorang",
    () =>
      Counter.get("Enamorang") <= 0 &&
      get("enamorangMonster") === globalOptions.target,
    () =>
      (Counter.get("Enamorang") <= 0 &&
        get("enamorangMonster") === globalOptions.target) ||
      (have($item`LOV Enamorang`) && !get("_enamorangs"))
        ? 1
        : 0,
    undefined,
    {
      draggable: "wanderer",
    },
  ),
];

function changeLastAdvLocation(): void {
  const task = changeLastAdvLocationTask();
  if (task.ready() && !task.completed()) {
    task.do();
  }
  visitUrl("main.php");
}

const gregFights = (
  name: string,
  haveCheck: () => boolean,
  monsterProp: MonsterProperty,
  fightsProp: NumericProperty,
  totalCharges: () => number,
) => {
  function runGregFight(options: RunOptions) {
    const run = ltbRun();
    const runMacro = getUsingFreeBunnyBanish()
      ? Macro.skill($skill`Snokebomb`)
      : ltbRun().macro;
    run.constraints.preparation?.();
    const bunnyIsBanished = isBanished($monster`fluffy bunny`);
    const adventureFunction = options.useAuto
      ? garboAdventureAuto
      : garboAdventure;
    adventureFunction(
      $location`The Dire Warren`,
      Macro.if_($monster`fluffy bunny`, runMacro).step(options.macro),
      Macro.if_($monster`fluffy bunny`, runMacro).step(options.macro),
    );

    if (
      get("lastEncounter") === $monster`fluffy bunny`.name &&
      bunnyIsBanished
    ) {
      const bunnyBanish = [...getBanishedMonsters().entries()].find(
        ([, monster]) => monster === $monster`fluffy bunny`,
      )?.[0];
      abort(
        `Fluffy bunny is supposedly banished by ${bunnyBanish}, but this appears not to be the case; the most likely issue is that your ${monsterProp} preference is nonzero and should probably be zero.`,
      );
    }
  }

  const resourceIsOccupied = () =>
    get(fightsProp) > 0 &&
    ![null, globalOptions.target].includes(get(monsterProp));

  return [
    new CopyTargetFight(
      name,
      () =>
        haveCheck() &&
        !resourceIsOccupied() &&
        get(fightsProp) > (have($item`miniature crystal ball`) ? 1 : 0),
      () => (!resourceIsOccupied() ? totalCharges() : 0),
      (options: RunOptions) => {
        runGregFight(options);
        // reset the crystal ball prediction by staring longingly at toast
        if (get(fightsProp) === 1 && have($item`miniature crystal ball`)) {
          const warrenPrediction = CrystalBall.ponder().get(
            $location`The Dire Warren`,
          );
          if (warrenPrediction !== globalOptions.target) {
            changeLastAdvLocation();
          }
        }
      },
      {
        canInitializeWandererCounters: true,
      },
    ),
    new CopyTargetFight(
      `${name} (Set Up Crystal Ball)`,
      () =>
        get(monsterProp) === globalOptions.target &&
        get(fightsProp) === 1 &&
        have($item`miniature crystal ball`) &&
        !CrystalBall.ponder().get($location`The Dire Warren`),
      () =>
        (get(monsterProp) === globalOptions.target && get(fightsProp) > 0) ||
        totalCharges() > 0
          ? 1
          : 0,
      runGregFight,
      {
        spec: {
          equip: $items`miniature crystal ball`.filter((item) => have(item)),
        },
        canInitializeWandererCounters: true,
      },
    ),
  ];
};

export const gregLikeFights = [
  ...gregFights(
    "Be Gregarious",
    () => true, // we can always use extrovermectin
    "beGregariousMonster",
    "beGregariousFightsLeft",
    () => get("beGregariousCharges") * 3 + get("beGregariousFightsLeft"),
  ),
  ...gregFights(
    "Habitats Monster",
    () => have($skill`Just the Facts`),
    "_monsterHabitatsMonster",
    "_monsterHabitatsFightsLeft",
    () =>
      have($skill`Just the Facts`)
        ? (3 - get("_monsterHabitatsRecalled")) * 5 +
          get("_monsterHabitatsFightsLeft")
        : 0,
  ),
];

/**
 * Determines whether we want to do this particular Target fight; if we aren't using orb, should always return true. If we're using orb and it's a crate, we'll have to see!
 * @returns
 */
function proceedWithOrb(): boolean {
  const strat = crateStrategy();
  // If we can't possibly use orb, return true
  if (!have($item`miniature crystal ball`) || strat !== "Orb") return true;

  // If we're using orb, we have a KGE prediction, and we can reset it, return false
  const gregFightNames = [
    "Macrometeorite",
    "Powerful Glove",
    "Habitats Monster",
    "Be Gregarious",
    "Orb Prediction",
  ];
  if (
    CrystalBall.ponder().get($location`Noob Cave`) === globalOptions.target &&
    copyTargetSources
      .filter(
        (source) => !gregFightNames.some((name) => source.name.includes(name)),
      )
      .find((source) => source.available())
  ) {
    return false;
  }

  return true;
}

export const conditionalSources = [
  new CopyTargetFight(
    "Orb Prediction",
    () =>
      have($item`miniature crystal ball`) &&
      !get("_garbo_doneGregging", false) &&
      CrystalBall.ponder().get($location`The Dire Warren`) ===
        globalOptions.target,
    () => possibleGregCrystalBall(),
    (options: RunOptions) => {
      visitUrl("inventory.php?ponder=1");
      if (
        CrystalBall.ponder().get($location`The Dire Warren`) !==
        globalOptions.target
      ) {
        return;
      }
      const adventureFunction = options.useAuto
        ? garboAdventureAuto
        : garboAdventure;
      adventureFunction(
        $location`The Dire Warren`,
        options.macro,
        options.macro,
      );
      changeLastAdvLocation();
    },
    {
      spec: { equip: $items`miniature crystal ball` },
      canInitializeWandererCounters: true,
    },
  ),
  new CopyTargetFight(
    "Macrometeorite",
    () =>
      gregReady() &&
      have($skill`Meteor Lore`) &&
      get("_macrometeoriteUses") < 10 &&
      proceedWithOrb(),
    () =>
      doingGregFight() && have($skill`Meteor Lore`)
        ? 10 - get("_macrometeoriteUses")
        : 0,
    (options: RunOptions) => {
      equipOrbIfDesired();

      const crateIsSabered = get("_saberForceMonster") === $monster`crate`;
      const notEnoughCratesSabered = get("_saberForceMonsterCount") < 2;
      const weWantToSaberCrates = !crateIsSabered || notEnoughCratesSabered;
      setChoice(1387, 2);

      const macro = Macro.if_(
        $monster`crate`,
        Macro.externalIf(
          crateStrategy() !== "Saber" &&
            !have($effect`On the Trail`) &&
            get("_olfactionsUsed") < 2,
          Macro.tryHaveSkill($skill`Transcendent Olfaction`),
        )
          .externalIf(
            haveEquipped($item`Fourth of May Cosplay Saber`) &&
              weWantToSaberCrates &&
              get("_saberForceUses") < 5,
            Macro.trySkill($skill`Use the Force`),
          )
          .skill($skill`Macrometeorite`),
      ).step(options.macro);
      const adventureFunction = options.useAuto
        ? garboAdventureAuto
        : garboAdventure;
      adventureFunction($location`Noob Cave`, macro, macro);
      if (
        CrystalBall.ponder().get($location`Noob Cave`) === globalOptions.target
      ) {
        changeLastAdvLocation();
      }
    },
    {
      gregariousReplace: true,
    },
  ),
  new CopyTargetFight(
    "Powerful Glove",
    () =>
      gregReady() &&
      have($item`Powerful Glove`) &&
      get("_powerfulGloveBatteryPowerUsed") <= 90 &&
      proceedWithOrb(),
    () =>
      doingGregFight() && have($item`Powerful Glove`)
        ? Math.min((100 - get("_powerfulGloveBatteryPowerUsed")) / 10)
        : 0,
    (options: RunOptions) => {
      equipOrbIfDesired();

      const crateIsSabered = get("_saberForceMonster") === $monster`crate`;
      const notEnoughCratesSabered = get("_saberForceMonsterCount") < 2;
      const weWantToSaberCrates = !crateIsSabered || notEnoughCratesSabered;
      setChoice(1387, 2);

      const macro = Macro.if_(
        $monster`crate`,
        Macro.externalIf(
          crateStrategy() !== "Saber" &&
            !have($effect`On the Trail`) &&
            get("_olfactionsUsed") < 2,
          Macro.tryHaveSkill($skill`Transcendent Olfaction`),
        )
          .externalIf(
            haveEquipped($item`Fourth of May Cosplay Saber`) &&
              weWantToSaberCrates &&
              get("_saberForceUses") < 5,
            Macro.trySkill($skill`Use the Force`),
          )
          .skill($skill`CHEAT CODE: Replace Enemy`),
      ).step(options.macro);
      const adventureFunction = options.useAuto
        ? garboAdventureAuto
        : garboAdventure;
      adventureFunction($location`Noob Cave`, macro, macro);
      if (
        CrystalBall.ponder().get($location`Noob Cave`) === globalOptions.target
      ) {
        changeLastAdvLocation();
      }
    },
    {
      spec: { equip: $items`Powerful Glove` },
      gregariousReplace: true,
    },
  ),
  ...gregLikeFights,
  new CopyTargetFight(
    "Backup",
    () =>
      get("lastCopyableMonster") === globalOptions.target &&
      have($item`backup camera`) &&
      get("_backUpUses") < 11,
    () => (have($item`backup camera`) ? 11 - get("_backUpUses") : 0),
    (options: RunOptions) => {
      const adventureFunction = options.useAuto
        ? garboAdventureAuto
        : garboAdventure;
      adventureFunction(
        options.location,
        Macro.if_(
          `!monsterid ${globalOptions.target.id}`,
          Macro.skill($skill`Back-Up to your Last Enemy`),
        ).step(options.macro),
        Macro.if_(
          `!monsterid ${globalOptions.target.id}`,
          Macro.skill($skill`Back-Up to your Last Enemy`),
        ).step(options.macro),
      );
    },
    {
      spec: { equip: $items`backup camera`, modes: { backupcamera: "meat" } },
      draggable: "backup",
      wrongEncounterName: true,
      canInitializeWandererCounters: true,
    },
  ),
];

export const fakeSources = [
  new CopyTargetFight(
    "Professor MeatChain",
    () => false,
    () =>
      have($familiar`Pocket Professor`) && !get("_garbo_meatChain", false)
        ? Math.max(10 - get("_pocketProfessorLectures"), 0)
        : 0,
    () => {
      return;
    },
  ),
  new CopyTargetFight(
    "Professor WeightChain",
    () => false,
    () =>
      have($familiar`Pocket Professor`) && !get("_garbo_weightChain", false)
        ? Math.min(15 - get("_pocketProfessorLectures"), 5)
        : 0,
    () => {
      return;
    },
  ),
];

export function copyTargetConfirmInvocation(msg: string): boolean {
  // If user does not have autoUserConfirm set to true
  // If the incocatedCount has already reached or exceeded the default limit
  if (!globalOptions.prefs.autoUserConfirm) {
    // userConfirmDialog is not called as
    // 1. If autoUserConfirm is true, it'd make the counter useless as it'll always return the default
    // 2. If autoUserConfirm is false, then it'll call userConfirm regardless
    // The user should be consulted about this so that they can either raise the count or decline the option
    return userConfirm(msg);
  }

  const invocatedCount = get("_garbo_autoUserConfirm_targetInvocatedCount", 0);

  if (
    invocatedCount >=
    globalOptions.prefs.autoUserConfirm_targetInvocationsThreshold
  ) {
    return false;
  }

  set("_garbo_autoUserConfirm_targetInvocatedCount", invocatedCount + 1);
  return true;
}

let monsterInEggnet: boolean;
const mosterIsInEggnet = () =>
  (monsterInEggnet ??= ChestMimic.getReceivableMonsters().includes(
    globalOptions.target,
  ));
export const emergencyChainStarters = [
  new CopyTargetFight(
    "Mimic Egg (from clinic)",
    () =>
      ChestMimic.have() &&
      $familiar`Chest Mimic`.experience >= 100 &&
      mosterIsInEggnet() &&
      get("_mimicEggsObtained") < 11,
    () => 0,
    (options: RunOptions) => {
      ChestMimic.receive(globalOptions.target);
      withMacro(
        options.macro,
        () => ChestMimic.differentiate(globalOptions.target),
        options.useAuto,
      );
    },
  ),
  // These are very deliberately the last copy target fights.
  new CopyTargetFight(
    "11-leaf clover (untapped potential)",
    () => {
      // We don't want to clover if we're not targetting an embezzler, so bail early
      if (globalOptions.target !== $monster`Knob Goblin Embezzler`) {
        return false;
      }
      if (!canAdventure($location`Cobb's Knob Treasury`)) return false;
      const potential = Math.floor(copyTargetCount());
      if (potential < 1) return false;
      // Don't use clovers if wishes are available and cheaper
      if (
        get("_genieFightsUsed") < 3 &&
        mallPrice($item`11-leaf clover`) >= WISH_VALUE
      ) {
        return false;
      }
      if (globalOptions.askedAboutWish) return globalOptions.wishAnswer;
      const profit =
        (potential + 1) * averageTargetNet() - mallPrice($item`11-leaf clover`);
      if (profit < 0) return false;
      print(
        `You have the following copy target sources untapped right now:`,
        HIGHLIGHT,
      );
      copyTargetSources
        .filter((source) => source.potential() > 0)
        .map((source) => `${source.potential()} from ${source.name}`)
        .forEach((text) => print(text, HIGHLIGHT));
      globalOptions.askedAboutWish = true;
      globalOptions.wishAnswer = copyTargetConfirmInvocation(
        `Garbo has detected you have ${potential} potential ways to copy ${
          globalOptions.target
        }, but no way to start a fight with one. Current net (before potions) is ${averageTargetNet()}, so we expect to earn ${profit} meat, after the cost of a 11-leaf clover. Should we get Lucky! for ${
          globalOptions.target
        }?`,
      );
      return globalOptions.wishAnswer;
    },
    () => 0,
    (options: RunOptions) => {
      globalOptions.askedAboutWish = false;
      property.withProperty("autoSatisfyWithCloset", true, () =>
        retrieveItem($item`11-leaf clover`),
      );
      use($item`11-leaf clover`);
      if (have($effect`Lucky!`)) {
        const adventureFunction = options.useAuto
          ? garboAdventureAuto
          : garboAdventure;
        adventureFunction(
          $location`Cobb's Knob Treasury`,
          options.macro,
          options.macro,
        );
      }
      globalOptions.askedAboutWish = false;
    },
  ),
  new CopyTargetFight(
    "Pocket Wish (untapped potential)",
    () => {
      if (!globalOptions.target.wishable) return false;
      const potential = Math.floor(copyTargetCount());
      if (potential < 1) return false;
      if (get("_genieFightsUsed") >= 3) return false;
      if (globalOptions.askedAboutWish) return globalOptions.wishAnswer;
      const profit = (potential + 1) * averageTargetNet() - WISH_VALUE;
      if (profit < 0) return false;
      print(
        `You have the following copy target sources untapped right now:`,
        HIGHLIGHT,
      );
      copyTargetSources
        .filter((source) => source.potential() > 0)
        .map((source) => `${source.potential()} from ${source.name}`)
        .forEach((text) => print(text, HIGHLIGHT));
      globalOptions.askedAboutWish = true;
      globalOptions.wishAnswer = copyTargetConfirmInvocation(
        `Garbo has detected you have ${potential} potential ways to copy a ${
          globalOptions.target
        }, but no way to start a fight with one. Current ${
          globalOptions.target
        } net (before potions) is ${averageTargetNet()}, so we expect to earn ${profit} meat, after the cost of a wish. Should we wish for ${
          globalOptions.target
        }?`,
      );
      return globalOptions.wishAnswer;
    },
    () => 0,
    (options: RunOptions) => {
      globalOptions.askedAboutWish = false;
      withMacro(
        options.macro,
        () => {
          acquire(1, $item`pocket wish`, WISH_VALUE);
          visitUrl(
            `inv_use.php?pwd=${myHash()}&which=3&whichitem=9537`,
            false,
            true,
          );
          visitUrl(
            `choice.php?pwd&whichchoice=1267&option=1&wish=to fight a ${globalOptions.target} `,
            true,
            true,
          );
          visitUrl("main.php", false);
          runCombat();
          globalOptions.askedAboutWish = false;
        },
        options.useAuto,
      );
    },
  ),
];

export const copyTargetSources = [
  ...wanderSources,
  ...conditionalSources,
  ...copySources,
  ...chainStarters,
  ...emergencyChainStarters,
  ...fakeSources,
];

export function copyTargetCount(): number {
  return sum(copyTargetSources, (source: CopyTargetFight) =>
    source.potential(),
  );
}

/**
 * Gets next available copy target fight. If there is no way to generate a fight, but copies are available,
 * the user is prompted to purchase a pocket wish to start the copy target chain.
 * @returns the next available copy target fight
 */
export function getNextCopyTargetFight(): CopyTargetFight | null {
  const wanderer = wanderSources.find((fight) => fight.available());
  if (wanderer) return wanderer;
  const conditional = conditionalSources.find((fight) => fight.available());
  if (conditional) {
    const leftoverReplacers =
      (have($skill`Meteor Lore`) ? 10 - get("_macrometeoriteUses") : 0) +
      (have($item`Powerful Glove`)
        ? Math.floor((100 - get("_powerfulGloveBatteryPowerUsed")) / 10)
        : 0);
    // we don't want to reset our orb with a gregarious fight; that defeats the purpose
    const skip =
      conditional.name === "Be Gregarious" &&
      crateStrategy() === "Orb" &&
      leftoverReplacers;
    if (!skip) return conditional;
  }
  const copy = copySources.find((fight) => fight.available());
  if (copy) return copy;
  const chainStart = chainStarters.find((fight) => fight.available());
  if (chainStart) return chainStart;
  return (
    conditional ??
    emergencyChainStarters.find((fight) => fight.available()) ??
    null
  );
}
