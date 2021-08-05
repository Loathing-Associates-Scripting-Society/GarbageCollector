import { canAdv } from "canadv.ash";
import {
  abort,
  adv1,
  availableAmount,
  booleanModifier,
  chatPrivate,
  cliExecute,
  closetAmount,
  eat,
  equip,
  familiarWeight,
  getCampground,
  getCounters,
  handlingChoice,
  inebrietyLimit,
  itemAmount,
  mallPrice,
  myAscensions,
  myClass,
  myFamiliar,
  myHash,
  myHp,
  myInebriety,
  myMaxhp,
  myMaxmp,
  myMp,
  mySpleenUse,
  numericModifier,
  outfit,
  print,
  putCloset,
  restoreHp,
  restoreMp,
  retrieveItem,
  runChoice,
  runCombat,
  setAutoAttack,
  setLocation,
  spleenLimit,
  takeCloset,
  toInt,
  totalTurnsPlayed,
  use,
  useFamiliar,
  userConfirm,
  useSkill,
  visitUrl,
  wait,
  weightAdjustment,
} from "kolmafia";
import {
  $class,
  $effect,
  $familiar,
  $item,
  $items,
  $location,
  $monster,
  $monsters,
  $skill,
  $slot,
  adventureMacro,
  adventureMacroAuto,
  ChateauMantegna,
  get,
  have,
  maximizeCached,
  set,
  SourceTerminal,
  TunnelOfLove,
  Witchess,
} from "libram";
import { fillAsdonMartinTo } from "./asdon";
import { withStash } from "./clan";
import { Macro, withMacro } from "./combat";
import { horseradish } from "./diet";
import { freeFightFamiliar, meatFamiliar } from "./familiar";
import {
  clamp,
  ensureEffect,
  findRun,
  FreeRun,
  kramcoGuaranteed,
  mapMonster,
  prepWandererZone,
  questStep,
  Requirement,
  saleValue,
  setChoice,
  sum,
} from "./lib";
import { freeFightMood, meatMood } from "./mood";
import {
  familiarWaterBreathingEquipment,
  freeFightOutfit,
  meatOutfit,
  waterBreathingEquipment,
} from "./outfit";
import { bathroomFinance } from "./potions";
import { estimatedTurns, log } from "./globalvars";
import { property, withChoice, withChoices } from "libram";

function checkFax(): boolean {
  if (!have($item`photocopied monster`)) cliExecute("fax receive");
  if (property.getString("photocopyMonster") === "Knob Goblin Embezzler") return true;
  cliExecute("fax send");
  return false;
}

function faxEmbezzler(): void {
  if (!get("_photocopyUsed")) {
    if (checkFax()) return;
    chatPrivate("cheesefax", "Knob Goblin Embezzler");
    for (let i = 0; i < 3; i++) {
      wait(10);
      if (checkFax()) return;
    }
    abort("Failed to acquire photocopied Knob Goblin Embezzler.");
  }
}

type EmbezzlerFightOptions = {
  location?: Location;
  macro?: Macro;
};

class EmbezzlerFight {
  available: () => boolean;
  potential: () => number;
  run: (options: EmbezzlerFightOptions) => void;
  requirements: Requirement[];
  draggable: boolean;
  name: string;

  constructor(
    name: string,
    available: () => boolean,
    potential: () => number,
    run: (options: EmbezzlerFightOptions) => void,
    requirements: Requirement[] = [],
    draggable = false
  ) {
    this.name = name;
    this.available = available;
    this.potential = potential;
    this.run = run;
    this.requirements = requirements;
    this.draggable = draggable;
  }
}

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
    )
      .trySkill("Lecture on Relativity")
      .meatKill()
  ).abort();

const secondChainMacro = () =>
  Macro.if_(
    "monstername Knob Goblin Embezzler",
    Macro.externalIf(
      myFamiliar() === $familiar`Pocket Professor`,
      Macro.if_(
        "!hasskill Lecture on Relativity",
        Macro.if_(
          `hasskill ${toInt($skill`Meteor Shower`)}`,
          Macro.step(`skill ${toInt($skill`Meteor Shower`)}`)
        )
      ) //fix when libram is updated
        .if_(
          "!hasskill Lecture on Relativity",
          Macro.externalIf(
            get("_sourceTerminalDigitizeMonster") !== $monster`Knob Goblin Embezzler`,
            Macro.tryCopier($skill`Digitize`)
          )
            .tryCopier($item`Spooky Putty sheet`)
            .tryCopier($item`Rain-Doh black box`)
            .tryCopier($item`4-d camera`)
        )
        .trySkill("Lecture on Relativity")
    ).meatKill()
  ).abort();

const embezzlerMacro = () =>
  Macro.if_(
    "monstername Knob Goblin Embezzler",
    Macro.if_("snarfblat 186", Macro.tryCopier($item`pulled green taffy`))
      .trySkill("Wink At")
      .trySkill("Fire a badly romantic arrow")
      .externalIf(
        get("_sourceTerminalDigitizeMonster") !== $monster`Knob Goblin Embezzler`,
        Macro.tryCopier($skill`Digitize`)
      )
      .tryCopier($item`Spooky Putty sheet`)
      .tryCopier($item`Rain-Doh black box`)
      .tryCopier($item`4-d camera`)
      .meatKill()
  ).abort();

const embezzlerSources = [
  new EmbezzlerFight(
    "Digitize",
    () =>
      get("_sourceTerminalDigitizeMonster") === $monster`Knob Goblin Embezzler` &&
      getCounters("Digitize Monster", 0, 0).trim() !== "",
    () => (SourceTerminal.have() && get("_sourceTerminalDigitizeUses") === 0 ? 1 : 0),
    (options: EmbezzlerFightOptions) => {
      adv1(options.location || $location`Noob Cave`);
    },
    [],
    true
  ),
  new EmbezzlerFight(
    "Backup",
    () =>
      get("lastCopyableMonster") === $monster`Knob Goblin Embezzler` &&
      have($item`backup camera`) &&
      get<number>("_backUpUses") < 11,
    () => (have($item`backup camera`) ? 11 - get<number>("_backUpUses") : 0),
    (options: EmbezzlerFightOptions) => {
      const realLocation =
        options.location && options.location.combatPercent >= 100
          ? options.location
          : $location`Noob Cave`;
      adventureMacro(
        realLocation,
        Macro.if_(
          "!monstername Knob Goblin Embezzler",
          Macro.skill("Back-Up to Your Last Enemy")
        ).step(options.macro || embezzlerMacro())
      );
    },
    [
      new Requirement([], {
        forceEquip: $items`backup camera`,
        bonusEquip: new Map([[$item`backup camera`, 5000]]),
      }),
    ],
    true
  ),
  new EmbezzlerFight(
    "Fax",
    () => have($item`Clan VIP Lounge key`) && !get("_photocopyUsed"),
    () => (have($item`Clan VIP Lounge key`) && !get("_photocopyUsed") ? 1 : 0),
    () => {
      faxEmbezzler();
      use($item`photocopied monster`);
    }
  ),
  new EmbezzlerFight(
    "Pillkeeper Semirare",
    () =>
      have($item`Eight Days a Week Pill Keeper`) &&
      canAdv($location`Cobb's Knob Treasury`, true) &&
      !get("_freePillKeeperUsed"),
    () =>
      have($item`Eight Days a Week Pill Keeper`) &&
      canAdv($location`Cobb's Knob Treasury`, true) &&
      !get("_freePillKeeperUsed")
        ? 1
        : 0,
    () => {
      cliExecute("pillkeeper semirare");
      adv1($location`Cobb's Knob Treasury`);
    }
  ),
  new EmbezzlerFight(
    "Chateau Painting",
    () =>
      ChateauMantegna.have() &&
      !ChateauMantegna.paintingFought() &&
      ChateauMantegna.paintingMonster() === $monster`Knob Goblin Embezzler`,
    () =>
      ChateauMantegna.have() &&
      !ChateauMantegna.paintingFought() &&
      ChateauMantegna.paintingMonster() === $monster`Knob Goblin Embezzler`
        ? 1
        : 0,
    () => ChateauMantegna.fightPainting()
  ),
  new EmbezzlerFight(
    "Spooky Putty & Rain-Doh",
    () =>
      (have($item`Spooky Putty monster`) &&
        get("spookyPuttyMonster") === $monster`Knob Goblin Embezzler`) ||
      (have($item`Rain-Doh box full of monster`) &&
        get("rainDohMonster") === $monster`Knob Goblin Embezzler`),
    () => {
      if (
        (have($item`Spooky Putty sheet`) || have($item`Spooky Putty monster`)) &&
        (have($item`Rain-Doh black box`) || have($item`Rain-Doh box full of monster`))
      ) {
        return (
          6 -
          get("spookyPuttyCopiesMade") -
          get("_raindohCopiesMade") +
          itemAmount($item`Spooky Putty monster`) +
          itemAmount($item`Rain-Doh box full of monster`)
        );
      } else if (have($item`Spooky Putty sheet`) || have($item`Spooky Putty monster`)) {
        return 5 - get("spookyPuttyCopiesMade") + itemAmount($item`Spooky Putty monster`);
      } else if (have($item`Rain-Doh black box`) || have($item`Rain-Doh box full of monster`)) {
        return 5 - get("_raindohCopiesMade") + itemAmount($item`Rain-Doh box full of monster`);
      }
      return 0;
    },
    () => {
      if (have($item`Spooky Putty monster`)) return use($item`Spooky Putty monster`);
      return use($item`Rain-Doh box full of monster`);
    }
  ),
  new EmbezzlerFight(
    "4-d Camera",
    () =>
      have($item`shaking 4-d camera`) &&
      get("cameraMonster") === $monster`Knob Goblin Embezzler` &&
      !get("_cameraUsed"),
    () =>
      have($item`shaking 4-d camera`) &&
      get("cameraMonster") === $monster`Knob Goblin Embezzler` &&
      !get("_cameraUsed")
        ? 1
        : 0,
    () => use($item`shaking 4-d camera`)
  ),
  new EmbezzlerFight(
    "Green Taffy",
    () =>
      have($item`envyfish egg`) &&
      get("envyfishMonster") === $monster`Knob Goblin Embezzler` &&
      !get("_envyfishEggUsed"),
    () =>
      have($item`envyfish egg`) &&
      get("envyfishMonster") === $monster`Knob Goblin Embezzler` &&
      !get("_envyfishEggUsed")
        ? 1
        : 0,
    () => use($item`envyfish egg`)
  ),
  new EmbezzlerFight(
    "Professor MeatChain",
    () => false,
    () => (have($familiar`Pocket Professor`) && !get<boolean>("_garbo_meatChain", false) ? 10 : 0),
    () => {
      return;
    }
  ),
  new EmbezzlerFight(
    "Professor WeightChain",
    () => false,
    () => (have($familiar`Pocket Professor`) && !get<boolean>("_garbo_weightChain", false) ? 5 : 0),
    () => {
      return;
    }
  ),
];

export function embezzlerCount(): number {
  return sum(embezzlerSources.map((source) => source.potential()));
}

function embezzlerSetup() {
  meatMood(true, true).execute(estimatedTurns());
  safeRestore();
  if (mySpleenUse() < spleenLimit()) ensureEffect($effect`Eau d' Clochard`);
  if (mySpleenUse() < spleenLimit() && have($item`body spradium`)) {
    ensureEffect($effect`Boxing Day Glow`);
  }
  freeFightMood().execute(50);
  withStash($items`Platinum Yendorian Express Card`, () => {
    if (have($item`Platinum Yendorian Express Card`)) {
      use($item`Platinum Yendorian Express Card`);
    }
  });
  if (have($item`License to Chill`) && !get("_licenseToChillUsed")) use($item`License to Chill`);

  bathroomFinance(embezzlerCount());

  if (SourceTerminal.have()) SourceTerminal.educate([$skill`Extract`, $skill`Digitize`]);
  if (!get("_cameraUsed") && !have($item`shaking 4-d camera`)) {
    retrieveItem($item`4-d camera`);
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
}

function getEmbezzlerFight(): EmbezzlerFight | null {
  let potentials = false;
  for (const fight of embezzlerSources) {
    if (fight.available()) return fight;
    if (fight.potential()) potentials = true;
  }
  if (
    potentials &&
    get("_genieFightsUsed") < 3 &&
    userConfirm(
      "Garbo has detected you have potential ways to copy an Embezzler, but no way to start a fight with one. Should we wish for an Embezzler?"
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
  return null;
}

function startDigitize() {
  if (
    getCounters("Digitize Monster", 0, 100).trim() === "" &&
    get("_sourceTerminalDigitizeUses") !== 0
  ) {
    do {
      const run =
        findRun() ||
        new FreeRun(
          "LTB",
          () => retrieveItem($item`Louder Than Bomb`),
          Macro.item("Louder Than Bomb"),
          new Requirement([], {}),
          () => retrieveItem($item`Louder Than Bomb`)
        );
      if (run.prepare) run.prepare();
      freeFightOutfit([...(run.requirement ? [run.requirement] : [])]);
      adventureMacro($location`Noob Cave`, run.macro);
    } while (get("lastCopyableMonster") === $monster`Government agent`);
  }
}
const witchessPieces = [
  { piece: $monster`Witchess Bishop`, drop: $item`Sacramento wine` },
  { piece: $monster`Witchess Knight`, drop: $item`jumping horseradish` },
  { piece: $monster`Witchess Pawn`, drop: $item`armored prawn` },
  { piece: $monster`Witchess Rook`, drop: $item`Greek fire` },
];

function bestWitchessPiece() {
  return witchessPieces.sort((a, b) => saleValue(b.drop) - saleValue(a.drop))[0].piece;
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
            fightSource.run({ location: prepWandererZone(), macro: firstChainMacro() })
          );
          log.initialEmbezzlersFought += 1 + get("_pocketProfessorLectures") - startLectures;
        }
        set("_garbo_meatChain", true);
      }

      startDigitize();

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
        maximizeCached(requirements.maximizeParameters(), requirements.maximizeOptions());
        if (
          get("_pocketProfessorLectures") <
          2 + Math.ceil(Math.sqrt(familiarWeight(myFamiliar()) + weightAdjustment()))
        ) {
          withMacro(secondChainMacro(), () =>
            fightSource.run({ location: prepWandererZone(), macro: secondChainMacro() })
          );
          log.initialEmbezzlersFought += 1 + get("_pocketProfessorLectures") - startLectures;
        }
        set("_garbo_weightChain", true);
      }

      startDigitize();

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
            } else if (nextFight.draggable) {
              const location = prepWandererZone();
              setLocation(location);
              meatOutfit(true, nextFight.requirements);
              nextFight.run({ location });
            } else {
              setLocation($location`Noob Cave`);
              meatOutfit(true, nextFight.requirements);
              nextFight.run({ location: $location`Noob Cave` });
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
        startDigitize();
        nextFight = getEmbezzlerFight();
        if (
          kramcoGuaranteed() &&
          (!nextFight || (nextFight.name !== "Backup" && nextFight.name !== "Digitize"))
        ) {
          doSausage();
        }
      }
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
    // FIXME: make a better decision here.
    if ((this.options.cost ? this.options.cost() : 0) > 2000) return;
    while (this.available()) {
      useFamiliar(
        this.options.familiar ? this.options.familiar() ?? freeFightFamiliar() : freeFightFamiliar()
      );
      freeFightMood().execute();
      freeFightOutfit(this.options.requirements ? this.options.requirements() : []);
      safeRestore();
      withMacro(Macro.meatKill(), this.run);
      horseradish();
      // Slot in our Professor Thesis if it's become available
      if (thesisReady()) deliverThesis();
    }
  }
}

const pygmyMacro = Macro.if_(
  "monstername pygmy bowler",
  Macro.trySkill("Snokebomb").item($item`Louder Than Bomb`)
)
  .if_(
    "monstername pygmy orderlies",
    Macro.trySkill("Feel Hatred").item($item`divine champagne popper`)
  )
  .if_("monstername pygmy janitor", Macro.item($item`tennis ball`))
  .if_("monstername time-spinner prank", Macro.meatKill())
  .abort();

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
    () => ChateauMantegna.fightPainting()
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
    () => have($item`[glitch season reward name]`) && !get("_glitchMonsterFights"),
    () => {
      visitUrl("inv_eat.php?pwd&whichitem=10207");
      runCombat();
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
      use(figurine);
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
        //1387, 2

        withChoice(1387, 2, () => {
          putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
          putCloset(itemAmount($item`Bowl of Scorpions`), $item`Bowl of Scorpions`);
          adventureMacro($location`The Hidden Bowling Alley`, Macro.skill("Use the Force"));
        });
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
      Macro.trySkill("Extract").trySkill("Sing Along").setAutoAttack;
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
    () => adv1(prepWandererZone(), -1, ""),
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: $items`Kramco Sausage-o-Matic™`,
        }),
      ],
    }
  ),

  new FreeFight(
    () => (get("questL11Ron") === "finished" ? 5 - get("_glarkCableUses") : 0),
    () => {
      retrieveItem(5 - get("_glarkCableUses"), $item`glark cable`);
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
      adventureMacro($location`Your Mushroom Garden`, Macro.trySkill("Portscan").meatKill());
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
        Macro.if_("monstername government agent", Macro.skill("Macrometeorite")).if_(
          "monstername piranha plant",
          Macro.trySkill("Portscan").meatKill()
        )
      );
      if (have($item`packet of tall grass seeds`)) use($item`packet of tall grass seeds`);
    }
  ),

  new FreeFight(
    () => (have($familiar`God Lobster`) ? clamp(3 - get("_godLobsterFights"), 0, 3) : 0),
    () =>
      //
      withChoice(1310, 3, () => {
        visitUrl("main.php?fightgodlobster=1");
        runCombat();
        visitUrl("choice.php");
        if (handlingChoice()) runChoice(3);
      }),
    {
      familiar: () => $familiar`God Lobster`,
    }
  ),

  new FreeFight(
    () => (have($familiar`Machine Elf`) ? clamp(5 - get("_machineTunnelsAdv"), 0, 5) : 0),
    () => {
      withChoice(1119, 6, () => adv1($location`The Deep Machine Tunnels`, -1, ""));
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
      nepQuest();
      withChoices(nepQuestChoices(), () => {
        adventureMacro($location`The Neverending Party`, Macro.trySkill("Feel Pride").meatKill());
        if (get("choiceAdventure1324") !== 5 && questStep("_questPartyFair") > 0) {
          print("Found Gerald/ine!", "blue");
          setChoice(1324, 5);
        }
      });
    },
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: have($item`January's Garbage Tote`) ? $items`makeshift garbage shirt` : [],
        }),
      ],
    }
  ),
];

const freeKillSources = [
  new FreeFight(
    () => !get("_gingerbreadMobHitUsed") && have($skill`Gingerbread Mob Hit`),
    () =>
      withMacro(Macro.skill("Sing Along").trySkill("Gingerbread Mob Hit"), () =>
        use($item`drum machine`)
      ),
    {
      familiar: bestFairy,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),

  new FreeFight(
    () => (have($skill`Shattering Punch`) ? clamp(3 - get("_shatteringPunchUsed"), 0, 3) : 0),
    () =>
      withMacro(Macro.skill("Sing Along").trySkill("Shattering Punch"), () =>
        use($item`drum machine`)
      ),
    {
      familiar: bestFairy,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),

  // Use the jokester's gun even if we don't have tot
  new FreeFight(
    () => !get("_firedJokestersGun") && have($item`The Jokester's gun`),
    () =>
      withMacro(Macro.skill("Sing Along").trySkill("Fire the Jokester's Gun"), () =>
        use($item`drum machine`)
      ),
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
    () =>
      withMacro(Macro.skill("Sing Along").trySkill("Chest X-Ray"), () => use($item`drum machine`)),
    {
      familiar: bestFairy,
      requirements: () => [
        new Requirement(["100 Item Drop"], { forceEquip: $items`Lil' Doctor™ bag` }),
      ],
    }
  ),

  new FreeFight(
    () => (have($item`replica bat-oomerang`) ? clamp(3 - get("_usedReplicaBatoomerang"), 0, 3) : 0),
    () =>
      withMacro(Macro.skill("Sing Along").item("replica bat-oomerang"), () =>
        use($item`drum machine`)
      ),
    {
      familiar: bestFairy,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),

  new FreeFight(
    () => !get("_missileLauncherUsed") && getCampground()["Asdon Martin keyfob"] !== undefined,
    () => {
      fillAsdonMartinTo(100);
      withMacro(Macro.skill("Sing Along").skill("Asdon Martin: Missile Launcher"), () =>
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
  for (const freeFightSource of freeFightSources) {
    freeFightSource.runAll();
  }

  if (
    !have($item`li'l ninja costume`) &&
    have($familiar`Trick-or-Treating Tot`) &&
    !get("_firedJokestersGun") &&
    have($item`The Jokester's gun`)
  ) {
    useFamiliar(freeFightFamiliar());
    freeFightMood().execute();
    freeFightOutfit([new Requirement([], { forceEquip: $items`The Jokester's gun` })]);
    if (questStep("questL08Trapper") >= 2) {
      adventureMacroAuto(
        $location`Lair of the Ninja Snowmen`,
        Macro.skill("Fire the Jokester's Gun")
      );
    } else if (have($skill`Comprehensive Cartography`) && get("_monstersMapped") < 3) {
      try {
        Macro.skill("Fire the Jokester's Gun").setAutoAttack();
        mapMonster($location`The Haiku Dungeon`, $monster`amateur ninja`);
      } finally {
        setAutoAttack(0);
      }
    }
  }
  try {
    for (const freeKillSource of freeKillSources) {
      if (freeKillSource.available()) {
        // TODO: Add potions that are profitable for free kills.
        // TODO: Don't run free kills at all if they're not profitable.
        ensureEffect($effect`Feeling Lost`);
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

function nepQuest() {
  setChoice(1324, 5); // pick fight.
  if (get("_questPartyFair") === "unstarted") {
    visitUrl("adventure.php?snarfblat=528");
    if (get("_questPartyFairQuest") === "food") {
      runChoice(1);
      setChoice(1324, 2);
      setChoice(1326, 3);
    } else if (get("_questPartyFairQuest") === "booze") {
      runChoice(1);
      setChoice(1324, 3);
      setChoice(1327, 3);
    } else {
      runChoice(2);
      setChoice(1324, 5);
    }
  }
}

function nepQuestChoices() {
  if (questStep("_questPartyFair") <= 0) {
    if (get("_questPartyFairQuest") === "food") {
      return { 1324: 2, 1326: 3, 1327: "" };
    }
    if (get("_questPartyFairQuest") === "booze") {
      return { 1324: 3, 1326: "", 1327: 3 };
    }
  }
  return { 1324: 5, 1326: "", 1327: "" };
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
    get("neverendingPartyAlways") &&
    get("_neverendingPartyFreeTurns") < 10 &&
    questStep("_questPartyFair") < 999;

  //Set up NEP if we haven't yet
  if (thesisInNEP) nepQuest();

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
  withChoices(nepQuestChoices(), () => {
    adventureMacro(
      thesisInNEP
        ? $location`The Neverending Party`
        : $location`Uncle Gator's Country Fun-Time Liquid Waste Sluice`,
      Macro.skill("Deliver your Thesis")
    );
  });
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
  adventureMacroAuto(prepWandererZone(), Macro.meatKill());
  setAutoAttack(0);
}
