import {
  adv1,
  availableAmount,
  booleanModifier,
  buy,
  cliExecute,
  closetAmount,
  eat,
  equip,
  familiarWeight,
  getCampground,
  getCounters,
  handlingChoice,
  inebrietyLimit,
  isBanished,
  itemAmount,
  lastDecision,
  mallPrice,
  meatDropModifier,
  myAscensions,
  myClass,
  myFamiliar,
  myHash,
  myHp,
  myInebriety,
  myMaxhp,
  myMaxmp,
  myMp,
  myPathId,
  mySpleenUse,
  numericModifier,
  outfit,
  print,
  putCloset,
  refreshStash,
  restoreHp,
  restoreMp,
  retrieveItem,
  runChoice,
  runCombat,
  setAutoAttack,
  setLocation,
  spleenLimit,
  stashAmount,
  takeCloset,
  toInt,
  toItem,
  totalTurnsPlayed,
  toUrl,
  use,
  useFamiliar,
  userConfirm,
  useSkill,
  visitUrl,
  weightAdjustment,
} from "kolmafia";
import {
  $class,
  $effect,
  $familiar,
  $item,
  $items,
  $location,
  $locations,
  $monster,
  $monsters,
  $phyla,
  $skill,
  $slot,
  adventureMacro,
  adventureMacroAuto,
  ChateauMantegna,
  clamp,
  ensureEffect,
  get,
  getSaleValue,
  have,
  maximizeCached,
  property,
  Requirement,
  set,
  SourceTerminal,
  TunnelOfLove,
  Witchess,
} from "libram";
import { acquire } from "./acquire";
import { fillAsdonMartinTo } from "./asdon";
import { withStash } from "./clan";
import { Macro, withMacro } from "./combat";
import { horseradish } from "./diet";
import { freeFightFamiliar, meatFamiliar } from "./familiar";
import {
  baseMeat,
  findRun,
  FreeRun,
  kramcoGuaranteed,
  logMessage,
  ltbRun,
  mapMonster,
  propertyManager,
  questStep,
  safeInterrupt,
  setChoice,
} from "./lib";
import { freeFightMood, meatMood } from "./mood";
import {
  familiarWaterBreathingEquipment,
  freeFightOutfit,
  meatOutfit,
  tryFillLatte,
  waterBreathingEquipment,
} from "./outfit";
import { bathroomFinance } from "./potions";
import { globalOptions, log } from "./globalvars";
import {
  embezzlerCount,
  EmbezzlerFight,
  embezzlerMacro,
  embezzlerSources,
  estimatedTurns,
} from "./embezzler";
import { canAdv } from "canadv.ash";
import { determineDraggableZoneAndEnsureAccess, draggableFight } from "./wanderer";

const firstChainMacro = () =>
  Macro.if_(
    "monstername Knob Goblin Embezzler",
    Macro.if_(
      "!hasskill Lecture on Relativity",
      Macro.externalIf(
        get("_sourceTerminalDigitizeMonster") !== $monster`Knob Goblin Embezzler`,
        Macro.tryCopier($skill`Digitize`)
      )
        .tryCopier($item`Spooky Putty sheet`)
        .tryCopier($item`Rain-Doh black box`)
        .tryCopier($item`4-d camera`)
        .tryCopier($item`unfinished ice sculpture`)
        .externalIf(get("_enamorangs") === 0, Macro.tryCopier($item`LOV Enamorang`))
    )
      .trySkill($skill`lecture on relativity`)
      .meatKill()
  ).abort();

const secondChainMacro = () =>
  Macro.if_(
    "monstername Knob Goblin Embezzler",
    Macro.externalIf(
      myFamiliar() === $familiar`Pocket Professor`,
      Macro.if_("!hasskill Lecture on Relativity", Macro.trySkill($skill`Meteor Shower`))
        .if_(
          "!hasskill Lecture on Relativity",
          Macro.externalIf(
            get("_sourceTerminalDigitizeMonster") !== $monster`Knob Goblin Embezzler`,
            Macro.tryCopier($skill`Digitize`)
          )
            .tryCopier($item`Spooky Putty sheet`)
            .tryCopier($item`Rain-Doh black box`)
            .tryCopier($item`4-d camera`)
            .tryCopier($item`unfinished ice sculpture`)
            .externalIf(get("_enamorangs") === 0, Macro.tryCopier($item`LOV Enamorang`))
        )
        .trySkill($skill`lecture on relativity`)
    ).meatKill()
  ).abort();

function embezzlerSetup() {
  meatMood(true, true).execute(estimatedTurns());
  safeRestore();
  if (mySpleenUse() < spleenLimit()) ensureEffect($effect`Eau d' Clochard`);
  if (mySpleenUse() < spleenLimit() && have($item`body spradium`)) {
    ensureEffect($effect`Boxing Day Glow`);
  }
  freeFightMood().execute(50);
  withStash($items`Platinum Yendorian Express Card, Bag o' Tricks`, () => {
    if (have($item`Platinum Yendorian Express Card`) && !get("expressCardUsed")) {
      use($item`Platinum Yendorian Express Card`);
    }
    if (have($item`Bag o' Tricks`) && !get("_bagOTricksUsed")) {
      use($item`Bag o' Tricks`);
    }
  });
  if (have($item`License to Chill`) && !get("_licenseToChillUsed")) use($item`License to Chill`);
  if (
    globalOptions.ascending &&
    questStep("questM16Temple") > 0 &&
    get("lastTempleAdventures") < myAscensions() &&
    acquire(1, $item`stone wool`, 3 * get("valueOfAdventure") + 100, false) > 0
  ) {
    ensureEffect($effect`Stone-Faced`);
    setChoice(582, 1);
    setChoice(579, 3);
    while (get("lastTempleAdventures") < myAscensions()) {
      const runSource = findRun() || ltbRun;
      if (!runSource) break;
      if (runSource.prepare) runSource.prepare();
      freeFightOutfit(runSource.requirement ? [runSource.requirement] : []);
      adventureMacro($location`The Hidden Temple`, runSource.macro);
    }
  }

  bathroomFinance(embezzlerCount());

  const averageEmbezzlerNet = ((baseMeat + 750) * meatDropModifier()) / 100;
  const averageTouristNet = (baseMeat * meatDropModifier()) / 100;

  if (SourceTerminal.have()) SourceTerminal.educate([$skill`Extract`, $skill`Digitize`]);
  if (
    !get("_cameraUsed") &&
    !have($item`shaking 4-d camera`) &&
    averageEmbezzlerNet - averageTouristNet > mallPrice($item`4-d camera`)
  ) {
    property.withProperty("autoSatisfyWithCloset", true, () => retrieveItem($item`4-d camera`));
  }

  if (
    !get("_iceSculptureUsed") &&
    !have($item`ice sculpture`) &&
    averageEmbezzlerNet - averageTouristNet >
      mallPrice($item`snow berries`) + mallPrice($item`ice harvest`) * 3
  ) {
    property.withProperty("autoSatisfyWithCloset", true, () => {
      cliExecute("refresh inventory");
      retrieveItem($item`unfinished ice sculpture`);
    });
  }

  if (!get("_enamorangs") && !itemAmount($item`LOV Enamorang`) && averageEmbezzlerNet > 20000) {
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
}

function getEmbezzlerFight(): EmbezzlerFight | null {
  for (const fight of embezzlerSources) {
    if (fight.available()) return fight;
  }
  const potential = embezzlerCount();
  const averageEmbezzlerNet = ((baseMeat + 750) * meatDropModifier()) / 100;
  if (potential > 0) {
    print(`You have the following embezzler-sources untapped right now:`, "blue");
    embezzlerSources
      .filter((source) => !source.available() && source.potential() > 0)
      .map((source) => `${source.potential()} from ${source.name}`)
      .forEach((text) => print(text, "blue"));
    if (
      (1 + potential) * (averageEmbezzlerNet - get("valueOfAdventure")) > 50000 &&
      get("_genieFightsUsed") < 3 &&
      userConfirm(
        `Garbo has detected you have ${potential} potential ways to copy an Embezzler, but no way to start a fight with one. Should we wish for an Embezzler?`
      )
    ) {
      return new EmbezzlerFight(
        "Pocket Wish",
        () => false,
        () => 0,
        () => {
          retrieveItem($item`pocket wish`);
          visitUrl(`inv_use.php?pwd=${myHash()}&which=3&whichitem=9537`, false, true);
          visitUrl(
            "choice.php?pwd&whichchoice=1267&option=1&wish=to fight a Knob Goblin Embezzler ",
            true,
            true
          );
          visitUrl("main.php", false);
          runCombat();
        }
      );
    }
  }
  return null;
}

function startWandererCounters() {
  let n = 0;
  if (
    getCounters("Digitize Monster", 0, 0).trim() === "" &&
    getCounters("Enamorang Monster", 0, 0).trim() === "" &&
    ((getCounters("Digitize Monster", 0, 100).trim() === "" &&
      get("_sourceTerminalDigitizeUses") !== 0) ||
      (getCounters("Enamorang Monster", 0, 100).trim() === "" && get("enamorangMonster")))
  ) {
    do {
      const run = findRun() || ltbRun;
      if (run.prepare) run.prepare();
      freeFightOutfit(run.requirement ? [run.requirement] : []);
      adventureMacro($location`Noob Cave`, run.macro);
      n++;
    } while (get("lastCopyableMonster") !== $monster`crate` && n < 3);
  }
}
const witchessPieces = [
  { piece: $monster`Witchess Bishop`, drop: $item`Sacramento wine` },
  { piece: $monster`Witchess Knight`, drop: $item`jumping horseradish` },
  { piece: $monster`Witchess Pawn`, drop: $item`armored prawn` },
  { piece: $monster`Witchess Rook`, drop: $item`Greek fire` },
];

function bestWitchessPiece() {
  return witchessPieces.sort((a, b) => getSaleValue(b.drop) - getSaleValue(a.drop))[0].piece;
}

export function dailyFights(): void {
  if (myInebriety() > inebrietyLimit()) return;
  if (embezzlerSources.some((source) => source.potential())) {
    withStash($items`Spooky Putty sheet`, () => {
      embezzlerSetup();

      // FIRST EMBEZZLER CHAIN
      if (have($familiar`Pocket Professor`) && !get<boolean>("_garbo_meatChain", false)) {
        const startLectures = get("_pocketProfessorLectures");
        const fightSource = getEmbezzlerFight();
        if (!fightSource) return;
        useFamiliar($familiar`Pocket Professor`);
        meatOutfit(true, [
          ...fightSource.requirements,
          new Requirement([], { forceEquip: $items`Pocket Professor memory chip` }),
        ]);
        if (
          get("_pocketProfessorLectures") <
          2 + Math.ceil(Math.sqrt(familiarWeight(myFamiliar()) + weightAdjustment()))
        ) {
          withMacro(firstChainMacro(), () =>
            fightSource.run({
              location: determineDraggableZoneAndEnsureAccess(),
              macro: firstChainMacro(),
            })
          );
          horseradish();
          log.initialEmbezzlersFought += 1 + get("_pocketProfessorLectures") - startLectures;
        }
        set("_garbo_meatChain", true);
        safeInterrupt();
      }

      startWandererCounters();

      // SECOND EMBEZZLER CHAIN
      if (have($familiar`Pocket Professor`) && !get<boolean>("_garbo_weightChain", false)) {
        const startLectures = get("_pocketProfessorLectures");
        const fightSource = getEmbezzlerFight();
        if (!fightSource) return;
        useFamiliar($familiar`Pocket Professor`);
        const requirements = Requirement.merge([
          new Requirement(["Familiar Weight"], {
            forceEquip: $items`Pocket Professor memory chip`,
          }),
          ...fightSource.requirements,
        ]);
        maximizeCached(requirements.maximizeParameters, requirements.maximizeOptions);
        if (
          get("_pocketProfessorLectures") <
          2 + Math.ceil(Math.sqrt(familiarWeight(myFamiliar()) + weightAdjustment()))
        ) {
          withMacro(secondChainMacro(), () =>
            fightSource.run({
              location: determineDraggableZoneAndEnsureAccess(),
              macro: secondChainMacro(),
            })
          );
          horseradish();
          log.initialEmbezzlersFought += 1 + get("_pocketProfessorLectures") - startLectures;
        }
        set("_garbo_weightChain", true);
        safeInterrupt();
      }

      startWandererCounters();

      // REMAINING EMBEZZLER FIGHTS
      let nextFight = getEmbezzlerFight();
      while (nextFight !== null) {
        const startTurns = totalTurnsPlayed();
        if (have($skill`Musk of the Moose`) && !have($effect`Musk of the Moose`))
          useSkill($skill`Musk of the Moose`);
        withMacro(embezzlerMacro(), () => {
          if (nextFight) {
            useFamiliar(meatFamiliar());
            if (
              (have($familiar`Reanimated Reanimator`) || have($familiar`Obtuse Angel`)) &&
              get("_badlyRomanticArrows") === 0 &&
              !nextFight.draggable
            ) {
              if (have($familiar`Obtuse Angel`)) useFamiliar($familiar`Obtuse Angel`);
              else useFamiliar($familiar`Reanimated Reanimator`);
            }

            if (
              nextFight.draggable &&
              !get("_envyfishEggUsed") &&
              (booleanModifier("Adventure Underwater") || waterBreathingEquipment.some(have)) &&
              (booleanModifier("Underwater Familiar") ||
                familiarWaterBreathingEquipment.some(have)) &&
              (have($effect`Fishy`) || (have($item`fishy pipe`) && !get("_fishyPipeUsed"))) &&
              !have($item`envyfish egg`)
            ) {
              setLocation($location`The Briny Deeps`);
              meatOutfit(true, nextFight.requirements, true);
              if (get("questS01OldGuy") === "unstarted") {
                visitUrl("place.php?whichplace=sea_oldman&action=oldman_oldman");
              }
              retrieveItem($item`pulled green taffy`);
              if (!have($effect`Fishy`)) use($item`fishy pipe`);
              nextFight.run({ location: $location`The Briny Deeps` });
              horseradish();
            } else if (nextFight.draggable) {
              const type =
                nextFight.name === "Backup" ? draggableFight.BACKUP : draggableFight.WANDERER;
              const location = determineDraggableZoneAndEnsureAccess(type);
              setLocation(location);
              meatOutfit(true, nextFight.requirements);
              nextFight.run({ location });
              horseradish();
            } else {
              setLocation($location`Noob Cave`);
              meatOutfit(true, nextFight.requirements);
              nextFight.run({ location: $location`Noob Cave` });
              horseradish();
            }
          }
        });
        if (
          totalTurnsPlayed() - startTurns === 1 &&
          get("lastCopyableMonster") === $monster`Knob Goblin Embezzler` &&
          (nextFight.name === "Backup" || get("lastEncounter") === "Knob Goblin Embezzler")
        ) {
          log.initialEmbezzlersFought++;
        }
        startWandererCounters();
        nextFight = getEmbezzlerFight();
        if (
          kramcoGuaranteed() &&
          !(nextFight && ["Backup", "Digitize", "Enamorang"].includes(nextFight.name))
        ) {
          doSausage();
        }
        safeInterrupt();
      }

      // Check in case our prof gained enough exp during the profchains
      if (thesisReady()) deliverThesis();
    });
  }
}

type FreeFightOptions = {
  cost?: () => number;
  familiar?: () => Familiar | null;
  requirements?: () => Requirement[];
};

let bestNonCheerleaderFairy: Familiar;

function bestFairy() {
  if (have($familiar`Trick-or-Treating Tot`) && have($item`li'l ninja costume`))
    return $familiar`Trick-or-Treating Tot`;
  if (get("_cheerleaderSteam") > 100 && have($familiar`Steam-Powered Cheerleader`))
    return $familiar`Steam-Powered Cheerleader`;

  if (!bestNonCheerleaderFairy) {
    setLocation($location`Noob Cave`);
    const bestNonCheerleaderFairies = Familiar.all()
      .filter((familiar) => have(familiar) && familiar !== $familiar`Steam-Powered Cheerleader`)
      .sort(
        (a, b) =>
          numericModifier(b, "Fairy", 1, $item`none`) - numericModifier(a, "Fairy", 1, $item`none`)
      );
    const bestFairyMult = numericModifier(bestNonCheerleaderFairies[0], "Fairy", 1, $item`none`);
    bestNonCheerleaderFairy = bestNonCheerleaderFairies
      .filter((fairy) => numericModifier(fairy, "Fairy", 1, $item`none`) === bestFairyMult)
      .sort(
        (a, b) =>
          numericModifier(b, "Leprechaun", 1, $item`none`) -
          numericModifier(a, "Leprechaun", 1, $item`none`)
      )[0];
  }
  return bestNonCheerleaderFairy;
}

class FreeFight {
  available: () => number | boolean;
  run: () => void;
  options: FreeFightOptions;

  constructor(available: () => number | boolean, run: () => void, options: FreeFightOptions = {}) {
    this.available = available;
    this.run = run;
    this.options = options;
  }

  runAll() {
    if (!this.available()) return;
    if ((this.options.cost ? this.options.cost() : 0) > get("garbo_valueOfFreeFight", 2000)) return;
    while (this.available()) {
      useFamiliar(
        this.options.familiar ? this.options.familiar() ?? freeFightFamiliar() : freeFightFamiliar()
      );
      freeFightMood().execute();
      freeFightOutfit(this.options.requirements ? this.options.requirements() : []);
      safeRestore();
      withMacro(Macro.basicCombat(), this.run);
      horseradish();
      // Slot in our Professor Thesis if it's become available
      if (thesisReady()) deliverThesis();
      safeInterrupt();
    }
  }
}

class FreeRunFight extends FreeFight {
  freeRun: (runSource: FreeRun) => void;

  constructor(
    available: () => number | boolean,
    run: (runSource: FreeRun) => void,
    options: FreeFightOptions = {}
  ) {
    super(available, () => null, options);
    this.freeRun = run;
  }

  runAll() {
    if (!this.available()) return;
    if ((this.options.cost ? this.options.cost() : 0) > get("garbo_valueOfFreeFight", 2000)) return;
    while (this.available()) {
      const runSource = findRun(this.options.familiar ? false : true);
      if (!runSource) break;
      useFamiliar(
        this.options.familiar ? this.options.familiar() ?? freeFightFamiliar() : freeFightFamiliar()
      );
      if (runSource.prepare) runSource.prepare();
      freeFightOutfit([
        ...(this.options.requirements ? this.options.requirements() : []),
        ...(runSource.requirement ? [runSource.requirement] : []),
      ]);
      safeRestore();
      withMacro(Macro.step(runSource.macro), () => this.freeRun(runSource));
      safeInterrupt();
    }
  }
}

const pygmyMacro = Macro.if_(
  "monstername pygmy bowler",
  Macro.trySkill($skill`Snokebomb`).item($item`Louder Than Bomb`)
)
  .if_(
    "monstername pygmy orderlies",
    Macro.trySkill($skill`Feel Hatred`).item($item`divine champagne popper`)
  )
  .if_("monstername pygmy janitor", Macro.item($item`tennis ball`))
  .if_("monstername time-spinner prank", Macro.basicCombat())
  .abort();

function getStenchLocation() {
  return (
    $locations`Barf Mountain, The Hippy Camp (Bombed Back to the Stone Age), The Dark and Spooky Swamp`.find(
      (l) => canAdv(l, false)
    ) || $location`none`
  );
}

const freeFightSources = [
  // Get a Fish Head from our robortender if available
  new FreeFight(
    () =>
      have($item`Cargo Cultist Shorts`) &&
      have($familiar`Robortender`) &&
      !get("_cargoPocketEmptied") &&
      String(get("cargoPocketsEmptied", "")).indexOf("428") === -1,
    () => cliExecute("cargo monster Mob Penguin Thug"),
    {
      familiar: () => $familiar`Robortender`,
    }
  ),

  new FreeFight(
    () => TunnelOfLove.have() && !TunnelOfLove.isUsed(),
    () => {
      TunnelOfLove.fightAll(
        "LOV Epaulettes",
        "Open Heart Surgery",
        "LOV Extraterrestrial Chocolate"
      );

      visitUrl("choice.php");
      if (handlingChoice()) throw "Did not get all the way through LOV.";
    }
  ),

  new FreeFight(
    () =>
      ChateauMantegna.have() &&
      !ChateauMantegna.paintingFought() &&
      (ChateauMantegna.paintingMonster()?.attributes?.includes("FREE") ?? false),
    () => ChateauMantegna.fightPainting(),
    {
      familiar: () =>
        have($familiar`Robortender`) &&
        $phyla`elf, fish, hobo, penguin, constellation`.some(
          (phylum) => phylum === ChateauMantegna.paintingMonster()?.phylum
        )
          ? $familiar`Robortender`
          : null,
    }
  ),

  new FreeFight(
    () => get("questL02Larva") !== "unstarted" && !get("_eldritchTentacleFought"),
    () => {
      const haveEldritchEssence = itemAmount($item`eldritch essence`) !== 0;
      visitUrl("place.php?whichplace=forestvillage&action=fv_scientist", false);
      if (!handlingChoice()) throw "No choice?";
      runChoice(haveEldritchEssence ? 2 : 1);
    }
  ),

  new FreeFight(
    () => have($skill`Evoke Eldritch Horror`) && !get("_eldritchHorrorEvoked"),
    () => useSkill($skill`Evoke Eldritch Horror`)
  ),

  new FreeFight(
    () => clamp(3 - get("_lynyrdSnareUses"), 0, 3),
    () => use($item`lynyrd snare`),
    {
      cost: () => mallPrice($item`lynyrd snare`),
    }
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
              2000,
            Macro.item([$item`gas can`, $item`gas can`])
          )
          .externalIf(
            get("lovebugsUnlocked"),
            Macro.trySkill($skill`Summon Love Gnats`).trySkill($skill`Summon Love Mosquito`)
          )
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
          if (have($skill`Ruthless Efficiency`)) ensureEffect($effect`Ruthlessly Efficient`);
          if (have($skill`Mathematical Precision`)) ensureEffect($effect`Mathematically Precise`);
          if (have($skill`Blood Bubble`)) ensureEffect($effect`Blood Bubble`);
          retrieveItem($item`[glitch season reward name]`);
          if (get("glitchItemImplementationCount") >= 1000) retrieveItem($item`gas can`, 2);
          visitUrl("inv_eat.php?pwd&whichitem=10207");
          runCombat();
        }
      ),
    {
      requirements: () => [new Requirement(["1000 mainstat"], {})],
    }
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
        $item`seal-blubber candle`
      );
      withMacro(
        Macro.startCombat()
          .trySkill($skill`Furious Wallop`)
          .while_("hasskill Lunging Thrust-Smack", Macro.skill($skill`Lunging Thrust-Smack`))
          .while_("hasskill Thrust-Smack", Macro.skill($skill`Thrust-Smack`))
          .while_("hasskill Lunge Smack", Macro.skill($skill`Lunge Smack`))
          .attack()
          .repeat(),
        () => use(figurine)
      );
    },
    {
      requirements: () => [new Requirement(["Club"], {})],
    }
  ),

  new FreeFight(
    () => clamp(10 - get("_brickoFights"), 0, 10),
    () => use($item`BRICKO ooze`),
    {
      cost: () => mallPrice($item`BRICKO eye brick`) + 2 * mallPrice($item`BRICKO brick`),
    }
  ),

  //Initial 9 Pygmy fights
  new FreeFight(
    () =>
      get("questL11Worship") !== "unstarted" ? clamp(9 - get("_drunkPygmyBanishes"), 0, 9) : 0,
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem(clamp(9 - get("_drunkPygmyBanishes"), 0, 9), $item`Bowl of Scorpions`);
      retrieveItem($item`Louder Than Bomb`);
      retrieveItem($item`tennis ball`);
      retrieveItem($item`divine champagne popper`);
      adventureMacro($location`The Hidden Bowling Alley`, pygmyMacro);
    },
    {
      requirements: () => [
        new Requirement([], {
          preventEquip: $items`Staff of Queso Escusado, stinky cheese sword`,
          bonusEquip: new Map([[$item`garbage sticker`, 100]]),
        }),
      ],
    }
  ),

  //10th Pygmy fight. If we have an orb, equip it for this fight, to save for later
  new FreeFight(
    () => get("questL11Worship") !== "unstarted" && get("_drunkPygmyBanishes") === 9,
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem($item`Bowl of Scorpions`);
      adventureMacro($location`The Hidden Bowling Alley`, pygmyMacro);
    },
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: $items`miniature crystal ball`.filter((item) => have(item)),
          preventEquip: $items`Staff of Queso Escusado, stinky cheese sword`,
          bonusEquip: new Map([[$item`garbage sticker`, 100]]),
        }),
      ],
    }
  ),

  //11th pygmy fight if we lack a saber
  new FreeFight(
    () =>
      get("questL11Worship") !== "unstarted" &&
      get("_drunkPygmyBanishes") === 10 &&
      !have($item`Fourth of May Cosplay Saber`),
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem($item`Bowl of Scorpions`);
      adventureMacro($location`The Hidden Bowling Alley`, pygmyMacro);
    },
    {
      requirements: () => [
        new Requirement([], { preventEquip: $items`Staff of Queso Escusado, stinky cheese sword` }),
      ],
    }
  ),

  //11th+ pygmy fight if we have a saber- saber friends
  new FreeFight(
    () => {
      const rightTime =
        have($item`Fourth of May Cosplay Saber`) && get("_drunkPygmyBanishes") >= 10;
      const saberedMonster = get("_saberForceMonster");
      const wrongPygmySabered =
        saberedMonster &&
        $monsters`pygmy orderlies, pygmy bowler, pygmy janitor`.includes(saberedMonster);
      const drunksCanAppear =
        get("_drunkPygmyBanishes") === 10 ||
        (saberedMonster === $monster`drunk pygmy` && get("_saberForceMonsterCount"));
      const remainingSaberPygmies =
        (saberedMonster === $monster`drunk pygmy` ? get("_saberForceMonsterCount") : 0) +
        2 * clamp(5 - get("_saberForceUses"), 0, 5);
      return (
        get("questL11Worship") !== "unstarted" &&
        rightTime &&
        !wrongPygmySabered &&
        drunksCanAppear &&
        remainingSaberPygmies
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
        adventureMacro($location`The Hidden Bowling Alley`, Macro.skill($skill`Use the Force`));
      } else {
        if (closetAmount($item`Bowl of Scorpions`) > 0)
          takeCloset(closetAmount($item`Bowl of Scorpions`), $item`Bowl of Scorpions`);
        else retrieveItem($item`Bowl of Scorpions`);
        adventureMacro($location`The Hidden Bowling Alley`, pygmyMacro);
      }
    },
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: $items`Fourth of May Cosplay Saber`,
          bonusEquip: new Map([[$item`garbage sticker`, 100]]),
          preventEquip: $items`Staff of Queso Escusado, stinky cheese sword`,
        }),
      ],
    }
  ),

  //Finally, saber or not, if we have a drunk pygmy in our crystal ball, let it out.
  new FreeFight(
    () =>
      get("questL11Worship") !== "unstarted" &&
      get("crystalBallMonster") === $monster`drunk pygmy` &&
      get("_drunkPygmyBanishes") >= 11,
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem(1, $item`Bowl of Scorpions`);
      adventureMacro($location`The Hidden Bowling Alley`, Macro.abort());
    },
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: $items`miniature crystal ball`.filter((item) => have(item)),
          bonusEquip: new Map([[$item`garbage sticker`, 100]]),
          preventEquip: $items`Staff of Queso Escusado, stinky cheese sword`,
        }),
      ],
    }
  ),

  new FreeFight(
    () =>
      have($item`Time-Spinner`) &&
      $location`The Hidden Bowling Alley`.combatQueue.includes("drunk pygmy") &&
      get("_timeSpinnerMinutesUsed") < 8,
    () => {
      retrieveItem($item`Bowl of Scorpions`);
      Macro.trySkill($skill`Extract`).trySkill($skill`Sing Along`).setAutoAttack;
      visitUrl(`inv_use.php?whichitem=${toInt($item`Time-Spinner`)}`);
      runChoice(1);
      visitUrl(`choice.php?whichchoice=1196&monid=${$monster`drunk pygmy`.id}&option=1`);
    },
    {
      requirements: () => [
        new Requirement([], {
          bonusEquip: new Map([[$item`garbage sticker`, 100]]),
          preventEquip: $items`Staff of Queso Escusado, stinky cheese sword`,
        }),
      ],
    }
  ),

  new FreeFight(
    () => get("_sausageFights") === 0 && have($item`Kramco Sausage-o-Matic™`),
    () => adv1(determineDraggableZoneAndEnsureAccess(), -1, ""),
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: $items`Kramco Sausage-o-Matic™`,
        }),
      ],
    }
  ),

  new FreeFight(
    () =>
      get("questL11Ron") === "finished"
        ? clamp(5 - get("_glarkCableUses"), 0, itemAmount($item`glark cable`))
        : 0,
    () => {
      adventureMacro($location`The Red Zeppelin`, Macro.item($item`glark cable`));
    }
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
      adventureMacro(
        $location`Your Mushroom Garden`,
        Macro.if_("hasskill macrometeorite", Macro.trySkill($skill`Portscan`)).basicCombat()
      );
      if (have($item`packet of tall grass seeds`)) use($item`packet of tall grass seeds`);
    },
    {
      familiar: () => (have($familiar`Robortender`) ? $familiar`Robortender` : null),
    }
  ),

  // Portscan and mushroom garden
  new FreeFight(
    () =>
      (have($item`packet of mushroom spores`) ||
        getCampground()["packet of mushroom spores"] !== undefined) &&
      getCounters("portscan.edu", 0, 0) === "portscan.edu" &&
      have($skill`Macrometeorite`) &&
      get("_macrometeoriteUses") < 10,
    () => {
      if (have($item`packet of mushroom spores`)) use($item`packet of mushroom spores`);
      if (SourceTerminal.have()) {
        SourceTerminal.educate([$skill`Extract`, $skill`Portscan`]);
      }
      adventureMacro(
        $location`Your Mushroom Garden`,
        Macro.if_("monstername government agent", Macro.skill($skill`Macrometeorite`)).if_(
          "monstername piranha plant",
          Macro.if_("hasskill macrometeorite", Macro.trySkill($skill`Portscan`)).basicCombat()
        )
      );
      if (have($item`packet of tall grass seeds`)) use($item`packet of tall grass seeds`);
    }
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
    {
      familiar: () => $familiar`God Lobster`,
      requirements: () => [
        new Requirement([], {
          bonusEquip: new Map<Item, number>([
            [$item`God Lobster's Scepter`, 1000],
            [$item`God Lobster's Ring`, 2000],
            [$item`God Lobster's Rod`, 3000],
            [$item`God Lobster's Robe`, 4000],
            [$item`God Lobster's Crown`, 5000],
          ]),
        }),
      ],
    }
  ),

  new FreeFight(
    () => (have($familiar`Machine Elf`) ? clamp(5 - get("_machineTunnelsAdv"), 0, 5) : 0),
    () => {
      propertyManager.setChoices({
        1119: 6, //escape DMT
      });
      const thought =
        getSaleValue($item`abstraction: certainty`) >= getSaleValue($item`abstraction: thought`);
      const action =
        getSaleValue($item`abstraction: joy`) >= getSaleValue($item`abstraction: action`);
      const sensation =
        getSaleValue($item`abstraction: motion`) >= getSaleValue($item`abstraction: sensation`);

      if (thought) {
        acquire(1, $item`abstraction: thought`, getSaleValue($item`abstraction: certainty`), false);
      }
      if (action) {
        acquire(1, $item`abstraction: action`, getSaleValue($item`abstraction: joy`), false);
      }
      if (sensation) {
        acquire(1, $item`abstraction: sensation`, getSaleValue($item`abstraction: motion`), false);
      }
      adventureMacro(
        $location`The Deep Machine Tunnels`,
        Macro.externalIf(
          thought,
          Macro.if_(
            "monstername Perceiver of Sensations",
            Macro.tryItem($item`abstraction: thought`)
          )
        )
          .externalIf(
            action,
            Macro.if_("monstername Thinker of Thoughts", Macro.tryItem($item`abstraction: action`))
          )
          .externalIf(
            sensation,
            Macro.if_(
              "monstername Performer of Actions",
              Macro.tryItem($item`abstraction: sensation`)
            )
          )
          .basicCombat()
      );
    },
    {
      familiar: () => $familiar`Machine Elf`,
    }
  ),

  // 28	5	0	0	Witchess pieces	must have a Witchess Set; can copy for more
  new FreeFight(
    () => (Witchess.have() ? clamp(5 - Witchess.fightsDone(), 0, 5) : 0),
    () => Witchess.fightPiece(bestWitchessPiece())
  ),

  new FreeFight(
    () => get("snojoAvailable") && clamp(10 - get("_snojoFreeFights"), 0, 10),
    () => {
      if (get("snojoSetting", "NONE") === "NONE") {
        visitUrl("place.php?whichplace=snojo&action=snojo_controller");
        runChoice(3);
      }
      adv1($location`The X-32-F Combat Training Snowman`, -1, "");
    }
  ),

  new FreeFight(
    () =>
      get("neverendingPartyAlways") && questStep("_questPartyFair") < 999
        ? clamp(10 - get("_neverendingPartyFreeTurns"), 0, 10)
        : 0,
    () => {
      setNepQuestChoicesAndPrepItems();
      adventureMacro(
        $location`The Neverending Party`,
        Macro.trySkill($skill`Feel Pride`).basicCombat()
      );
    },
    {
      requirements: () => [
        new Requirement(
          [
            ...(get("_questPartyFairQuest") === "trash" ? ["100 Item Drop"] : []),
            ...(get("_questPartyFairQuest") === "dj" ? ["100 Meat Drop"] : []),
          ],
          {
            forceEquip: [
              ...(have($item`January's Garbage Tote`) ? $items`makeshift garbage shirt` : []),
              ...(get("_questPartyFairQuest") === "woots" ? $items`cosmetic football` : []),
            ],
          }
        ),
      ],
    }
  ),

  // Get a li'l ninja costume for 150% item drop
  new FreeFight(
    () =>
      !have($item`li'l ninja costume`) &&
      have($familiar`Trick-or-Treating Tot`) &&
      !get("_firedJokestersGun") &&
      have($item`The Jokester's gun`) &&
      questStep("questL08Trapper") >= 2,
    () =>
      adventureMacro(
        $location`Lair of the Ninja Snowmen`,
        Macro.skill($skill`Fire the Jokester's Gun`).abort()
      ),
    {
      requirements: () => [new Requirement([], { forceEquip: $items`The Jokester's gun` })],
    }
  ),

  // Fallback for li'l ninja costume if Lair of the Ninja Snowmen is unavailable
  new FreeFight(
    () =>
      !have($item`li'l ninja costume`) &&
      have($familiar`Trick-or-Treating Tot`) &&
      !get("_firedJokestersGun") &&
      have($item`The Jokester's gun`) &&
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
    {
      requirements: () => [new Requirement([], { forceEquip: $items`The Jokester's gun` })],
    }
  ),
];

const freeRunFightSources = [
  // Unlock Latte ingredients
  new FreeRunFight(
    () =>
      have($item`latte lovers member's mug`) &&
      !get("latteUnlocks").includes("cajun") &&
      questStep("questL11MacGuffin") > -1,
    (runSource: FreeRun) => {
      propertyManager.setChoices({
        [923]: 1, //go to the blackberries in All Around the Map
        [924]: 1, //fight a blackberry bush, so that we can freerun
      });
      adventureMacro($location`The Black Forest`, runSource.macro);
    },
    {
      requirements: () => [new Requirement([], { forceEquip: $items`latte lovers member's mug` })],
    }
  ),
  new FreeRunFight(
    () =>
      have($item`latte lovers member's mug`) &&
      !get("latteUnlocks").includes("rawhide") &&
      questStep("questL02Larva") > -1,
    (runSource: FreeRun) => {
      propertyManager.setChoices({
        [502]: 2, //go towards the stream in Arboreal Respite, so we can skip adventure
        [505]: 2, //skip adventure
      });
      adventureMacro($location`The Spooky Forest`, runSource.macro);
    },
    {
      requirements: () => [new Requirement([], { forceEquip: $items`latte lovers member's mug` })],
    }
  ),
  new FreeRunFight(
    () =>
      have($item`latte lovers member's mug`) &&
      !get("latteUnlocks").includes("carrot") &&
      get("latteUnlocks").includes("cajun") &&
      get("latteUnlocks").includes("rawhide"),
    (runSource: FreeRun) => {
      adventureMacro($location`The Dire Warren`, runSource.macro);
    },
    {
      requirements: () => [new Requirement([], { forceEquip: $items`latte lovers member's mug` })],
    }
  ),

  new FreeRunFight(
    () =>
      have($familiar`Space Jellyfish`) &&
      have($skill`Meteor Lore`) &&
      get("_macrometeoriteUses") < 10 &&
      getStenchLocation() !== $location`none`,
    (runSource: FreeRun) => {
      adventureMacro(
        getStenchLocation(),
        Macro.while_(
          "!pastround 28 && hasskill macrometeorite",
          Macro.skill($skill`Extract Jelly`).skill($skill`Macrometeorite`)
        )
          .trySkill($skill`Extract Jelly`)
          .step(runSource.macro)
      );
    },
    {
      familiar: () => $familiar`Space Jellyfish`,
    }
  ),
  new FreeRunFight(
    () =>
      have($familiar`Space Jellyfish`) &&
      have($item`Powerful Glove`) &&
      get("_powerfulGloveBatteryPowerUsed") < 91 &&
      getStenchLocation() !== $location`none`,
    (runSource: FreeRun) => {
      adventureMacro(
        getStenchLocation(),
        Macro.while_(
          "!pastround 28 && hasskill CHEAT CODE: Replace Enemy",
          Macro.skill($skill`Extract Jelly`).skill($skill`CHEAT CODE: Replace Enemy`)
        )
          .trySkill($skill`Extract Jelly`)
          .step(runSource.macro)
      );
    },
    {
      familiar: () => $familiar`Space Jellyfish`,
      requirements: () => [new Requirement([], { forceEquip: $items`Powerful Glove` })],
    }
  ),
  new FreeFight(
    () =>
      (get("gingerbreadCityAvailable") || get("_gingerbreadCityToday")) &&
      get("gingerAdvanceClockUnlocked") &&
      !get("_gingerbreadClockVisited") &&
      get("_gingerbreadCityTurns") <= 3,
    () => {
      propertyManager.setChoices({
        1215: 1, //Gingerbread Civic Center advance clock
      });
      adventureMacro($location`Gingerbread Civic Center`, Macro.abort());
    }
  ),
  new FreeRunFight(
    () =>
      (get("gingerbreadCityAvailable") || get("_gingerbreadCityToday")) &&
      get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) < 9,
    (runSource: FreeRun) => {
      adventureMacro($location`Gingerbread Civic Center`, runSource.macro);
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
    }
  ),
  new FreeFight(
    () =>
      (get("gingerbreadCityAvailable") || get("_gingerbreadCityToday")) &&
      get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) === 9,
    () => {
      propertyManager.setChoices({
        1204: 1, // Gingerbread Train Station Noon random candy
      });
      adventureMacro($location`Gingerbread Train Station`, Macro.abort());
    }
  ),
  new FreeRunFight(
    () =>
      (get("gingerbreadCityAvailable") || get("_gingerbreadCityToday")) &&
      get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) >= 10 &&
      get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) < 19 &&
      availableAmount($item`sprinkles`) > 5,
    (runSource: FreeRun) => {
      adventureMacro($location`Gingerbread Civic Center`, runSource.macro);
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
    }
  ),
  new FreeFight(
    () =>
      (get("gingerbreadCityAvailable") || get("_gingerbreadCityToday")) &&
      get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) === 19 &&
      availableAmount($item`sprinkles`) > 5,
    () => {
      propertyManager.setChoices({
        1203: 4, // Gingerbread Civic Center 5 gingerbread cigarettes
      });
      adventureMacro($location`Gingerbread Civic Center`, Macro.abort());
    }
  ),
  // Must run before fishing for hipster/goth fights otherwise the targets may be banished
  new FreeRunFight(
    () =>
      have($item`industrial fire extinguisher`) &&
      get("_fireExtinguisherCharge") >= 10 &&
      have($skill`Comprehensive Cartography`) &&
      get("_monstersMapped") < 3 &&
      get("_VYKEACompanionLevel") === 0 && // don't attempt this in case you re-run garbo after making a vykea furniture
      getBestFireExtinguisherZone() !== undefined,
    (runSource: FreeRun) => {
      // Haunted Library is full of free noncombats
      propertyManager.set({ lightsOutAutomation: 2 });
      propertyManager.setChoices({
        163: 4, // Leave without taking anything
        888: 4, // Reading is for losers. I'm outta here.
        889: 5, // Reading is for losers. I'm outta here.
      });
      const best = getBestFireExtinguisherZone();
      if (!best) throw `Unable to find fire extinguisher zone?`;
      try {
        const vortex = $skill`Fire Extinguisher: Polar Vortex`;
        Macro.while_(`hasskill ${toInt(vortex)}`, Macro.skill(vortex))
          .step(runSource.macro)
          .setAutoAttack();
        mapMonster(best.location, best.monster);
      } finally {
        setAutoAttack(0);
      }
    },
    {
      requirements: () => {
        const zone = getBestFireExtinguisherZone();
        return [
          new Requirement(
            // Bookbats need up to +100 ML to survive the polar vortices
            zone?.location === $location`The Haunted Library` ? ["99 monster level 100 max"] : [],
            { forceEquip: $items`industrial fire extinguisher` }
          ),
        ];
      },
    }
  ),
  // Try for mini-hipster\goth kid free fights with any remaining non-familiar free runs
  new FreeRunFight(
    () =>
      get("_hipsterAdv") < 7 &&
      (have($familiar`Mini-Hipster`) || have($familiar`Artistic Goth Kid`)),
    (runSource: FreeRun) => {
      const targetLocation = determineDraggableZoneAndEnsureAccess(draggableFight.BACKUP);
      adventureMacro(
        targetLocation,
        Macro.if_(
          `(monsterid 969) || (monsterid 970) || (monsterid 971) || (monsterid 972) || (monsterid 973) || (monstername Black Crayon *)`,
          Macro.basicCombat()
        ).step(runSource.macro)
      );
    },
    {
      familiar: () =>
        have($familiar`Mini-Hipster`) ? $familiar`Mini-Hipster` : $familiar`Artistic Goth Kid`,
      requirements: () => [
        new Requirement([], {
          bonusEquip: new Map<Item, number>(
            have($familiar`Mini-Hipster`)
              ? [
                  [$item`ironic moustache`, getSaleValue($item`mole skin notebook`)],
                  [$item`chiptune guitar`, getSaleValue($item`ironic knit cap`)],
                  [$item`fixed-gear bicycle`, getSaleValue($item`ironic oversized sunglasses`)],
                ]
              : []
          ),
        }),
      ],
    }
  ),
  // Try for an ultra-rare with mayfly runs ;)
  new FreeRunFight(
    () =>
      have($item`mayfly bait necklace`) &&
      canAdv($location`Cobb's Knob Menagerie, Level 1`, false) &&
      get("_mayflySummons") < 30,
    (runSource: FreeRun) => {
      adventureMacro(
        $location`Cobb's Knob Menagerie, Level 1`,
        Macro.if_(`monstername ${$monster`QuickBASIC Elemental`}`, Macro.basicCombat())
          .if_(
            `monstername ${$monster`BASIC Elemental`}`,
            Macro.trySkill($skill`Summon Mayfly Swarm`)
          )
          .step(runSource.macro)
      );
    },
    {
      requirements: () => [new Requirement([], { forceEquip: $items`mayfly bait necklace` })],
    }
  ),
];

const freeKillSources = [
  new FreeFight(
    () => !get("_gingerbreadMobHitUsed") && have($skill`Gingerbread Mob Hit`),
    () => {
      ensureBeachAccess();
      withMacro(Macro.trySkill($skill`Sing Along`).trySkill($skill`Gingerbread Mob Hit`), () =>
        use($item`drum machine`)
      );
    },
    {
      familiar: bestFairy,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),

  new FreeFight(
    () => (have($skill`Shattering Punch`) ? clamp(3 - get("_shatteringPunchUsed"), 0, 3) : 0),
    () => {
      ensureBeachAccess();
      withMacro(Macro.trySkill($skill`Sing Along`).trySkill($skill`Shattering Punch`), () =>
        use($item`drum machine`)
      );
    },
    {
      familiar: bestFairy,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),

  // Use the jokester's gun even if we don't have tot
  new FreeFight(
    () => !get("_firedJokestersGun") && have($item`The Jokester's gun`),
    () => {
      ensureBeachAccess();
      withMacro(Macro.trySkill($skill`Sing Along`).trySkill($skill`Fire the Jokester's Gun`), () =>
        use($item`drum machine`)
      );
    },
    {
      familiar: bestFairy,
      requirements: () => [
        new Requirement(["100 Item Drop"], { forceEquip: $items`The Jokester's gun` }),
      ],
    }
  ),

  // 22	3	0	0	Chest X-Ray	combat skill	must have a Lil' Doctor™ bag equipped
  new FreeFight(
    () => (have($item`Lil' Doctor™ bag`) ? clamp(3 - get("_chestXRayUsed"), 0, 3) : 0),
    () => {
      ensureBeachAccess();
      withMacro(Macro.trySkill($skill`Sing Along`).trySkill($skill`Chest X-Ray`), () =>
        use($item`drum machine`)
      );
    },
    {
      familiar: bestFairy,
      requirements: () => [
        new Requirement(["100 Item Drop"], { forceEquip: $items`Lil' Doctor™ bag` }),
      ],
    }
  ),

  new FreeFight(
    () => (have($item`replica bat-oomerang`) ? clamp(3 - get("_usedReplicaBatoomerang"), 0, 3) : 0),
    () => {
      ensureBeachAccess();
      withMacro(Macro.trySkill($skill`Sing Along`).item($item`replica bat-oomerang`), () =>
        use($item`drum machine`)
      );
    },
    {
      familiar: bestFairy,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),

  new FreeFight(
    () => !get("_missileLauncherUsed") && getCampground()["Asdon Martin keyfob"] !== undefined,
    () => {
      ensureBeachAccess();
      fillAsdonMartinTo(100);
      withMacro(
        Macro.trySkill($skill`Sing Along`).skill($skill`Asdon Martin: Missile Launcher`),
        () => use($item`drum machine`)
      );
    },
    {
      familiar: bestFairy,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),

  new FreeFight(
    () => (globalOptions.ascending ? get("shockingLickCharges") : 0),
    () => {
      ensureBeachAccess();
      withMacro(Macro.trySkill($skill`Sing Along`).skill($skill`Shocking Lick`), () =>
        use($item`drum machine`)
      );
    },
    {
      familiar: bestFairy,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),
];

export function freeFights(): void {
  if (myInebriety() > inebrietyLimit()) return;
  visitUrl("place.php?whichplace=town_wrong");

  propertyManager.setChoices({
    1387: 2, //"You will go find two friends and meet me here."
    1324: 5, //Fight a random partier
  });

  for (const freeFightSource of freeFightSources) {
    freeFightSource.runAll();
  }

  if (
    canAdv($location`The Red Zeppelin`, false) &&
    !have($item`glark cable`, clamp(5 - get("_glarkCableUses"), 0, 5))
  ) {
    buy(
      clamp(5 - get("_glarkCableUses"), 0, 5),
      $item`glark cable`,
      get("garbo_valueOfFreeFight", 2000)
    );
  }

  const stashRun = stashAmount($item`navel ring of navel gazing`)
    ? $items`navel ring of navel gazing`
    : stashAmount($item`Greatest American Pants`)
    ? $items`Greatest American Pants`
    : [];
  refreshStash();
  withStash(stashRun, () => {
    for (const freeRunFightSource of freeRunFightSources) {
      freeRunFightSource.runAll();
    }
  });

  tryFillLatte();

  try {
    for (const freeKillSource of freeKillSources) {
      if (freeKillSource.available()) {
        // TODO: Add potions that are profitable for free kills.
        // TODO: Don't run free kills at all if they're not profitable.
        if (have($skill`Emotionally Chipped`) && get("_feelLostUsed") < 3) {
          ensureEffect($effect`Feeling Lost`);
        }
        if (have($skill`Steely-Eyed Squint`) && !get("_steelyEyedSquintUsed")) {
          useSkill($skill`Steely-Eyed Squint`);
        }
      }

      freeKillSource.runAll();
    }
  } finally {
    cliExecute("uneffect Feeling Lost");
    if (have($item`January's Garbage Tote`)) cliExecute("fold wad of used tape");
  }
}

function setNepQuestChoicesAndPrepItems() {
  if (get("_questPartyFair") === "unstarted") {
    visitUrl(toUrl($location`The Neverending Party`));
    if (["food", "booze"].includes(get("_questPartyFairQuest"))) {
      print("Gerald/ine quest!", "blue");
    }
    if (["food", "booze", "woots", "trash", "dj"].includes(get("_questPartyFairQuest"))) {
      runChoice(1); // Accept quest
    } else {
      runChoice(2); // Decline quest
    }
  }
  const quest = get("_questPartyFairQuest");

  if (get("lastEncounter") === "A Room With a View... Of a Bed" && lastDecision() === 5) {
    set("_garbo_nepUsedRedDress", true);
  }
  if (get("lastEncounter") === "Basement Urges" && lastDecision() === 4) {
    set("_garbo_nepUsedElectronicsKit", true);
  }

  if (quest === "food") {
    if (!questStep("_questPartyFair")) {
      setChoice(1324, 2); // Check out the kitchen
      setChoice(1326, 3); // Talk to the woman
    } else if (get("choiceAdventure1324") !== 5) {
      setChoice(1324, 5);
      print("Found Geraldine!", "blue");
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
      print("Found Gerald!", "blue");
      const partyFairInfo = get("_questPartyFairProgress").split(" ");
      logMessage(`Gerald wants ${partyFairInfo[0]} ${toItem(partyFairInfo[1]).plural}, please!`);
    }
  } else if (quest === "woots") {
    retrieveItem($item`cosmetic football`);

    if (!get<boolean>("_garbo_nepUsedElectronicsKit", false)) {
      retrieveItem($item`electronics kit`);
      setChoice(1324, 4); // Investigate the basement
      setChoice(1328, 4); // Modify the living room lights
    } else if (!get<boolean>("_garbo_nepUsedRedDress", false)) {
      retrieveItem($item`very small red dress`);
      setChoice(1324, 1); // Head upstairs
      setChoice(1325, 5); // Toss the red dress on the lamp
      if (have($item`Clara's bell`) && !get("_claraBellUsed")) {
        // We've used one item, ready to use the other - skip to next NC.
        use($item`Clara's bell`);
      }
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

function deliverThesis(): void {
  const thesisInNEP =
    (get("neverendingPartyAlways") || get("_neverEndingPartyToday")) &&
    questStep("_questPartyFair") < 999;

  useFamiliar($familiar`Pocket Professor`);
  freeFightMood().execute();
  freeFightOutfit([new Requirement(["100 muscle"], {})]);
  safeRestore();

  if (
    have($item`Powerful Glove`) &&
    !have($effect`Triple-Sized`) &&
    get("_powerfulGloveBatteryPowerUsed") <= 95
  ) {
    cliExecute("checkpoint");
    equip($slot`acc1`, $item`Powerful Glove`);
    ensureEffect($effect`Triple-Sized`);
    outfit("checkpoint");
  }
  cliExecute("gain 1800 muscle");

  let thesisLocation = $location`Uncle Gator's Country Fun-Time Liquid Waste Sluice`;
  if (thesisInNEP) {
    //Set up NEP if we haven't yet
    setNepQuestChoicesAndPrepItems();
    thesisLocation = $location`The Neverending Party`;
  }
  // if running nobarf, might not have access to Uncle Gator's. Space is cheaper.
  else if (!canAdv(thesisLocation, false)) {
    if (!have($item`transporter transponder`)) {
      acquire(1, $item`transporter transponder`, 10000);
    }
    use($item`transporter transponder`);
    thesisLocation = $location`Hamburglaris Shield Generator`;
  }

  adventureMacro(
    thesisLocation,
    Macro.if_(`monsterid ${toInt($monster`time-spinner prank`)}`, Macro.basicCombat()).skill(
      $skill`deliver your thesis!`
    )
  );
}

export function safeRestore(): void {
  if (myHp() < myMaxhp() * 0.5) {
    restoreHp(myMaxhp() * 0.9);
  }
  if (myMp() < 50 && myMaxmp() > 50) {
    if (
      (have($item`magical sausage`) || have($item`magical sausage casing`)) &&
      get<number>("_sausagesEaten") < 23
    ) {
      eat($item`magical sausage`);
    }
    restoreMp(50);
  }
}

function doSausage() {
  if (!kramcoGuaranteed()) return;
  useFamiliar(freeFightFamiliar());
  freeFightOutfit([new Requirement([], { forceEquip: $items`Kramco Sausage-o-Matic™` })]);
  adventureMacroAuto(determineDraggableZoneAndEnsureAccess(), Macro.basicCombat());
  setAutoAttack(0);
  horseradish();
}

function ensureBeachAccess() {
  if (get("lastDesertUnlock") !== myAscensions() && myPathId() !== 23 /*Actually Ed the Undying*/) {
    cliExecute(`create ${$item`bitchin' meatcar`}`);
  }
}

type fireExtinguisherZone = {
  item: Item;
  location: Location;
  monster: Monster;
  open: () => boolean;
};
const fireExtinguishZones = [
  {
    location: $location`The Deep Dark Jungle`,
    monster: $monster`smoke monster`,
    item: $item`transdermal smoke patch`,
    open: () => get("_spookyAirportToday") || get("spookyAirportAlways"),
  },
  {
    location: $location`The Ice Hotel`,
    monster: $monster`ice bartender`,
    item: $item`perfect ice cube`,
    open: () => get("_coldAirportToday") || get("coldAirportAlways"),
  },
  {
    location: $location`The Haunted Library`,
    monster: $monster`bookbat`,
    item: $item`tattered scrap of paper`,
    open: () => have($item`[7302]Spookyraven library key`),
  },
] as fireExtinguisherZone[];

let bestFireExtinguisherZoneCached: fireExtinguisherZone | undefined = undefined;
function getBestFireExtinguisherZone(): fireExtinguisherZone | undefined {
  if (bestFireExtinguisherZoneCached !== undefined) return bestFireExtinguisherZoneCached;
  const targets = fireExtinguishZones.filter((zone) => zone.open() && !isBanished(zone.monster));
  bestFireExtinguisherZoneCached = targets.sort(
    (a, b) => getSaleValue(b.item) - getSaleValue(a.item)
  )[0];
  return bestFireExtinguisherZoneCached;
}
