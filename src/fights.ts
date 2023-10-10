import { Outfit, OutfitSpec } from "grimoire-kolmafia";
import {
  adv1,
  availableAmount,
  buy,
  canadiaAvailable,
  canAdventure,
  canEquip,
  changeMcd,
  cliExecute,
  closetAmount,
  create,
  Effect,
  equip,
  equippedItem,
  Familiar,
  getAutoAttack,
  getCampground,
  gnomadsAvailable,
  handlingChoice,
  haveEquipped,
  haveOutfit,
  inebrietyLimit,
  isBanished,
  Item,
  itemAmount,
  itemDropsArray,
  itemType,
  Location,
  mallPrice,
  maximize,
  Monster,
  myAdventures,
  myAscensions,
  myBuffedstat,
  myClass,
  myFamiliar,
  myInebriety,
  myLevel,
  myMaxhp,
  myPath,
  mySoulsauce,
  myThrall,
  myTurncount,
  numericModifier,
  outfit,
  print,
  putCloset,
  refreshStash,
  restoreHp,
  retrieveItem,
  retrievePrice,
  runChoice,
  runCombat,
  setAutoAttack,
  setLocation,
  Skill,
  stashAmount,
  takeCloset,
  toInt,
  toItem,
  toJson,
  totalTurnsPlayed,
  use,
  useFamiliar,
  useSkill,
  visitUrl,
  weaponHands,
} from "kolmafia";
import {
  $class,
  $effect,
  $effects,
  $familiar,
  $familiars,
  $item,
  $items,
  $location,
  $locations,
  $monster,
  $monsters,
  $path,
  $phyla,
  $phylum,
  $skill,
  $slot,
  $stat,
  $thrall,
  ActionSource,
  AsdonMartin,
  ChateauMantegna,
  CinchoDeMayo,
  clamp,
  ClosedCircuitPayphone,
  CombatLoversLocket,
  Counter,
  CrystalBall,
  Delayed,
  ensureEffect,
  FindActionSourceConstraints,
  findLeprechaunMultiplier,
  FloristFriar,
  gameDay,
  get,
  getAverageAdventures,
  getFoldGroup,
  have,
  maxBy,
  property,
  realmAvailable,
  Requirement,
  Robortender,
  set,
  SourceTerminal,
  sum,
  tryFindFreeRun,
  TunnelOfLove,
  undelay,
  uneffect,
  Witchess,
  withChoice,
} from "libram";
import { MonsterProperty } from "libram/dist/propertyTypes";
import { acquire } from "./acquire";
import { withStash } from "./clan";
import { garboAdventure, garboAdventureAuto, Macro, withMacro } from "./combat";
import { globalOptions } from "./config";
import { postFreeFightDailySetup } from "./dailiespost";
import { bestConsumable } from "./diet";
import { embezzlerCount, embezzlerSources, getNextEmbezzlerFight } from "./embezzler";
import {
  crateStrategy,
  doingGregFight,
  initializeExtrovermectinZones,
  saberCrateIfSafe,
} from "./extrovermectin";
import {
  bestFairy,
  freeFightFamiliar,
  meatFamiliar,
  pocketProfessorLectures,
  setBestLeprechaunAsMeatFamiliar,
} from "./familiar";
import {
  asArray,
  baseMeat,
  bestShadowRift,
  burnLibrams,
  dogOrHolidayWanderer,
  ESTIMATED_OVERDRUNK_TURNS,
  eventLog,
  expectedEmbezzlerProfit,
  freeRest,
  freeRunConstraints,
  getUsingFreeBunnyBanish,
  HIGHLIGHT,
  kramcoGuaranteed,
  logMessage,
  ltbRun,
  mapMonster,
  maxPassiveDamage,
  monsterManuelAvailable,
  propertyManager,
  questStep,
  romanticMonsterImpossible,
  safeRestore,
  setChoice,
  userConfirmDialog,
} from "./lib";
import { freeFightMood, meatMood, useBuffExtenders } from "./mood";
import {
  embezzlerOutfit,
  freeFightOutfit,
  magnifyingGlass,
  toSpec,
  tryFillLatte,
  waterBreathingEquipment,
} from "./outfit";
import postCombatActions from "./post";
import { bathroomFinance, potionSetup } from "./potions";
import { garboValue } from "./garboValue";
import { WanderDetails } from "./libgarbo";
import { wanderer } from "./garboWanderer";
import { runEmbezzlerFight } from "./embezzler/execution";
import { EmbezzlerFightRunOptions } from "./embezzler/staging";

const firstChainMacro = () =>
  Macro.if_(
    $monster`Knob Goblin Embezzler`,
    Macro.if_(
      "!hasskill Lecture on Relativity",
      Macro.externalIf(
        SourceTerminal.getDigitizeMonster() !== $monster`Knob Goblin Embezzler`,
        Macro.tryCopier($skill`Digitize`),
      )
        .tryCopier($item`Spooky Putty sheet`)
        .tryCopier($item`Rain-Doh black box`)
        .tryCopier($item`4-d camera`)
        .tryCopier($item`unfinished ice sculpture`)
        .externalIf(get("_enamorangs") === 0, Macro.tryCopier($item`LOV Enamorang`)),
    )
      .trySkill($skill`lecture on relativity`)
      .meatKill(),
  ).abort();

const secondChainMacro = () =>
  Macro.if_(
    $monster`Knob Goblin Embezzler`,
    Macro.if_("!hasskill Lecture on Relativity", Macro.trySkill($skill`Meteor Shower`))
      .if_(
        "!hasskill Lecture on Relativity",
        Macro.externalIf(
          get("_sourceTerminalDigitizeMonster") !== $monster`Knob Goblin Embezzler`,
          Macro.tryCopier($skill`Digitize`),
        )
          .tryCopier($item`Spooky Putty sheet`)
          .tryCopier($item`Rain-Doh black box`)
          .tryCopier($item`4-d camera`)
          .tryCopier($item`unfinished ice sculpture`)
          .externalIf(get("_enamorangs") === 0, Macro.tryCopier($item`LOV Enamorang`)),
      )
      .trySkill($skill`lecture on relativity`)
      .meatKill(),
  ).abort();

function embezzlerSetup() {
  setLocation($location`Friar Ceremony Location`);
  potionSetup(false);
  maximize("MP", false);
  meatMood(true, 750 + baseMeat).execute(embezzlerCount());
  safeRestore();
  freeFightMood().execute(50);
  useBuffExtenders();
  burnLibrams(400);
  if (
    globalOptions.ascend &&
    questStep("questM16Temple") > 0 &&
    get("lastTempleAdventures") < myAscensions() &&
    acquire(1, $item`stone wool`, 3 * get("valueOfAdventure") + 100, false) > 0
  ) {
    ensureEffect($effect`Stone-Faced`);
    setChoice(582, 1);
    setChoice(579, 3);
    while (get("lastTempleAdventures") < myAscensions()) {
      const run = tryFindFreeRun(freeRunConstraints(false)) ?? ltbRun();
      if (!run) break;
      run.constraints.preparation?.();
      freeFightOutfit(toSpec(run)).dress();
      garboAdventure($location`The Hidden Temple`, run.macro);
    }
  }

  bathroomFinance(embezzlerCount());

  if (SourceTerminal.have()) SourceTerminal.educate([$skill`Extract`, $skill`Digitize`]);
  if (
    !get("_cameraUsed") &&
    !have($item`shaking 4-d camera`) &&
    expectedEmbezzlerProfit() > mallPrice($item`4-d camera`)
  ) {
    property.withProperty("autoSatisfyWithCloset", true, () => retrieveItem($item`4-d camera`));
  }

  if (
    !get("_iceSculptureUsed") &&
    !have($item`ice sculpture`) &&
    expectedEmbezzlerProfit() > (mallPrice($item`snow berries`) + mallPrice($item`ice harvest`)) * 3
  ) {
    property.withProperty("autoSatisfyWithCloset", true, () => {
      cliExecute("refresh inventory");
      retrieveItem($item`unfinished ice sculpture`);
    });
  }

  if (
    !get("_enamorangs") &&
    !itemAmount($item`LOV Enamorang`) &&
    expectedEmbezzlerProfit() > 20000
  ) {
    retrieveItem($item`LOV Enamorang`);
  }

  // Fix invalid copiers (caused by ascending or combat text-effects)
  if (have($item`Spooky Putty monster`) && !get("spookyPuttyMonster")) {
    // Visit the description to update the monster as it may be valid but not tracked correctly
    visitUrl(`desc_item.php?whichitem=${$item`Spooky Putty monster`.descid}`, false, false);
    if (!get("spookyPuttyMonster")) {
      // Still invalid, use it to turn back into the spooky putty sheet
      use($item`Spooky Putty monster`);
    }
  }

  if (have($item`Rain-Doh box full of monster`) && !get("rainDohMonster")) {
    visitUrl(`desc_item.php?whichitem=${$item`Rain-Doh box full of monster`.descid}`, false, false);
  }

  if (have($item`shaking 4-d camera`) && !get("cameraMonster")) {
    visitUrl(`desc_item.php?whichitem=${$item`shaking 4-d camera`.descid}`, false, false);
  }

  if (have($item`envyfish egg`) && !get("envyfishMonster")) {
    visitUrl(`desc_item.php?whichitem=${$item`envyfish egg`.descid}`, false, false);
  }

  if (have($item`ice sculpture`) && !get("iceSculptureMonster")) {
    visitUrl(`desc_item.php?whichitem=${$item`ice sculpture`.descid}`, false, false);
  }

  if (doingGregFight()) {
    initializeExtrovermectinZones();
  }
}

function startWandererCounter() {
  const nextFight = getNextEmbezzlerFight();
  if (!nextFight || nextFight.canInitializeWandererCounters || nextFight.draggable) {
    return;
  }
  const digitizeNeedsStarting =
    Counter.get("Digitize Monster") === Infinity && SourceTerminal.getDigitizeUses() !== 0;
  const romanceNeedsStarting =
    get("_romanticFightsLeft") > 0 &&
    Counter.get("Romantic Monster window begin") === Infinity &&
    Counter.get("Romantic Monster window end") === Infinity;
  if (digitizeNeedsStarting || romanceNeedsStarting) {
    if (digitizeNeedsStarting) print("Starting digitize counter by visiting the Haunted Kitchen!");
    if (romanceNeedsStarting) print("Starting romance counter by visiting the Haunted Kitchen!");
    do {
      let run: ActionSource;
      if (get("beGregariousFightsLeft") > 0) {
        print("You still have gregs active, so we're going to wear your meat outfit.");
        run = ltbRun();
        run.constraints.preparation?.();
        embezzlerOutfit().dress();
      } else {
        print("You do not have gregs active, so this is a regular free run.");
        run = tryFindFreeRun(freeRunConstraints(false)) ?? ltbRun();
        run.constraints.preparation?.();
        freeFightOutfit(toSpec(run)).dress();
      }
      garboAdventure(
        $location`The Haunted Kitchen`,
        Macro.if_($monster`Knob Goblin Embezzler`, Macro.embezzler()).step(run.macro),
      );
    } while (
      get("lastCopyableMonster") === $monster`Government agent` ||
      dogOrHolidayWanderer(["Lights Out in the Kitchen"])
    );
  }
}

const witchessPieces = [
  { piece: $monster`Witchess Bishop`, drop: $item`Sacramento wine` },
  { piece: $monster`Witchess Knight`, drop: $item`jumping horseradish` },
  { piece: $monster`Witchess Pawn`, drop: $item`armored prawn` },
  { piece: $monster`Witchess Rook`, drop: $item`Greek fire` },
];

function bestWitchessPiece() {
  return maxBy(witchessPieces, ({ drop }) => garboValue(drop)).piece;
}

function pygmyOptions(equip: Item[] = []): FreeFightOptions {
  return {
    spec: () => ({
      equip,
      avoid: $items`Staff of Queso Escusado, stinky cheese sword`,
      bonuses: new Map([[$item`garbage sticker`, 100], ...magnifyingGlass()]),
    }),
    macroAllowsFamiliarActions: false,
  };
}

export function dailyFights(): void {
  if (myInebriety() > inebrietyLimit()) return;

  if (getFoldGroup($item`Spooky Putty sheet`).some((item) => have(item))) {
    cliExecute("fold spooky putty sheet");
  }

  if (embezzlerSources.some((source) => source.potential())) {
    withStash($items`Spooky Putty sheet`, () => {
      // check if user wants to wish for embezzler before doing setup
      if (!getNextEmbezzlerFight()) return;
      embezzlerSetup();

      // PROFESSOR COPIES
      if (have($familiar`Pocket Professor`)) {
        const potentialPocketProfessorLectures = [
          {
            property: "_garbo_meatChain",
            macro: firstChainMacro,
            goalMaximize: (spec: OutfitSpec) => embezzlerOutfit(spec).dress(),
          },
          {
            property: "_garbo_weightChain",
            macro: secondChainMacro,
            goalMaximize: (spec: OutfitSpec) =>
              Outfit.from(
                { ...spec, modifier: ["Familiar Weight"] },
                new Error(`Unable to build outfit for weight chain!`),
              ).dress(),
          },
        ];

        for (const potentialLecture of potentialPocketProfessorLectures) {
          const { property, macro, goalMaximize } = potentialLecture;
          const fightSource = getNextEmbezzlerFight();
          if (!fightSource) return;
          if (get(property, false)) continue;

          if (fightSource.gregariousReplace) {
            const crateIsSabered = get("_saberForceMonster") === $monster`crate`;
            const notEnoughCratesSabered = get("_saberForceMonsterCount") < 2;
            const weWantToSaberCrates = !crateIsSabered || notEnoughCratesSabered;
            if (weWantToSaberCrates) saberCrateIfSafe();
          }

          const chip = $item`Pocket Professor memory chip`;
          const jacks = $item`box of Familiar Jacks`;
          useFamiliar($familiar`Pocket Professor`);
          if (!have(chip)) {
            if (mallPrice(jacks) < mallPrice(chip)) {
              retrieveItem(jacks);
              use(jacks);
            } else {
              retrieveItem(chip);
            }
          }

          const profSpec: OutfitSpec = { familiar: $familiar`Pocket Professor` };
          if (have(chip)) {
            profSpec.famequip = chip;
          }

          goalMaximize({ ...profSpec, ...fightSource.spec });

          if (get("_pocketProfessorLectures") < pocketProfessorLectures()) {
            const startLectures = get("_pocketProfessorLectures");
            runEmbezzlerFight(fightSource, {
              macro: macro(),
              useAuto: false,
            });
            eventLog.initialEmbezzlersFought += 1 + get("_pocketProfessorLectures") - startLectures;
            eventLog.embezzlerSources.push(fightSource.name);
            eventLog.embezzlerSources.push(
              ...new Array<string>(get("_pocketProfessorLectures") - startLectures).fill(
                "Pocket Professor",
              ),
            );
          }
          set(property, true);
          postCombatActions();
          const predictedNextFight = getNextEmbezzlerFight();
          if (!predictedNextFight?.draggable) doSausage();
          doGhost();
          startWandererCounter();
        }
      }

      useFamiliar(meatFamiliar());

      // REMAINING EMBEZZLER FIGHTS
      let nextFight = getNextEmbezzlerFight();
      while (nextFight !== null && myAdventures()) {
        print(`Running fight ${nextFight.name}`);
        const startTurns = totalTurnsPlayed();

        if (
          nextFight.draggable === "backup" &&
          have($skill`Musk of the Moose`) &&
          !have($effect`Musk of the Moose`)
        ) {
          useSkill($skill`Musk of the Moose`);
        }

        if (nextFight.gregariousReplace) {
          const crateIsSabered = get("_saberForceMonster") === $monster`crate`;
          const notEnoughCratesSabered = get("_saberForceMonsterCount") < 2;
          const weWantToSaberCrates = !crateIsSabered || notEnoughCratesSabered;
          if (weWantToSaberCrates) saberCrateIfSafe();
        }

        const location = new EmbezzlerFightRunOptions(nextFight).location;
        const underwater = location.environment === "underwater";
        const shouldCopy = get("_badlyRomanticArrows") === 0 && !underwater;

        const bestCopier = $familiars`Obtuse Angel, Reanimated Reanimator`.find(have);
        const familiar = shouldCopy && bestCopier ? bestCopier : meatFamiliar();
        const famSpec: OutfitSpec = { familiar };
        if (familiar === $familiar`Obtuse Angel`) famSpec.famequip = $item`quake of arrows`;

        setLocation(location);
        embezzlerOutfit({ ...nextFight.spec, ...famSpec }, location).dress();

        runEmbezzlerFight(nextFight);
        postCombatActions();

        print(`Finished ${nextFight.name}`);
        if (
          totalTurnsPlayed() - startTurns === 1 &&
          get("lastCopyableMonster") === $monster`Knob Goblin Embezzler` &&
          (nextFight.wrongEncounterName || get("lastEncounter") === "Knob Goblin Embezzler")
        ) {
          eventLog.initialEmbezzlersFought++;
          eventLog.embezzlerSources.push(nextFight.name);
        }

        nextFight = getNextEmbezzlerFight();

        if (romanticMonsterImpossible() && (!nextFight || !nextFight.draggable)) {
          doSausage();
          yachtzee();
        }
        doGhost();
        startWandererCounter();
      }
    });
  }
}

type FreeFightOptions = {
  cost?: () => number;
  spec?: Delayed<OutfitSpec>;
  noncombat?: () => boolean;
  effects?: () => Effect[];

  // Tells us if this fight can reasonably be expected to do familiar
  // actions like meatifying matter, or crimbo shrub red raying.
  // Defaults to true.
  macroAllowsFamiliarActions?: boolean;
  wandererOptions?: WanderDetails;
};

let consecutiveNonFreeFights = 0;
class FreeFight {
  available: () => number | boolean;
  run: () => void;
  tentacle: boolean;
  options: FreeFightOptions;

  constructor(
    available: () => number | boolean,
    run: () => void,
    tentacle: boolean,
    options: FreeFightOptions = {},
  ) {
    this.available = available;
    this.run = run;
    this.tentacle = tentacle;
    this.options = options;
  }

  isAvailable(): boolean {
    const avail = this.available();
    return typeof avail === "number" ? avail > 0 : avail;
  }

  getSpec(noncombat = false): OutfitSpec {
    const spec = undelay(this.options.spec ?? {});
    if (noncombat) delete spec.familiar;
    return spec;
  }

  runAll() {
    if (!this.isAvailable()) return;
    if ((this.options.cost?.() ?? 0) > globalOptions.prefs.valueOfFreeFight) {
      return;
    }
    while (this.isAvailable()) {
      voidMonster();
      const noncombat = !!this.options?.noncombat?.();
      const effects = this.options.effects?.() ?? [];
      freeFightMood(...effects).execute();
      freeFightOutfit(this.getSpec(noncombat), {
        wanderOptions: this.options.wandererOptions,
      }).dress();
      safeRestore();
      const curTurncount = myTurncount();
      withMacro(Macro.basicCombat(), this.run);
      if (myTurncount() > curTurncount) consecutiveNonFreeFights++;
      else consecutiveNonFreeFights = 0;
      if (consecutiveNonFreeFights >= 5) throw new Error("The last 5 FreeRunFights were not free!");
      postCombatActions();
      // Slot in our Professor Thesis if it's become available
      if (!have($effect`Feeling Lost`)) deliverThesisIfAble();
    }
  }
}

class FreeRunFight extends FreeFight {
  freeRun: (runSource: ActionSource) => void;
  constraints: FindActionSourceConstraints;

  constructor(
    available: () => number | boolean,
    run: (runSource: ActionSource) => void,
    options: FreeFightOptions = {},
    freeRunPicker: FindActionSourceConstraints = {},
  ) {
    super(available, () => null, false, { ...options, macroAllowsFamiliarActions: false });
    this.freeRun = run;
    this.constraints = freeRunPicker;
  }

  runAll() {
    if (!this.isAvailable()) return;
    if ((this.options.cost ? this.options.cost() : 0) > globalOptions.prefs.valueOfFreeFight) {
      return;
    }
    while (this.isAvailable()) {
      const initialSpec = undelay(this.options.spec ?? {});
      const constraints = {
        ...freeRunConstraints(false),
        noFamiliar: () => "familiar" in initialSpec,
        ...this.constraints,
      };
      const runSource = tryFindFreeRun(constraints);
      if (!runSource) break;
      runSource.constraints.preparation?.();
      const mergingOutfit = Outfit.from(
        initialSpec,
        new Error(`Failed to build outfit from ${toJson(initialSpec)}`),
      );
      mergingOutfit.equip(toSpec(runSource));
      freeFightOutfit(mergingOutfit.spec()).dress();
      freeFightMood(...(this.options.effects?.() ?? []));
      safeRestore();
      const curTurncount = myTurncount();
      withMacro(Macro.step(runSource.macro), () => this.freeRun(runSource));
      if (myTurncount() > curTurncount) consecutiveNonFreeFights++;
      else consecutiveNonFreeFights = 0;
      if (consecutiveNonFreeFights >= 5) throw new Error("The last 5 FreeRunFights were not free!");
      postCombatActions();
    }
  }
}

const pygmyBanishHandlers = [
  {
    pygmy: $monster`pygmy bowler`,
    skill: $skill`Snokebomb`,
    check: "_snokebombUsed",
    limit: getUsingFreeBunnyBanish() ? 1 : 3,
    item: $item`Louder Than Bomb`,
  },
  {
    pygmy: $monster`pygmy orderlies`,
    skill: $skill`Feel Hatred`,
    check: "_feelHatredUsed",
    limit: 3,
    item: $item`divine champagne popper`,
  },
  {
    pygmy: $monster`pygmy janitor`,
    skill: undefined,
    check: undefined,
    limit: 0,
    item: $item`tennis ball`,
  },
] as const;

const sniffSources: MonsterProperty[] = [
  "_gallapagosMonster",
  "olfactedMonster",
  "_latteMonster",
  "motifMonster",
  "longConMonster",
];
const pygmySniffed = () =>
  sniffSources.some((source) => pygmyBanishHandlers.some(({ pygmy }) => pygmy === get(source)));

const pygmyMacro = Macro.step(
  ...pygmyBanishHandlers.map(({ pygmy, skill, item, check, limit }) =>
    Macro.externalIf(
      (check ? get(check) : Infinity) < limit,
      Macro.if_(pygmy, skill ? Macro.trySkill(skill).item(item) : Macro.item(item)),
      Macro.if_(pygmy, Macro.item(item)),
    ),
  ),
)
  .if_($monster`drunk pygmy`, Macro.trySkill($skill`Extract`).trySingAlong())
  .ifHolidayWanderer(Macro.basicCombat())
  .abort();

function getStenchLocation() {
  return (
    $locations`Uncle Gator's Country Fun-Time Liquid Waste Sluice, The Hippy Camp (Bombed Back to the Stone Age), The Dark and Spooky Swamp`.find(
      (l) => canAdventure(l),
    ) ?? $location.none
  );
}

function bowlOfScorpionsAvailable() {
  if (get("hiddenTavernUnlock") === myAscensions()) {
    return true;
  } else if (globalOptions.triedToUnlockHiddenTavern) {
    return false;
  } else {
    globalOptions.triedToUnlockHiddenTavern = true;
    retrieveItem($item`book of matches`);
    if (have($item`book of matches`)) {
      use($item`book of matches`);
    }
    return (
      get("hiddenTavernUnlock") === myAscensions() || mallPrice($item`Bowl of Scorpions`) < 1000
    );
  }
}

function molemanReady() {
  return have($item`molehill mountain`) && !get("_molehillMountainUsed");
}

const stunDurations = new Map<Skill | Item, Delayed<number>>([
  [$skill`Blood Bubble`, 1],
  [
    $skill`Entangling Noodles`,
    () => (myClass() === $class`Pastamancer` && !have($skill`Shadow Noodles`) ? 1 : 0),
  ],
  [$skill`Frost Bite`, 1],
  [$skill`Shadow Noodles`, 2],
  [
    $skill`Shell Up`,
    () => {
      if (myClass() !== $class`Turtle Tamer`) return 0;
      for (const [effect, duration] of new Map([
        [$effect`Glorious Blessing of the Storm Tortoise`, 4],
        [$effect`Grand Blessing of the Storm Tortoise`, 3],
        [$effect`Blessing of the Storm Tortoise`, 2],
      ])) {
        if (have(effect)) return duration;
      }
      return 0;
    },
  ],
  [$skill`Soul Bubble`, () => (mySoulsauce() >= 5 ? 2 : 0)],
  [$skill`Summon Love Gnats`, 1],
  [$item`Rain-Doh blue balls`, 1],
]);

const freeFightSources = [
  new FreeFight(
    () =>
      have($item`protonic accelerator pack`) &&
      get("questPAGhost") !== "unstarted" &&
      get("ghostLocation") !== null,
    () => {
      const ghostLocation = get("ghostLocation");
      if (!ghostLocation) return;
      garboAdventure(ghostLocation, Macro.ghostBustin());
    },
    true,
    {
      spec: { back: $item`protonic accelerator pack` },
    },
  ),
  new FreeFight(
    () =>
      molemanReady() && (get("_thesisDelivered") || !have($familiar`Pocket Professor`)) ? 1 : 0,
    () => withMacro(Macro.basicCombat(), () => use($item`molehill mountain`)),
    true,
  ),
  new FreeFight(
    () => TunnelOfLove.have() && !TunnelOfLove.isUsed(),
    () => {
      TunnelOfLove.fightAll(
        "LOV Epaulettes",
        "Open Heart Surgery",
        "LOV Extraterrestrial Chocolate",
      );
    },
    false,
    {
      macroAllowsFamiliarActions: true,
    },
  ),

  new FreeFight(
    () =>
      ChateauMantegna.have() &&
      !ChateauMantegna.paintingFought() &&
      (ChateauMantegna.paintingMonster()?.attributes?.includes("FREE") ?? false),
    () => ChateauMantegna.fightPainting(),
    true,
    {
      spec: () =>
        have($familiar`Robortender`) &&
        $phyla`elf, fish, hobo, penguin, constellation`.some(
          (phylum) => phylum === ChateauMantegna.paintingMonster()?.phylum,
        )
          ? { familiar: $familiar`Robortender` }
          : {},
    },
  ),

  new FreeFight(
    () => get("questL02Larva") !== "unstarted" && !get("_eldritchTentacleFought"),
    () => {
      const haveEldritchEssence = itemAmount($item`eldritch essence`) !== 0;
      visitUrl("place.php?whichplace=forestvillage&action=fv_scientist", false);
      if (!handlingChoice()) throw "No choice?";
      runChoice(haveEldritchEssence ? 2 : 1);
    },
    false,
  ),

  new FreeFight(
    () => have($skill`Evoke Eldritch Horror`) && !get("_eldritchHorrorEvoked"),
    () => {
      if (!have($effect`Crappily Disguised as a Waiter`)) {
        const expectedIchors = 1;
        const rate = 11 / 200;
        const value =
          expectedIchors * garboValue($item`eldritch ichor`) * rate -
          mallPrice($item`crappy waiter disguise`);
        if (value > 0) {
          retrieveItem($item`crappy waiter disguise`);
          use($item`crappy waiter disguise`);
        }
      }
      withMacro(
        Macro.if_(
          $monster`Sssshhsssblllrrggghsssssggggrrgglsssshhssslblgl`,
          // Using while_ here in case you run out of mp
          Macro.while_("hasskill Awesome Balls of Fire", Macro.skill($skill`Awesome Balls of Fire`))
            .while_("hasskill Eggsplosion", Macro.skill($skill`Eggsplosion`))
            .while_("hasskill Saucegeyser", Macro.skill($skill`Saucegeyser`))
            .while_(
              "hasskill Weapon of the Pastalord",
              Macro.skill($skill`Weapon of the Pastalord`),
            )
            .while_("hasskill Lunging Thrust-Smack", Macro.skill($skill`Lunging Thrust-Smack`))
            .attack()
            .repeat(),
        ).basicCombat(),
        () => {
          useSkill($skill`Evoke Eldritch Horror`);
          if (have($effect`Beaten Up`)) uneffect($effect`Beaten Up`);
        },
        false,
      );
    },
    false,
  ),

  new FreeFight(
    () => clamp(3 - get("_lynyrdSnareUses"), 0, 3),
    () => use($item`lynyrd snare`),
    true,
    {
      cost: () => mallPrice($item`lynyrd snare`),
    },
  ),

  new FreeFight(
    () =>
      have($item`[glitch season reward name]`) &&
      have($item`unwrapped knock-off retro superhero cape`) &&
      !get("_glitchMonsterFights") &&
      get("garbo_fightGlitch", false) &&
      sum([...stunDurations], ([thing, duration]) => (have(thing) ? undelay(duration) : 0)) >= 5,
    () =>
      withMacro(
        Macro.trySkill($skill`Curse of Marinara`)
          .trySkill($skill`Shell Up`)
          .trySkill($skill`Shadow Noodles`)
          .trySkill($skill`Entangling Noodles`)
          .trySkill($skill`Summon Love Gnats`)
          .trySkill($skill`Frost Bite`)
          .trySkill($skill`Soul Bubble`)
          .tryItem($item`Rain-Doh blue balls`)
          .skill($skill`Blow a Robo-Kiss`)
          .repeat(),
        () => {
          restoreHp(myMaxhp());
          if (have($skill`Blood Bubble`)) ensureEffect($effect`Blood Bubble`);
          if (
            numericModifier("Monster Level") >= 50 && // Above 50 ML, monsters resist stuns.
            (canadiaAvailable() || gnomadsAvailable() || have($item`detuned radio`))
          ) {
            changeMcd(0);
          }
          retrieveItem($item`[glitch season reward name]`);
          visitUrl("inv_eat.php?pwd&whichitem=10207");
          runCombat();
          if (canadiaAvailable() || gnomadsAvailable() || have($item`detuned radio`)) {
            changeMcd(canadiaAvailable() ? 11 : 10);
          }
        },
      ),
    true,
    {
      spec: {
        back: $items`unwrapped knock-off retro superhero cape`,
        modes: { retrocape: ["robot", "kiss"] },
        avoid: $items`mutant crown, mutant arm, mutant legs, shield of the Skeleton Lord`,
      },
      macroAllowsFamiliarActions: false,
    },
  ),

  new FreeFight(
    () =>
      have($item`[glitch season reward name]`) &&
      !get("_glitchMonsterFights") &&
      get("garbo_fightGlitch", false),
    () =>
      withMacro(
        Macro.trySkill($skill`Curse of Marinara`)
          .trySkill($skill`Conspiratorial Whispers`)
          .trySkill($skill`Shadow Noodles`)
          .externalIf(
            get("glitchItemImplementationCount") * itemAmount($item`[glitch season reward name]`) >=
              400,
            Macro.item([$item`gas can`, $item`gas can`]),
          )
          .externalIf(
            get("lovebugsUnlocked"),
            Macro.trySkill($skill`Summon Love Gnats`).trySkill($skill`Summon Love Mosquito`),
          )
          .tryItem($item`train whistle`)
          .trySkill($skill`Micrometeorite`)
          .tryItem($item`Time-Spinner`)
          .tryItem($item`little red book`)
          .tryItem($item`Rain-Doh blue balls`)
          .tryItem($item`Rain-Doh indigo cup`)
          .trySkill($skill`Entangling Noodles`)
          .trySkill($skill`Frost Bite`)
          .kill(),
        () => {
          restoreHp(myMaxhp());
          if (
            numericModifier("Monster Level") >= 50 && // Above 50 ML, monsters resist stuns.
            (canadiaAvailable() || gnomadsAvailable() || have($item`detuned radio`))
          ) {
            changeMcd(0);
          }
          if (have($skill`Ruthless Efficiency`)) ensureEffect($effect`Ruthlessly Efficient`);
          if (have($skill`Mathematical Precision`)) ensureEffect($effect`Mathematically Precise`);
          if (have($skill`Blood Bubble`)) ensureEffect($effect`Blood Bubble`);
          retrieveItem($item`[glitch season reward name]`);
          if (
            get("glitchItemImplementationCount") * itemAmount($item`[glitch season reward name]`) >=
            400
          ) {
            retrieveItem($item`gas can`, 2);
          }
          visitUrl("inv_eat.php?pwd&whichitem=10207");
          runCombat();
          if (canadiaAvailable() || gnomadsAvailable() || have($item`detuned radio`)) {
            changeMcd(canadiaAvailable() ? 11 : 10);
          }
        },
      ),
    true,
    {
      spec: () => ({
        modifiers: ["1000 mainstat"],
        avoid: $items`mutant crown, mutant arm, mutant legs, shield of the Skeleton Lord`,
      }),
      macroAllowsFamiliarActions: false,
    },
  ),

  // 6	10	0	0	Infernal Seals	variety of items; must be Seal Clubber for 5, must also have Claw of the Infernal Seal in inventory for 10.
  new FreeFight(
    () => {
      const maxSeals = retrieveItem(1, $item`Claw of the Infernal Seal`) ? 10 : 5;
      const maxSealsAvailable =
        get("lastGuildStoreOpen") === myAscensions()
          ? maxSeals
          : Math.min(maxSeals, Math.floor(availableAmount($item`seal-blubber candle`) / 3));
      return myClass() === $class`Seal Clubber`
        ? Math.max(maxSealsAvailable - get("_sealsSummoned"), 0)
        : 0;
    },
    () => {
      const figurine =
        get("lastGuildStoreOpen") === myAscensions()
          ? $item`figurine of a wretched-looking seal`
          : $item`figurine of an ancient seal`;
      retrieveItem(1, figurine);
      retrieveItem(
        get("lastGuildStoreOpen") === myAscensions() ? 1 : 3,
        $item`seal-blubber candle`,
      );
      withMacro(
        Macro.startCombat()
          .trySkill($skill`Furious Wallop`)
          .while_("hasskill Lunging Thrust-Smack", Macro.skill($skill`Lunging Thrust-Smack`))
          .while_("hasskill Thrust-Smack", Macro.skill($skill`Thrust-Smack`))
          .while_("hasskill Lunge Smack", Macro.skill($skill`Lunge Smack`))
          .attack()
          .repeat(),
        () => use(figurine),
      );
    },
    true,
    {
      spec: () => {
        const clubs = Item.all().filter((i) => have(i) && canEquip(i) && itemType(i) === "club");
        const club =
          clubs.find((i) => weaponHands(i) === 1) ??
          clubs.find((i) => weaponHands(i) === 2) ??
          $item`seal-clubbing club`;
        retrieveItem(club);
        return { weapon: club };
      },
    },
  ),

  new FreeFight(
    () => clamp(10 - get("_brickoFights"), 0, 10),
    () => use($item`BRICKO ooze`),
    true,
    {
      cost: () => mallPrice($item`BRICKO eye brick`) + 2 * mallPrice($item`BRICKO brick`),
      // They just die too dang quickly
      macroAllowsFamiliarActions: false,
    },
  ),

  new FreeFight(
    () => (wantPills() ? 5 - get("_saberForceUses") : 0),
    () => {
      if (have($familiar`Red-Nosed Snapper`)) cliExecute(`snapper ${$phylum`dude`}`);
      setChoice(1387, 3);
      if (
        have($skill`Comprehensive Cartography`) &&
        get("_monstersMapped") <
          (getBestItemStealZone(true) && get("_fireExtinguisherCharge") >= 10 ? 2 : 3) // Save a map to use for polar vortex
      ) {
        withMacro(Macro.skill($skill`Use the Force`), () => {
          mapMonster($location`Domed City of Grimacia`, $monster`grizzled survivor`);
          runCombat();
          runChoice(-1);
        });
      } else {
        if (numericModifier($item`Grimacite guayabera`, "Monster Level") < 40) {
          retrieveItem(1, $item`tennis ball`);
          retrieveItem(1, $item`Louder Than Bomb`);
          retrieveItem(1, $item`divine champagne popper`);
        }
        const snokeLimit = getUsingFreeBunnyBanish() ? 1 : 3;
        garboAdventure(
          $location`Domed City of Grimacia`,
          Macro.if_(
            $monster`alielf`,
            Macro.trySkill($skill`Asdon Martin: Spring-Loaded Front Bumper`).tryItem(
              $item`Louder Than Bomb`,
            ),
          )
            .if_(
              $monster`cat-alien`,
              get("_snokebombUsed") < snokeLimit
                ? Macro.trySkill($skill`Snokebomb`).item($item`tennis ball`)
                : Macro.item($item`tennis ball`),
            )
            .if_(
              $monster`dog-alien`,
              Macro.trySkill($skill`Feel Hatred`).tryItem($item`divine champagne popper`),
            )
            .step("pickpocket")
            .skill($skill`Use the Force`),
        );
      }
    },
    false,
    {
      spec: () => {
        const canPickPocket =
          myClass() === $class`Accordion Thief` || myClass() === $class`Disco Bandit`;
        const bestPickpocketItem = $items`tiny black hole, mime army infiltration glove`.find(
          (item) => have(item) && canEquip(item),
        );
        const spec: OutfitSpec = {
          modifier: ["1000 Pickpocket Chance"],
          equip: $items`Fourth of May Cosplay Saber`,
        };
        if (have($familiar`Red-Nosed Snapper`)) spec.familiar = $familiar`Red-Nosed Snapper`;
        if (!canPickPocket && bestPickpocketItem) spec.equip?.push(bestPickpocketItem);

        return spec;
      },
      effects: () => $effects`Transpondent`,
      macroAllowsFamiliarActions: false,
    },
  ),

  // Initial 9 Pygmy fights
  new FreeFight(
    () =>
      get("questL11Worship") !== "unstarted" && bowlOfScorpionsAvailable() && !pygmySniffed()
        ? clamp(9 - get("_drunkPygmyBanishes"), 0, 9)
        : 0,
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem(clamp(9 - get("_drunkPygmyBanishes"), 0, 9), $item`Bowl of Scorpions`);
      retrieveItem($item`Louder Than Bomb`);
      retrieveItem($item`tennis ball`);
      retrieveItem($item`divine champagne popper`);
      garboAdventure($location`The Hidden Bowling Alley`, pygmyMacro);
    },
    true,
    {
      cost: () => {
        const banishers = pygmyBanishHandlers
          .filter(
            ({ skill, check, limit }) => !skill || !have(skill) || (check && get(check) >= limit),
          )
          .map(({ item }) => item);
        return retrievePrice($item`Bowl of Scorpions`) + sum(banishers, mallPrice) / 11;
      },
    },
  ),

  // 10th Pygmy fight. If we have an orb, equip it for this fight, to save for later
  new FreeFight(
    () =>
      get("questL11Worship") !== "unstarted" && get("_drunkPygmyBanishes") === 9 && !pygmySniffed(),
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem($item`Bowl of Scorpions`);
      garboAdventure($location`The Hidden Bowling Alley`, pygmyMacro);
    },
    true,
    pygmyOptions($items`miniature crystal ball`.filter((item) => have(item))),
  ),
  // 11th pygmy fight if we lack a saber
  new FreeFight(
    () =>
      get("questL11Worship") !== "unstarted" &&
      get("_drunkPygmyBanishes") === 10 &&
      (!have($item`Fourth of May Cosplay Saber`) || crateStrategy() === "Saber") &&
      !pygmySniffed(),
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem($item`Bowl of Scorpions`);
      garboAdventureAuto($location`The Hidden Bowling Alley`, pygmyMacro);
    },
    true,
    pygmyOptions(),
  ),

  // 11th+ pygmy fight if we have a saber- saber friends
  new FreeFight(
    () => {
      const rightTime =
        have($item`Fourth of May Cosplay Saber`) &&
        crateStrategy() !== "Saber" &&
        get("_drunkPygmyBanishes") >= 10;
      const saberedMonster = get("_saberForceMonster");
      const wrongPygmySabered =
        saberedMonster &&
        $monsters`pygmy orderlies, pygmy bowler, pygmy janitor`.includes(saberedMonster);
      const drunksCanAppear =
        get("_drunkPygmyBanishes") === 10 ||
        (saberedMonster === $monster`drunk pygmy` && get("_saberForceMonsterCount"));
      return (
        get("questL11Worship") !== "unstarted" &&
        rightTime &&
        !wrongPygmySabered &&
        drunksCanAppear &&
        !pygmySniffed()
      );
    },
    () => {
      if (
        (get("_saberForceMonster") !== $monster`drunk pygmy` ||
          get("_saberForceMonsterCount") === 1) &&
        get("_saberForceUses") < 5
      ) {
        putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
        putCloset(itemAmount($item`Bowl of Scorpions`), $item`Bowl of Scorpions`);
        garboAdventure($location`The Hidden Bowling Alley`, Macro.skill($skill`Use the Force`));
      } else {
        if (closetAmount($item`Bowl of Scorpions`) > 0) {
          takeCloset(closetAmount($item`Bowl of Scorpions`), $item`Bowl of Scorpions`);
        } else retrieveItem($item`Bowl of Scorpions`);
        garboAdventure($location`The Hidden Bowling Alley`, pygmyMacro);
      }
    },
    false,
    pygmyOptions($items`Fourth of May Cosplay Saber`),
  ),

  // Finally, saber or not, if we have a drunk pygmy in our crystal ball, let it out.
  new FreeFight(
    () =>
      get("questL11Worship") !== "unstarted" &&
      CrystalBall.ponder().get($location`The Hidden Bowling Alley`) === $monster`drunk pygmy` &&
      get("_drunkPygmyBanishes") >= 11 &&
      !pygmySniffed(),
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem(1, $item`Bowl of Scorpions`);
      garboAdventure(
        $location`The Hidden Bowling Alley`,
        Macro.if_($monster`drunk pygmy`, pygmyMacro).abort(),
      );
    },
    true,
    pygmyOptions($items`miniature crystal ball`.filter((item) => have(item))),
  ),

  new FreeFight(
    () =>
      have($item`Time-Spinner`) &&
      !doingGregFight() &&
      $location`The Hidden Bowling Alley`.combatQueue.includes("drunk pygmy") &&
      get("_timeSpinnerMinutesUsed") < 8,
    () => {
      retrieveItem($item`Bowl of Scorpions`);
      Macro.trySkill($skill`Extract`)
        .trySingAlong()
        .setAutoAttack();
      visitUrl(`inv_use.php?whichitem=${toInt($item`Time-Spinner`)}`);
      runChoice(1);
      visitUrl(`choice.php?whichchoice=1196&monid=${$monster`drunk pygmy`.id}&option=1`);
    },
    true,
    pygmyOptions(),
  ),

  new FreeFight(
    () => get("_sausageFights") === 0 && have($item`Kramco Sausage-o-Matic™`),
    () => {
      propertyManager.setChoices(wanderer().getChoices("wanderer"));
      adv1(wanderer().getTarget("wanderer"), -1, "");
    },
    true,
    {
      spec: { offhand: $item`Kramco Sausage-o-Matic™` },
      wandererOptions: "wanderer",
    },
  ),

  new FreeFight(
    () =>
      get("questL11Ron") === "finished"
        ? clamp(5 - get("_glarkCableUses"), 0, itemAmount($item`glark cable`))
        : 0,
    () => {
      garboAdventure($location`The Red Zeppelin`, Macro.item($item`glark cable`));
    },
    true,
    {
      macroAllowsFamiliarActions: false,
    },
  ),

  // Mushroom garden
  new FreeFight(
    () =>
      (have($item`packet of mushroom spores`) ||
        getCampground()["packet of mushroom spores"] !== undefined) &&
      get("_mushroomGardenFights") === 0,
    () => {
      if (have($item`packet of mushroom spores`)) use($item`packet of mushroom spores`);
      if (SourceTerminal.have()) {
        SourceTerminal.educate([$skill`Extract`, $skill`Portscan`]);
      }
      garboAdventure(
        $location`Your Mushroom Garden`,
        Macro.externalIf(
          !doingGregFight(),
          Macro.if_($skill`Macrometeorite`, Macro.trySkill($skill`Portscan`)),
        ).basicCombat(),
      );
      if (have($item`packet of tall grass seeds`)) use($item`packet of tall grass seeds`);
    },
    true,
    {
      spec: () => (have($familiar`Robortender`) ? { familiar: $familiar`Robortender` } : {}),
    },
  ),

  // Portscan and mushroom garden
  new FreeFight(
    () =>
      !doingGregFight() &&
      (have($item`packet of mushroom spores`) ||
        getCampground()["packet of mushroom spores"] !== undefined) &&
      Counter.get("portscan.edu") === 0 &&
      have($skill`Macrometeorite`) &&
      get("_macrometeoriteUses") < 10,
    () => {
      if (have($item`packet of mushroom spores`)) use($item`packet of mushroom spores`);
      if (SourceTerminal.have()) {
        SourceTerminal.educate([$skill`Extract`, $skill`Portscan`]);
      }
      garboAdventure(
        $location`Your Mushroom Garden`,
        Macro.if_($monster`Government agent`, Macro.skill($skill`Macrometeorite`)).if_(
          $monster`piranha plant`,
          Macro.if_($skill`Macrometeorite`, Macro.trySkill($skill`Portscan`)).basicCombat(),
        ),
      );
      if (have($item`packet of tall grass seeds`)) use($item`packet of tall grass seeds`);
    },
    true,
  ),

  new FreeFight(
    () => (have($familiar`God Lobster`) ? clamp(3 - get("_godLobsterFights"), 0, 3) : 0),
    () => {
      propertyManager.setChoices({
        1310: !have($item`God Lobster's Crown`) ? 1 : 2, // god lob equipment, then stats
      });
      restoreHp(myMaxhp());
      visitUrl("main.php?fightgodlobster=1");
      runCombat();
      visitUrl("choice.php");
      if (handlingChoice()) runChoice(-1);
    },
    false,
    {
      spec: () => ({
        familiar: $familiar`God Lobster`,
        bonuses: new Map<Item, number>([
          [$item`God Lobster's Scepter`, 1000],
          [$item`God Lobster's Ring`, 2000],
          [$item`God Lobster's Rod`, 3000],
          [$item`God Lobster's Robe`, 4000],
          [$item`God Lobster's Crown`, 5000],
        ]),
      }),
    },
  ),

  new FreeFight(
    () => (have($familiar`Machine Elf`) ? clamp(5 - get("_machineTunnelsAdv"), 0, 5) : 0),
    () => {
      propertyManager.setChoices({
        1119: 6, // escape DMT
      });
      const thought =
        garboValue($item`abstraction: certainty`) >= garboValue($item`abstraction: thought`);
      const action = garboValue($item`abstraction: joy`) >= garboValue($item`abstraction: action`);
      const sensation =
        garboValue($item`abstraction: motion`) >= garboValue($item`abstraction: sensation`);

      if (thought) {
        acquire(1, $item`abstraction: thought`, garboValue($item`abstraction: certainty`), false);
      }
      if (action) {
        acquire(1, $item`abstraction: action`, garboValue($item`abstraction: joy`), false);
      }
      if (sensation) {
        acquire(1, $item`abstraction: sensation`, garboValue($item`abstraction: motion`), false);
      }
      garboAdventure(
        $location`The Deep Machine Tunnels`,
        Macro.externalIf(
          thought,
          Macro.if_($monster`Perceiver of Sensations`, Macro.tryItem($item`abstraction: thought`)),
        )
          .externalIf(
            action,
            Macro.if_($monster`Thinker of Thoughts`, Macro.tryItem($item`abstraction: action`)),
          )
          .externalIf(
            sensation,
            Macro.if_($monster`Performer of Actions`, Macro.tryItem($item`abstraction: sensation`)),
          )
          .basicCombat(),
      );
    },
    false, // Marked like this as 2 DMT fights get overriden by tentacles.
    {
      spec: { familiar: $familiar`Machine Elf` },
    },
  ),

  // 28	5	0	0	Witchess pieces	must have a Witchess Set; can copy for more
  new FreeFight(
    () => (Witchess.have() ? clamp(5 - Witchess.fightsDone(), 0, 5) : 0),
    () => Witchess.fightPiece(bestWitchessPiece()),
    true,
  ),

  new FreeFight(
    () =>
      get("snojoAvailable") &&
      get("snojoSetting") !== null &&
      clamp(10 - get("_snojoFreeFights"), 0, 10),
    () => {
      adv1($location`The X-32-F Combat Training Snowman`, -1, "");
    },
    false,
  ),

  new FreeFight(
    () =>
      get("neverendingPartyAlways") && questStep("_questPartyFair") < 999
        ? clamp(
            10 -
              get("_neverendingPartyFreeTurns") -
              (!molemanReady() && !get("_thesisDelivered") && have($familiar`Pocket Professor`)
                ? 1
                : 0),
            0,
            10,
          )
        : 0,
    () => {
      const constructedMacro = Macro.tryHaveSkill($skill`Feel Pride`).basicCombat();
      setNepQuestChoicesAndPrepItems();
      garboAdventure($location`The Neverending Party`, constructedMacro);
    },
    true,
    {
      spec: () => ({
        modifier:
          get("_questPartyFairQuest") === "trash"
            ? ["100 Item Drop"]
            : get("_questPartyFairQuest") === "dj"
            ? ["100 Meat Drop"]
            : [],
        equip: have($item`January's Garbage Tote`) ? $items`makeshift garbage shirt` : [],
      }),
    },
  ),

  new FreeFight(
    () => (get("ownsSpeakeasy") ? 3 - get("_speakeasyFreeFights") : 0),
    () => adv1($location`An Unusually Quiet Barroom Brawl`, -1, ""),
    true,
  ),

  new FreeFight(
    () => CombatLoversLocket.have() && !!locketMonster() && CombatLoversLocket.reminiscesLeft() > 1,
    () => {
      const monster = locketMonster();
      if (!monster) return;
      CombatLoversLocket.reminisce(monster);
    },
    true,
    {
      spec: () => (have($familiar`Robortender`) ? { familiar: $familiar`Robortender` } : {}),
    },
  ),

  // Get a li'l ninja costume for 150% item drop
  new FreeFight(
    () =>
      !have($item`li'l ninja costume`) &&
      have($familiar`Trick-or-Treating Tot`) &&
      !get("_firedJokestersGun") &&
      have($item`The Jokester's gun`) &&
      canEquip($item`The Jokester's gun`) &&
      questStep("questL08Trapper") >= 2,
    () =>
      garboAdventure(
        $location`Lair of the Ninja Snowmen`,
        Macro.skill($skill`Fire the Jokester's Gun`).abort(),
      ),
    true,
    {
      spec: { equip: $items`The Jokester's gun` },
      macroAllowsFamiliarActions: false,
    },
  ),

  // Fallback for li'l ninja costume if Lair of the Ninja Snowmen is unavailable
  new FreeFight(
    () =>
      !have($item`li'l ninja costume`) &&
      have($familiar`Trick-or-Treating Tot`) &&
      !get("_firedJokestersGun") &&
      have($item`The Jokester's gun`) &&
      canEquip($item`The Jokester's gun`) &&
      have($skill`Comprehensive Cartography`) &&
      get("_monstersMapped") < 3,
    () => {
      try {
        Macro.skill($skill`Fire the Jokester's Gun`)
          .abort()
          .setAutoAttack();
        mapMonster($location`The Haiku Dungeon`, $monster`amateur ninja`);
      } finally {
        setAutoAttack(0);
      }
    },
    true,
    {
      spec: { equip: $items`The Jokester's gun` },
      macroAllowsFamiliarActions: false,
    },
  ),
  new FreeFight(
    () => {
      if (!have($item`closed-circuit pay phone`)) return false;
      // Check if we have or can get Shadow Affinity
      if (have($effect`Shadow Affinity`)) return true;
      if (!get("_shadowAffinityToday") && !ClosedCircuitPayphone.rufusTarget()) return true;

      if (get("rufusQuestType") === "items" || get("rufusQuestType") === "entity") {
        // TODO: Skip bosses for now, until we can fight them
        return false; // We deemed it unprofitable to complete the quest in potionSetup
      }
      if (get("encountersUntilSRChoice") === 0) {
        // Target is either an artifact or a boss
        return true; // Get the artifact or kill the boss immediately for free
      }

      if (realmAvailable("sleaze")) return false;

      // TODO: With the KoL update, is there a function for checking if an NC is already forced?
      if (have($item`Clara's bell`) && !globalOptions.clarasBellClaimed) {
        return true;
      }

      // TODO: Calculate forcing for shadow waters against using the +5 fam weight buff
      if (CinchoDeMayo.have() && CinchoDeMayo.totalAvailableCinch() >= 60) {
        return true;
      }
      return false; // It costs turns to do anything else here
    },
    () => {
      if (have($item`Rufus's shadow lodestone`)) {
        setChoice(1500, 2); // Turn in lodestone if you have it
        adv1(bestShadowRift(), -1, "");
      }
      if (!get("_shadowAffinityToday") && !ClosedCircuitPayphone.rufusTarget()) {
        ClosedCircuitPayphone.chooseQuest(() => 2); // Choose an artifact (not supporting boss for now)
      }

      runShadowRiftTurn();

      if (get("encountersUntilSRChoice") === 0 || get("noncombatForcerActive")) {
        if (ClosedCircuitPayphone.have() && !ClosedCircuitPayphone.rufusTarget()) {
          ClosedCircuitPayphone.chooseQuest(() => 2);
        }
        adv1(bestShadowRift(), -1, ""); // grab the NC
      }

      if (questStep("questRufus") === 1) {
        withChoice(1498, 1, () => use($item`closed-circuit pay phone`));
      }

      if (have($item`Rufus's shadow lodestone`)) {
        setChoice(1500, 2); // Check for lodestone at the end again
        adv1(bestShadowRift(), -1, "");
      }

      if (!have($effect`Shadow Affinity`) && get("encountersUntilSRChoice") !== 0) {
        setLocation($location.none); // Reset location to not affect mafia's item drop calculations
      }
    },
    true,
  ),
];

const priorityFreeRunFightSources = [
  new FreeRunFight(
    () =>
      have($familiar`Patriotic Eagle`) &&
      !have($effect`Citizen of a Zone`) &&
      $locations`Barf Mountain, The Fun-Guy Mansion`.some((l) => canAdventure(l)),
    (runSource: ActionSource) => {
      const location = canAdventure($location`Barf Mountain`)
        ? $location`Barf Mountain`
        : $location`The Fun-Guy Mansion`;
      garboAdventure(
        location,
        Macro.skill($skill`%fn, let's pledge allegiance to a Zone`).step(runSource.macro),
      );
    },
    {
      spec: {
        familiar: $familiar`Patriotic Eagle`,
        famequip: $items`little bitty bathysphere, das boot`,
        modifier: ["ML 100 Max", "-Familiar Weight"],
        avoid: $items`Drunkula's wineglass`,
      },
    },
  ),
];

const freeRunFightSources = [
  // Unlock Latte ingredients
  new FreeRunFight(
    () =>
      have($item`latte lovers member's mug`) &&
      !get("latteUnlocks").includes("cajun") &&
      questStep("questL11MacGuffin") > -1,
    (runSource: ActionSource) => {
      propertyManager.setChoices({
        923: 1, // go to the blackberries in All Around the Map
        924: 1, // fight a blackberry bush, so that we can freerun
      });
      garboAdventure($location`The Black Forest`, runSource.macro);
    },
    {
      spec: { equip: $items`latte lovers member's mug` },
    },
    freeRunConstraints(true),
  ),
  new FreeRunFight(
    () =>
      have($item`latte lovers member's mug`) &&
      get("latteUnlocks").includes("cajun") &&
      !get("latteUnlocks").includes("rawhide") &&
      questStep("questL02Larva") > -1,
    (runSource: ActionSource) => {
      propertyManager.setChoices({
        502: 2, // go towards the stream in Arboreal Respite, so we can skip adventure
        505: 2, // skip adventure
      });
      garboAdventure($location`The Spooky Forest`, runSource.macro);
    },
    {
      spec: { equip: $items`latte lovers member's mug` },
    },
    freeRunConstraints(true),
  ),
  new FreeRunFight(
    () =>
      have($item`latte lovers member's mug`) &&
      !get("latteUnlocks").includes("carrot") &&
      get("latteUnlocks").includes("cajun") &&
      get("latteUnlocks").includes("rawhide"),
    (runSource: ActionSource) => {
      garboAdventure($location`The Dire Warren`, runSource.macro);
    },
    {
      spec: { equip: $items`latte lovers member's mug` },
    },
    freeRunConstraints(true),
  ),
  new FreeRunFight(
    () =>
      have($familiar`Space Jellyfish`) &&
      get("_spaceJellyfishDrops") < 5 &&
      getStenchLocation() !== $location.none,
    (runSource: ActionSource) => {
      garboAdventure(
        getStenchLocation(),
        Macro.trySkill($skill`Extract Jelly`).step(runSource.macro),
      );
    },
    {
      spec: { familiar: $familiar`Space Jellyfish` },
    },
  ),
  new FreeRunFight(
    () =>
      !doingGregFight() &&
      have($familiar`Space Jellyfish`) &&
      have($skill`Meteor Lore`) &&
      get("_macrometeoriteUses") < 10 &&
      getStenchLocation() !== $location.none,
    (runSource: ActionSource) => {
      garboAdventure(
        getStenchLocation(),
        Macro.while_(
          "!pastround 28 && hasskill macrometeorite",
          Macro.skill($skill`Extract Jelly`).skill($skill`Macrometeorite`),
        )
          .trySkill($skill`Extract Jelly`)
          .step(runSource.macro),
      );
    },
    {
      spec: { familiar: $familiar`Space Jellyfish` },
    },
  ),
  new FreeRunFight(
    () =>
      !doingGregFight() &&
      have($familiar`Space Jellyfish`) &&
      have($item`Powerful Glove`) &&
      get("_powerfulGloveBatteryPowerUsed") < 91 &&
      getStenchLocation() !== $location.none,
    (runSource: ActionSource) => {
      garboAdventure(
        getStenchLocation(),
        Macro.while_(
          "!pastround 28 && hasskill CHEAT CODE: Replace Enemy",
          Macro.skill($skill`Extract Jelly`).skill($skill`CHEAT CODE: Replace Enemy`),
        )
          .trySkill($skill`Extract Jelly`)
          .step(runSource.macro),
      );
    },
    {
      spec: { familiar: $familiar`Space Jellyfish`, equip: $items`Powerful Glove` },
    },
  ),
  new FreeFight(
    () =>
      (get("gingerbreadCityAvailable") || get("_gingerbreadCityToday")) &&
      get("gingerAdvanceClockUnlocked") &&
      !get("_gingerbreadClockVisited") &&
      get("_gingerbreadCityTurns") <= 3,
    () => {
      propertyManager.setChoices({
        1215: 1, // Gingerbread Civic Center advance clock
      });
      garboAdventure(
        $location`Gingerbread Civic Center`,
        Macro.abortWithMsg(`Expected "Setting the Clock" but ended up in combat.`),
      );
    },
    false,
    {
      noncombat: () => true,
    },
  ),
  new FreeRunFight(
    () =>
      (get("gingerbreadCityAvailable") || get("_gingerbreadCityToday")) &&
      get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) < 9,
    (runSource: ActionSource) => {
      propertyManager.setChoices({
        1215: 1, // Gingerbread Civic Center advance clock
      });
      garboAdventure($location`Gingerbread Civic Center`, runSource.macro);
      if (
        [
          "Even Tamer Than Usual",
          "Never Break the Chain",
          "Close, but Yes Cigar",
          "Armchair Quarterback",
        ].includes(get("lastEncounter"))
      ) {
        set("_gingerbreadCityTurns", 1 + get("_gingerbreadCityTurns"));
      }
    },
    {
      spec: { bonuses: new Map([[$item`carnivorous potted plant`, 100]]) },
    },
  ),
  new FreeFight(
    () =>
      (get("gingerbreadCityAvailable") || get("_gingerbreadCityToday")) &&
      get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) === 9,
    () => {
      propertyManager.setChoices({
        1204: 1, // Gingerbread Train Station Noon random candy
      });
      garboAdventure(
        $location`Gingerbread Train Station`,
        Macro.abortWithMsg(`Expected "Noon at the Train Station" but ended up in combat.`),
      );
    },
    false,
    {
      noncombat: () => true,
    },
  ),
  new FreeRunFight(
    () =>
      (get("gingerbreadCityAvailable") || get("_gingerbreadCityToday")) &&
      get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) >= 10 &&
      get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) < 19 &&
      (availableAmount($item`sprinkles`) > 5 || haveOutfit("gingerbread best")),
    (runSource: ActionSource) => {
      propertyManager.setChoices({
        1215: 1, // Gingerbread Civic Center advance clock
      });
      garboAdventure($location`Gingerbread Civic Center`, runSource.macro);
      if (
        [
          "Even Tamer Than Usual",
          "Never Break the Chain",
          "Close, but Yes Cigar",
          "Armchair Quarterback",
        ].includes(get("lastEncounter"))
      ) {
        set("_gingerbreadCityTurns", 1 + get("_gingerbreadCityTurns"));
      }
    },
    {
      spec: { bonuses: new Map([[$item`carnivorous potted plant`, 100]]) },
    },
  ),
  new FreeFight(
    () =>
      (get("gingerbreadCityAvailable") || get("_gingerbreadCityToday")) &&
      get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) === 19 &&
      (availableAmount($item`sprinkles`) > 5 || haveOutfit("gingerbread best")),
    () => {
      propertyManager.setChoices({
        1203: 4, // Gingerbread Civic Center 5 gingerbread cigarettes
        1215: 1, // Gingerbread Civic Center advance clock
        1209: 2, // enter the gallery at Upscale Midnight
        1214: 1, // get High-End ginger wine
      });
      const best = bestConsumable("booze", true, $items`high-end ginger wine, astral pilsner`);
      const gingerWineValue =
        (0.5 * 30 * (baseMeat + 750) +
          getAverageAdventures($item`high-end ginger wine`) * get("valueOfAdventure")) /
        2;
      const valueDif = gingerWineValue - best.value;
      if (
        haveOutfit("gingerbread best") &&
        (availableAmount($item`sprinkles`) < 5 ||
          (valueDif * 2 > garboValue($item`gingerbread cigarette`) * 5 &&
            itemAmount($item`high-end ginger wine`) < 11))
      ) {
        outfit("gingerbread best");
        garboAdventure($location`Gingerbread Upscale Retail District`, Macro.abort());
      } else {
        garboAdventure($location`Gingerbread Civic Center`, Macro.abort());
      }
    },
    false,
    {
      noncombat: () => true,
    },
  ),
  // Fire Extinguisher on best available target.
  new FreeRunFight(
    () =>
      ((have($item`industrial fire extinguisher`) && get("_fireExtinguisherCharge") >= 10) ||
        (have($familiar`XO Skeleton`) && get("_xoHugsUsed") < 11) ||
        (have($skill`Perpetrate Mild Evil`) && get("_mildEvilPerpetrated") < 3)) &&
      get("_VYKEACompanionLevel") === 0 && // don't attempt this in case you re-run garbo after making a vykea furniture
      getBestItemStealZone(true) !== null,
    (runSource: ActionSource) => {
      setupItemStealZones();
      const best = getBestItemStealZone(true);
      if (!best) throw `Unable to find fire extinguisher zone?`;
      const mappingMonster =
        have($skill`Comprehensive Cartography`) &&
        get("_monstersMapped") < 3 &&
        best.location.wanderers &&
        have($skill`Comprehensive Cartography`) &&
        get("_monstersMapped") < 3;
      const monsters = asArray(best.monster);
      try {
        if (best.preReq) best.preReq();
        const vortex = $skill`Fire Extinguisher: Polar Vortex`;
        const evil = $skill`Perpetrate Mild Evil`;
        const hasXO = myFamiliar() === $familiar`XO Skeleton`;
        if (myThrall() !== $thrall.none) useSkill($skill`Dismiss Pasta Thrall`);
        Macro.if_(monsters.map((m) => `!monsterid ${m.id}`).join(" && "), runSource.macro)
          .externalIf(hasXO && get("_xoHugsUsed") < 11, Macro.skill($skill`Hugs and Kisses!`))
          .externalIf(
            !best.requireMapTheMonsters && hasXO && get("_xoHugsUsed") < 10,
            Macro.step(itemStealOlfact(best)),
          )
          .while_(`hasskill ${toInt(vortex)}`, Macro.skill(vortex))
          .while_(`hasskill ${toInt(evil)}`, Macro.skill(evil))
          .step(runSource.macro)
          .setAutoAttack();
        if (mappingMonster) {
          mapMonster(best.location, monsters[0]);
        } else {
          adv1(best.location, -1, "");
        }
      } finally {
        setAutoAttack(0);
      }
    },
    {
      spec: () => {
        const zone = getBestItemStealZone();
        const spec: OutfitSpec =
          have($familiar`XO Skeleton`) && get("_xoHugsUsed") < 11
            ? { familiar: $familiar`XO Skeleton` }
            : {};
        if (have($item`industrial fire extinguisher`) && get("_fireExtinguisherCharge") >= 10) {
          spec.equip = $items`industrial fire extinguisher`;
        }
        spec.modifier = zone?.maximize ?? [];
        return spec;
      },
    },
  ),
  // Try for an ultra-rare with mayfly runs and pickpocket if we have a manuel to detect monster hp ;)
  new FreeRunFight(
    () =>
      monsterManuelAvailable() &&
      have($item`mayfly bait necklace`) &&
      canAdventure($location`Cobb's Knob Menagerie, Level 1`) &&
      get("_mayflySummons") < 30,
    (runSource: ActionSource) => {
      const willSurvivePassive = `monsterhpabove ${maxPassiveDamage()}`;
      garboAdventure(
        $location`Cobb's Knob Menagerie, Level 1`,
        Macro.if_($monster`QuickBASIC elemental`, Macro.basicCombat())
          .if_(
            $monster`BASIC Elemental`,
            Macro.if_(willSurvivePassive, Macro.step("pickpocket"))
              .externalIf(
                have($skill`Transcendent Olfaction`) && get("_olfactionsUsed") < 1,
                Macro.if_(willSurvivePassive, Macro.trySkill($skill`Transcendent Olfaction`)),
              )
              .externalIf(
                have($skill`Gallapagosian Mating Call`) &&
                  get("_gallapagosMonster") !== $monster`BASIC Elemental`,
                Macro.if_(willSurvivePassive, Macro.skill($skill`Gallapagosian Mating Call`)),
              )
              .trySkill($skill`Summon Mayfly Swarm`),
          )
          .step(runSource.macro),
      );
    },
    {
      spec: () => {
        const canPickPocket =
          myClass() === $class`Accordion Thief` || myClass() === $class`Disco Bandit`;
        const bestPickpocketItem = $items`tiny black hole, mime army infiltration glove`.find(
          (item) => have(item) && canEquip(item),
        );
        // Base drop is 30%, so 1% pickpocket gives .003
        const pickPocketValue = 0.003 * garboValue($item`GOTO`);
        const spec: OutfitSpec = {
          equip: $items`mayfly bait necklace`,
          bonuses: new Map([[$item`carnivorous potted plant`, 100]]),
          familiar: freeFightFamiliar({ allowAttackFamiliars: false }),
        };
        if (!canPickPocket && bestPickpocketItem) spec.equip?.push(bestPickpocketItem);
        if (canPickPocket || bestPickpocketItem) {
          spec.modifier = [`${pickPocketValue} Pickpocket Chance`];
        }

        return spec;
      },
    },
  ),
  // Try for mini-hipster\goth kid free fights with any remaining non-familiar free runs
  new FreeRunFight(
    () =>
      get("_hipsterAdv") < 7 &&
      (have($familiar`Mini-Hipster`) || have($familiar`Artistic Goth Kid`)),
    (runSource: ActionSource) => {
      propertyManager.setChoices(wanderer().getChoices("backup"));
      const targetLocation = wanderer().getTarget("backup");
      garboAdventure(
        targetLocation,
        Macro.if_(
          `(monsterid 969) || (monsterid 970) || (monsterid 971) || (monsterid 972) || (monsterid 973) || (monstername Black Crayon *)`,
          Macro.basicCombat(),
        ).step(runSource.macro),
      );
    },
    {
      spec: () => {
        if (have($familiar`Mini-Hipster`)) {
          return {
            familiar: $familiar`Mini-Hipster`,
            bonuses: new Map([
              [$item`ironic moustache`, garboValue($item`mole skin notebook`)],
              [$item`chiptune guitar`, garboValue($item`ironic knit cap`)],
              [$item`fixed-gear bicycle`, garboValue($item`ironic oversized sunglasses`)],
            ]),
          };
        } else {
          return { familiar: $familiar`Artistic Goth Kid` };
        }
      },
      wandererOptions: "backup",
    },
  ),
  // Try to accelerate the shadow nc, if you're able to do a quest
  new FreeRunFight(
    () =>
      have($item`closed-circuit pay phone`) &&
      get("rufusQuestType") !== "items" &&
      !have($effect`Shadow Affinity`) &&
      get("encountersUntilSRChoice") > 0,
    (runSource: ActionSource) => garboAdventure(bestShadowRift(), runSource.macro),
  ),
  // Try for an ultra-rare with mayfly runs if we didn't have a manuel ;)
  new FreeRunFight(
    () =>
      have($item`mayfly bait necklace`) &&
      canAdventure($location`Cobb's Knob Menagerie, Level 1`) &&
      get("_mayflySummons") < 30,
    (runSource: ActionSource) => {
      garboAdventure(
        $location`Cobb's Knob Menagerie, Level 1`,
        Macro.if_($monster`QuickBASIC elemental`, Macro.basicCombat())
          .if_($monster`BASIC Elemental`, Macro.trySkill($skill`Summon Mayfly Swarm`))
          .step(runSource.macro),
      );
    },
    {
      spec: {
        equip: $items`mayfly bait necklace`,
        bonuses: new Map([[$item`carnivorous potted plant`, 100]]),
      },
    },
  ),
];

function sandwormSpec(spec: OutfitSpec = {}): OutfitSpec {
  const copy = { ...spec, equip: [...(spec.equip ?? [])] };
  // Effective drop rate of spice melange is 0.1, each 1% item drop increases the chance by 0.1/10000
  const itemDropBonus = (0.1 / 10000) * garboValue($item`spice melange`);
  copy.modifier = [`${itemDropBonus.toFixed(2)} Item Drop 10000 max`];
  if (have($item`January's Garbage Tote`) && get("garbageChampagneCharge") > 0) {
    copy.equip?.push($item`broken champagne bottle`);
  }
  if (have($item`Lil' Doctor™ bag`) && get("_otoscopeUsed")) {
    copy.equip?.push($item`Lil' Doctor™ bag`);
  }
  const familiar = bestFairy();
  copy.familiar = familiar;
  if (familiar === $familiar`Reagnimated Gnome`) copy.equip?.push($item`gnomish housemaid's kgnee`);
  copy.equip = [...new Set(copy.equip)]; // Prune doubled-up stuff
  return copy;
}

const freeKillSources = [
  // 22	3	0	0	Chest X-Ray	combat skill	must have a Lil' Doctor™ bag equipped
  new FreeFight(
    () => (have($item`Lil' Doctor™ bag`) ? clamp(3 - get("_chestXRayUsed"), 0, 3) : 0),
    () => {
      ensureBeachAccess();
      withMacro(
        Macro.trySingAlong()
          .tryHaveSkill($skill`Otoscope`)
          .trySkill($skill`Chest X-Ray`),
        () => use($item`drum machine`),
      );
    },
    true,
    {
      spec: () => sandwormSpec({ equip: $items`Lil' Doctor™ bag` }),
      effects: () =>
        have($skill`Emotionally Chipped`) && get("_feelLostUsed") < 3 ? $effects`Feeling Lost` : [],
    },
  ),

  new FreeFight(
    () => !get("_gingerbreadMobHitUsed") && have($skill`Gingerbread Mob Hit`),
    () => {
      ensureBeachAccess();
      withMacro(
        Macro.trySingAlong()
          .tryHaveSkill($skill`Otoscope`)
          .trySkill($skill`Gingerbread Mob Hit`),
        () => use($item`drum machine`),
      );
    },
    true,
    {
      spec: sandwormSpec,
      effects: () =>
        have($skill`Emotionally Chipped`) && get("_feelLostUsed") < 3 ? $effects`Feeling Lost` : [],
    },
  ),

  new FreeFight(
    () => (have($skill`Shattering Punch`) ? clamp(3 - get("_shatteringPunchUsed"), 0, 3) : 0),
    () => {
      ensureBeachAccess();
      withMacro(
        Macro.trySingAlong()
          .tryHaveSkill($skill`Otoscope`)
          .trySkill($skill`Shattering Punch`),
        () => use($item`drum machine`),
      );
    },
    true,
    {
      spec: sandwormSpec,
      effects: () =>
        have($skill`Emotionally Chipped`) && get("_feelLostUsed") < 3 ? $effects`Feeling Lost` : [],
    },
  ),

  new FreeFight(
    () => (have($item`replica bat-oomerang`) ? clamp(3 - get("_usedReplicaBatoomerang"), 0, 3) : 0),
    () => {
      ensureBeachAccess();
      withMacro(
        Macro.trySingAlong()
          .tryHaveSkill($skill`Otoscope`)
          .item($item`replica bat-oomerang`),
        () => use($item`drum machine`),
      );
    },
    true,
    {
      spec: sandwormSpec,
      effects: () =>
        have($skill`Emotionally Chipped`) && get("_feelLostUsed") < 3 ? $effects`Feeling Lost` : [],
    },
  ),

  new FreeFight(
    () => !get("_missileLauncherUsed") && getCampground()["Asdon Martin keyfob"] !== undefined,
    () => {
      ensureBeachAccess();
      AsdonMartin.fillTo(100);
      withMacro(
        Macro.trySingAlong()
          .tryHaveSkill($skill`Otoscope`)
          .skill($skill`Asdon Martin: Missile Launcher`),
        () => use($item`drum machine`),
      );
    },
    true,
    {
      spec: sandwormSpec,
      effects: () =>
        have($skill`Emotionally Chipped`) && get("_feelLostUsed") < 3 ? $effects`Feeling Lost` : [],
    },
  ),

  new FreeFight(
    () => (globalOptions.ascend ? get("shockingLickCharges") : 0),
    () => {
      ensureBeachAccess();
      withMacro(
        Macro.trySingAlong()
          .tryHaveSkill($skill`Otoscope`)
          .skill($skill`Shocking Lick`),
        () => use($item`drum machine`),
      );
    },
    true,
    {
      spec: sandwormSpec,
      effects: () =>
        have($skill`Emotionally Chipped`) && get("_feelLostUsed") < 3 ? $effects`Feeling Lost` : [],
    },
  ),

  new FreeFight(
    () => have($item`Jurassic Parka`) && !have($effect`Everything Looks Yellow`),
    () => {
      ensureBeachAccess();
      cliExecute("parka dilophosaur");
      withMacro(
        Macro.trySingAlong()
          .tryHaveSkill($skill`Otoscope`)
          .trySkill($skill`Spit jurassic acid`),
        () => use($item`drum machine`),
      );
    },
    true,
    {
      spec: () => sandwormSpec({ equip: $items`Jurassic Parka` }),
      effects: () =>
        have($skill`Emotionally Chipped`) && get("_feelLostUsed") < 3 ? $effects`Feeling Lost` : [],
    },
  ),
];

function embezzlersInProgress(): boolean {
  return (
    get("beGregariousFightsLeft") > 0 ||
    get("_monsterHabitatsFightsLeft") > 0 ||
    !romanticMonsterImpossible() ||
    Counter.get("Digitize Monster") <= 0
  );
}

export function freeRunFights(): void {
  if (myInebriety() > inebrietyLimit()) return;
  if (embezzlersInProgress()) return;

  propertyManager.setChoices({
    1387: 2, // "You will go find two friends and meet me here."
    1324: 5, // Fight a random partier
  });

  const stashRun = stashAmount($item`navel ring of navel gazing`)
    ? $items`navel ring of navel gazing`
    : stashAmount($item`Greatest American Pants`)
    ? $items`Greatest American Pants`
    : [];
  refreshStash();

  withStash(stashRun, () => {
    for (const priorityRunFight of priorityFreeRunFightSources) {
      priorityRunFight.runAll();
    }
    for (const freeRunFightSource of freeRunFightSources) {
      freeRunFightSource.runAll();
    }
  });
}

export function freeFights(): void {
  if (myInebriety() > inebrietyLimit()) return;
  if (embezzlersInProgress()) return;

  propertyManager.setChoices({
    1387: 2, // "You will go find two friends and meet me here."
    1324: 5, // Fight a random partier
  });

  freeRunFights();

  killRobortCreaturesForFree();

  //  Use free fights on melanges if we have Tote/Squint and prices are reasonable.
  const canSquint =
    have($effect`Steely-Eyed Squint`) ||
    (have($skill`Steely-Eyed Squint`) && !get("_steelyEyedSquintUsed"));
  if (
    have($item`January's Garbage Tote`) &&
    canSquint &&
    mallPrice($item`drum machine`) < 0.02 * mallPrice($item`spice melange`)
  ) {
    try {
      for (const freeKillSource of freeKillSources) {
        if (freeKillSource.isAvailable()) {
          // TODO: Add potions that are profitable for free kills.
          ensureEffect($effect`Steely-Eyed Squint`);
        }

        freeKillSource.runAll();
      }
    } finally {
      if (have($item`January's Garbage Tote`)) cliExecute("fold wad of used tape");
    }
  }

  if (
    canAdventure($location`The Red Zeppelin`) &&
    !have($item`glark cable`, clamp(5 - get("_glarkCableUses"), 0, 5))
  ) {
    buy(
      clamp(5 - get("_glarkCableUses"), 0, 5),
      $item`glark cable`,
      globalOptions.prefs.valueOfFreeFight,
    );
  }

  for (const freeFightSource of freeFightSources) {
    freeFightSource.runAll();
  }

  tryFillLatte();
  postFreeFightDailySetup();
}

function setNepQuestChoicesAndPrepItems() {
  const quest = get("_questPartyFairQuest");

  if (quest === "food") {
    if (!questStep("_questPartyFair")) {
      setChoice(1324, 2); // Check out the kitchen
      setChoice(1326, 3); // Talk to the woman
    } else if (get("choiceAdventure1324") !== 5) {
      setChoice(1324, 5);
      print("Found Geraldine!", HIGHLIGHT);
      // Format of this property is count, space, item ID.
      const partyFairInfo = get("_questPartyFairProgress").split(" ");
      logMessage(`Geraldine wants ${partyFairInfo[0]} ${toItem(partyFairInfo[1]).plural}, please!`);
    }
  } else if (quest === "booze") {
    if (!questStep("_questPartyFair")) {
      setChoice(1324, 3); // Go to the back yard
      setChoice(1327, 3); // Find Gerald
    } else if (get("choiceAdventure1324") !== 5) {
      setChoice(1324, 5);
      print("Found Gerald!", HIGHLIGHT);
      const partyFairInfo = get("_questPartyFairProgress").split(" ");
      logMessage(`Gerald wants ${partyFairInfo[0]} ${toItem(partyFairInfo[1]).plural}, please!`);
    }
  } else {
    setChoice(1324, 5); // Pick a fight
  }
}

function thesisReady(): boolean {
  return (
    !get("_thesisDelivered") &&
    have($familiar`Pocket Professor`) &&
    $familiar`Pocket Professor`.experience >= 400
  );
}

export function deliverThesisIfAble(): void {
  if (!thesisReady()) return;
  freeFightMood().execute();
  freeFightOutfit({ modifier: ["100 Muscle"], familiar: $familiar`Pocket Professor` }).dress();
  safeRestore();

  const requiredThesisHP = 1296;

  let thesisLocation = $location`Uncle Gator's Country Fun-Time Liquid Waste Sluice`;
  let requiredMuscle = requiredThesisHP / 0.75 - 5;
  if (molemanReady()) {
    requiredMuscle = requiredThesisHP / 1.5 - 15;
    thesisLocation = $location`Noob Cave`; // We can trivially always adventure here
  } else if (
    (get("neverendingPartyAlways") || get("_neverEndingPartyToday")) &&
    questStep("_questPartyFair") < 999
  ) {
    // Set up NEP if we haven't yet
    setNepQuestChoicesAndPrepItems();
    thesisLocation = $location`The Neverending Party`;
    requiredMuscle = requiredThesisHP / 0.75 + 10;
  }
  // if running nobarf, might not have access to Uncle Gator's. Space is cheaper.
  else if (!canAdventure(thesisLocation)) {
    if (!have($item`transporter transponder`)) {
      acquire(1, $item`transporter transponder`, 10000);
    }
    use($item`transporter transponder`);
    thesisLocation = $location`Hamburglaris Shield Generator`;
    requiredMuscle = requiredThesisHP / 0.75 - 1;
  }

  if (
    myBuffedstat($stat`Muscle`) < requiredMuscle &&
    have($item`Powerful Glove`) &&
    !have($effect`Triple-Sized`) &&
    get("_powerfulGloveBatteryPowerUsed") <= 95 &&
    // We only get triple-sized if it doesn't lose us a replace enemy use
    (get("_powerfulGloveBatteryPowerUsed") % 10 === 5 || !doingGregFight())
  ) {
    cliExecute("checkpoint");
    equip($slot`acc1`, $item`Powerful Glove`);
    ensureEffect($effect`Triple-Sized`);
    outfit("checkpoint");
  }
  cliExecute(`gain ${requiredMuscle} muscle`);

  if (molemanReady()) {
    withMacro(Macro.skill($skill`deliver your thesis!`), () => use($item`molehill mountain`), true);
  } else {
    garboAdventure(thesisLocation, Macro.skill($skill`deliver your thesis!`));
  }
  postCombatActions();
}

export function doSausage(): void {
  if (!kramcoGuaranteed()) {
    return;
  }
  freeFightOutfit({ equip: $items`Kramco Sausage-o-Matic™` }).dress();
  const currentSausages = get("_sausageFights");
  do {
    propertyManager.setChoices(wanderer().getChoices("wanderer"));
    const goblin = $monster`sausage goblin`;
    freeFightOutfit(
      {
        equip: $items`Kramco Sausage-o-Matic™`,
      },
      { wanderOptions: "wanderer" },
    ).dress();
    garboAdventureAuto(
      wanderer().getTarget("wanderer"),
      Macro.if_(goblin, Macro.basicCombat())
        .ifHolidayWanderer(Macro.basicCombat())
        .abortWithMsg(`Expected ${goblin} but got something else.`),
    );
  } while (get("_sausageFights") === currentSausages); // Try again if we hit an NC that didn't take a turn
  if (getAutoAttack() !== 0) setAutoAttack(0);
  postCombatActions();
}

function doGhost() {
  if (!have($item`protonic accelerator pack`) || get("questPAGhost") === "unstarted") return;
  const ghostLocation = get("ghostLocation");
  if (!ghostLocation) return;
  freeFightOutfit({ equip: $items`protonic accelerator pack` }).dress();
  let currentTurncount;
  do {
    currentTurncount = myTurncount();
    garboAdventure(ghostLocation, Macro.ghostBustin());
  } while (get("ghostLocation") !== $location.none && currentTurncount === myTurncount());
  // Try again if we hit an NC that didn't take a turn
  postCombatActions();
}

function ensureBeachAccess() {
  if (
    get("lastDesertUnlock") !== myAscensions() &&
    myPath() !== $path`Actually Ed the Undying` /* Actually Ed the Undying*/
  ) {
    create($item`bitchin' meatcar`);
  }
}

type ItemStealZone = {
  item: Item;
  location: Location;
  monster: Monster | Monster[];
  dropRate: number;
  maximize: string[];
  requireMapTheMonsters: boolean; // When a zone has a choice we want to avoid
  isOpen: () => boolean;
  openCost: () => number;
  preReq: () => void;
};
const itemStealZones = [
  {
    location: $location`The Deep Dark Jungle`,
    monster: $monster`smoke monster`,
    item: $item`transdermal smoke patch`,
    dropRate: 1,
    maximize: [],
    requireMapTheMonsters: false,
    isOpen: () => get("_spookyAirportToday") || get("spookyAirportAlways"),
    openCost: () => 0,
    preReq: null,
  },
  {
    location: $location`The Ice Hotel`,
    monster: $monster`ice bartender`,
    item: $item`perfect ice cube`,
    dropRate: 1,
    maximize: [],
    requireMapTheMonsters: false,
    isOpen: () => get("_coldAirportToday") || get("coldAirportAlways"),
    openCost: () => 0,
    preReq: null,
  },
  {
    location: $location`The Haunted Library`,
    monster: $monster`bookbat`,
    item: $item`tattered scrap of paper`,
    dropRate: 1,
    maximize: ["99 monster level 100 max"], // Bookbats need up to +100 ML to survive the polar vortices
    requireMapTheMonsters: false,
    isOpen: () => have($item`[7302]Spookyraven library key`),
    openCost: () => 0,
    preReq: null,
  },
  {
    location: $location`The Stately Pleasure Dome`,
    monster: $monster`toothless mastiff bitch`,
    item: $item`disintegrating spiky collar`,
    dropRate: 1,
    maximize: ["99 muscle 100 max"], // Ensure mastiff is at least 100 hp
    requireMapTheMonsters: false,
    isOpen: () => true,
    openCost: () =>
      !have($effect`Absinthe-Minded`) ? mallPrice($item`tiny bottle of absinthe`) : 0,
    preReq: () => {
      if (!have($effect`Absinthe-Minded`)) {
        if (!have($item`tiny bottle of absinthe`)) buy(1, $item`tiny bottle of absinthe`);
        use($item`tiny bottle of absinthe`);
      }
    },
  },
  {
    location: $location`Twin Peak`,
    monster: $monsters`bearpig topiary animal, elephant (meatcar?) topiary animal, spider (duck?) topiary animal`,
    item: $item`rusty hedge trimmers`,
    dropRate: 0.5,
    maximize: ["99 monster level 11 max"], // Topiary animals need an extra 11 HP to survive polar vortices
    requireMapTheMonsters: false,
    isOpen: () =>
      myLevel() >= 9 && get("chasmBridgeProgress") >= 30 && get("twinPeakProgress") >= 15,
    openCost: () => 0,
    preReq: null,
  },
  {
    location: $location`The Hidden Temple`,
    monster: $monster`baa-relief sheep`,
    item: $item`stone wool`,
    requireMapTheMonsters: true,
    dropRate: 1,
    maximize: ["99 monster level 100 max"], // Sheeps need up to +100 ML to survive the polar vortices
    isOpen: () => get("lastTempleUnlock") === myAscensions(),
    openCost: () => 0,
    preReq: null,
  },
  ...$locations`Shadow Rift (The Ancient Buried Pyramid), Shadow Rift (The Hidden City), Shadow Rift (The Misspelled Cemetary)`.map(
    (location) => ({
      location,
      monster: $monster`shadow slab`,
      item: $item`shadow brick`,
      requireMapTheMonsters: false,
      dropRate: 1,
      isOpen: () => canAdventure(location),
      openCost: () => 0,
      preReq: null,
    }),
  ),
] as ItemStealZone[];

function getBestItemStealZone(mappingMonster = false): ItemStealZone | null {
  const targets = itemStealZones.filter(
    (zone) =>
      zone.isOpen() &&
      (mappingMonster || !zone.requireMapTheMonsters) &&
      asArray(zone.monster).some(
        (m) => !isBanished(m) || get("olfactedMonster") === m || get("_gallapagosMonster") === m,
      ),
  );
  const vorticesAvail = have($item`industrial fire extinguisher`)
    ? Math.floor(get("_fireExtinguisherCharge") / 10)
    : 0;
  const hugsAvail = have($familiar`XO Skeleton`) ? clamp(11 - get("_xoHugsUsed"), 0, 11) : 0;
  const value = (zone: ItemStealZone): number => {
    // We have to divide hugs by 2 - will likely use a banish as a free run so we will be alternating zones.
    return (
      zone.dropRate * garboValue(zone.item) * (vorticesAvail + hugsAvail / 2) - zone.openCost()
    );
  };
  return targets.length ? maxBy(targets, value) : null;
}

function setupItemStealZones() {
  // Haunted Library is full of free noncombats
  propertyManager.set({ lightsOutAutomation: 2 });
  propertyManager.setChoices({
    163: 4,
    164: 3,
    165: 4,
    166: 1,
    888: 4,
    889: 5,
  });
}

function itemStealOlfact(best: ItemStealZone) {
  return Macro.externalIf(
    have($skill`Transcendent Olfaction`) &&
      get("_olfactionsUsed") < 1 &&
      itemStealZones.every(
        (zone) => !asArray(zone.monster).includes(get("olfactedMonster") as Monster),
      ),
    Macro.skill($skill`Transcendent Olfaction`),
  ).externalIf(
    have($skill`Gallapagosian Mating Call`) && get("_gallapagosMonster") !== best.monster,
    Macro.skill($skill`Gallapagosian Mating Call`),
  );
}

const haveEnoughPills =
  clamp(availableAmount($item`synthetic dog hair pill`), 0, 100) +
    clamp(availableAmount($item`distention pill`), 0, 100) +
    availableAmount($item`Map to Safety Shelter Grimace Prime`) <
    200 && availableAmount($item`Map to Safety Shelter Grimace Prime`) < ESTIMATED_OVERDRUNK_TURNS;
function wantPills(): boolean {
  return have($item`Fourth of May Cosplay Saber`) && crateStrategy() !== "Saber" && haveEnoughPills;
}

function voidMonster(): void {
  if (
    get("cursedMagnifyingGlassCount") < 13 ||
    !have($item`cursed magnifying glass`) ||
    get("_voidFreeFights") >= 5
  ) {
    return;
  }

  freeFightOutfit(
    {
      equip: $items`cursed magnifying glass`,
    },
    { wanderOptions: "wanderer" },
  ).dress();
  propertyManager.setChoices(wanderer().getChoices("wanderer"));
  garboAdventure(wanderer().getTarget("wanderer"), Macro.basicCombat());
  postCombatActions();
}

type FreeKill = { spec?: OutfitSpec; macro: Skill | Item; used: () => boolean };
const freeKills: FreeKill[] = [
  {
    spec: { equip: $items`The Jokester's gun` },
    macro: $skill`Fire the Jokester's Gun`,
    used: () => get("_firedJokestersGun"),
  },
  {
    spec: { equip: $items`Lil' Doctor™ bag` },
    macro: $skill`Chest X-Ray`,
    used: () => get("_chestXRayUsed") >= 3,
  },
  { macro: $skill`Shattering Punch`, used: () => get("_shatteringPunchUsed") >= 3 },
  { macro: $skill`Gingerbread Mob Hit`, used: () => get("_gingerbreadMobHitUsed") },
  { macro: $item`replica bat-oomerang`, used: () => get("_usedReplicaBatoomerang") >= 3 },
];
const canUseSource = ({ spec, macro, used }: FreeKill) =>
  (spec?.equip?.every((i) => have(i)) ?? have(macro)) && !used();
function findFreeKill() {
  return freeKills.find(canUseSource) ?? null;
}

function killRobortCreaturesForFree() {
  if (!have($familiar`Robortender`)) return;

  const currentHeads = availableAmount($item`fish head`);
  let freeKill = findFreeKill();
  while (
    freeKill &&
    canAdventure($location`The Copperhead Club`) &&
    have($skill`Comprehensive Cartography`) &&
    get("_monstersMapped") < 3
  ) {
    if (have($effect`Crappily Disguised as a Waiter`)) {
      setChoice(855, 4);
      garboAdventure($location`The Copperhead Club`, Macro.abort());
    }
    freeFightOutfit({ ...freeKill.spec, familiar: $familiar`Robortender` }).dress();
    withMacro(
      freeKill.macro instanceof Item ? Macro.item(freeKill.macro) : Macro.skill(freeKill.macro),
      () => {
        mapMonster($location`The Copperhead Club`, $monster`Mob Penguin Capo`);
        runCombat();
      },
      true,
    );
    freeKill = findFreeKill();
  }

  while (freeKill && CombatLoversLocket.have() && CombatLoversLocket.reminiscesLeft() > 1) {
    const roboTarget = CombatLoversLocket.findMonster(
      () => true,
      (monster: Monster) =>
        valueDrops(monster) + garboValue(Robortender.dropFrom(monster)) * Robortender.dropChance(),
    );

    if (!roboTarget) break;
    const regularTarget = CombatLoversLocket.findMonster(() => true, valueDrops);
    const familiar =
      regularTarget === roboTarget
        ? freeFightFamiliar({ canChooseMacro: roboTarget.attributes.includes("FREE") })
        : $familiar`Robortender`;

    freeFightOutfit(
      roboTarget.attributes.includes("FREE") ? { familiar } : { ...freeKill.spec, familiar },
    ).dress();
    withMacro(
      isFree(roboTarget)
        ? Macro.basicCombat()
        : freeKill.macro instanceof Item
        ? Macro.item(freeKill.macro)
        : Macro.skill(freeKill.macro),
      () => CombatLoversLocket.reminisce(roboTarget),
      true,
    );
    freeKill = findFreeKill();
  }

  if (
    !Robortender.currentDrinks().includes($item`drive-by shooting`) &&
    availableAmount($item`fish head`) > currentHeads &&
    userConfirmDialog(
      "Garbo managed to rustle up a fish head, would you like it to use it to make a drive-by shooting so you can benefit from your robortender? Sorry for flip-flopping on this, life is hard.",
      true,
    )
  ) {
    if (!have($item`drive-by shooting`)) create($item`drive-by shooting`);
    Robortender.feed($item`drive-by shooting`);
    setBestLeprechaunAsMeatFamiliar();
  }
}

const isFree = (monster: Monster) => monster.attributes.includes("FREE");
const valueDrops = (monster: Monster) =>
  sum(itemDropsArray(monster), ({ drop, rate, type }) =>
    !["c", "0", "p"].includes(type) ? (garboValue(drop, true) * rate) / 100 : 0,
  );
const locketMonster = () => CombatLoversLocket.findMonster(isFree, valueDrops);

export function estimatedFreeFights(): number {
  return sum(freeFightSources, (source: FreeFight) => {
    const avail = source.available();
    return typeof avail === "number" ? avail : toInt(avail);
  });
}

export function estimatedTentacles(): number {
  return sum(freeFightSources, (source: FreeFight) => {
    const avail = source.tentacle ? source.available() : 0;
    return typeof avail === "number" ? avail : toInt(avail);
  });
}

function yachtzee(): void {
  if (!realmAvailable("sleaze") || !have($effect`Fishy`)) return;

  for (const { available, success } of [
    {
      available: have($item`Clara's bell`) && !globalOptions.clarasBellClaimed,
      success: () => {
        globalOptions.clarasBellClaimed = true;
        if (use($item`Clara's bell`)) return true;
        return false;
      },
    },
    {
      available: have($item`Eight Days a Week Pill Keeper`) && !get("_freePillKeeperUsed"),
      success: () => {
        if (cliExecute("pillkeeper noncombat") && get("_freePillKeeperUsed")) {
          // Defense against mis-set counters
          set("_freePillKeeperUsed", true);
          return true;
        }
        return false;
      },
    },
  ]) {
    if (available) {
      const familiarOptions = Familiar.all().filter(
        (familiar) => have(familiar) && familiar.underwater && familiar !== $familiar`Robortender`,
      );
      const familiarChoice = familiarOptions.length
        ? maxBy(familiarOptions, findLeprechaunMultiplier)
        : $familiar.none;
      useFamiliar(familiarChoice);

      const underwaterBreathingGear = waterBreathingEquipment.find(
        (item) => have(item) && canEquip(item),
      );
      if (!underwaterBreathingGear) return;
      const equippedOutfit = new Requirement(["meat", "-tie"], {
        forceEquip: [underwaterBreathingGear],
      }).maximize();
      if (haveEquipped($item`The Crown of Ed the Undying`)) cliExecute("edpiece fish");

      if (!equippedOutfit || !success()) return;

      const lastUMDDate = property.getString("umdLastObtained");
      const getUMD =
        !get("_sleazeAirportToday") && // We cannot get the UMD with a one-day pass
        garboValue($item`Ultimate Mind Destroyer`) >=
          2000 * (1 + numericModifier("meat drop") / 100) &&
        (!lastUMDDate || gameDay().getTime() - Date.parse(lastUMDDate) >= 1000 * 60 * 60 * 24 * 7);

      setChoice(918, getUMD ? 1 : 2);

      garboAdventureAuto($location`The Sunken Party Yacht`, Macro.abort());
      if (FloristFriar.have() && FloristFriar.Crookweed.available()) {
        FloristFriar.Crookweed.plant();
      }
      if (get("lastEncounter") === "Yacht, See?") {
        garboAdventureAuto($location`The Sunken Party Yacht`, Macro.abort());
      }
      return;
    }
  }
}

function runShadowRiftTurn(): void {
  // we can probably have a better name
  if (get("encountersUntilSRChoice") === 0) return;
  if (
    get("rufusQuestType") === "items" ||
    get("rufusQuestType") === "entity" // We can't handle bosses... yet
  ) {
    adv1(bestShadowRift(), -1, ""); // We shouldn't be using NC forcers
    return;
  }

  if (have($item`Clara's bell`) && !globalOptions.clarasBellClaimed) {
    globalOptions.clarasBellClaimed = true;
    use($item`Clara's bell`);
  } else if (CinchoDeMayo.have() && CinchoDeMayo.totalAvailableCinch() >= 60) {
    const lastAcc = equippedItem($slot`acc3`);
    equip($slot`acc3`, $item`Cincho de Mayo`);
    while (CinchoDeMayo.currentCinch() < 60) {
      if (!freeRest()) throw new Error("We are out of free rests!");
    }
    useSkill($skill`Cincho: Fiesta Exit`);
    equip($slot`acc3`, lastAcc); // Re-equip last item
  } else if (
    have($item`Jurassic Parka`) &&
    get("_spikolodonSpikeUses") < 5 &&
    have($effect`Shadow Affinity`) &&
    get("encountersUntilSRChoice") >= 2
  ) {
    freeFightOutfit({ shirt: $item`Jurassic Parka` }).dress();
    cliExecute("parka spikolodon");
    const macro = Macro.skill($skill`Launch spikolodon spikes`).basicCombat();
    garboAdventureAuto(bestShadowRift(), macro);
  } else {
    adv1(bestShadowRift(), -1, ""); // We wanted to use NC forcers, but none are suitable now
  }
}
