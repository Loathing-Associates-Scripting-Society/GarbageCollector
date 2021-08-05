import {
  booleanModifier,
  buy,
  cliExecute,
  eat,
  getCampground,
  getCounters,
  guildStoreAvailable,
  inebrietyLimit,
  itemAmount,
  myAdventures,
  myClass,
  myGardenType,
  myInebriety,
  myPrimestat,
  myTurncount,
  print,
  putCloset,
  refreshStash,
  retrieveItem,
  reverseNumberology,
  runChoice,
  setAutoAttack,
  stashAmount,
  toItem,
  totalTurnsPlayed,
  use,
  useFamiliar,
  visitUrl,
  xpath,
} from "kolmafia";
import {
  $class,
  $effect,
  $item,
  $items,
  $location,
  $monster,
  $skill,
  $stat,
  adventureMacro,
  adventureMacroAuto,
  get,
  have,
  setDefaultMaximizeOptions,
  sinceKolmafiaRevision,
  SourceTerminal,
} from "libram";
import { Macro, withMacro } from "./combat";
import {
  cheat,
  configureGear,
  configureMisc,
  dailyBuffs,
  gaze,
  gin,
  gingerbreadPrepNoon,
  hipsterFishing,
  horse,
  jellyfish,
  latte,
  martini,
  pickTea,
  prepFamiliars,
  volcanoDailies,
  voterSetup,
} from "./dailies";
import { horseradish, runDiet } from "./diet";
import { freeFightFamiliar, meatFamiliar } from "./familiar";
import { dailyFights, freeFights, safeRestore } from "./fights";
import { physicalImmuneMacro, prepWandererZone, questStep, Requirement } from "./lib";
import { meatMood } from "./mood";
import {
  familiarWaterBreathingEquipment,
  freeFightOutfit,
  meatOutfit,
  waterBreathingEquipment,
} from "./outfit";
import { withStash, withVIPClan } from "./clan";
import { withProperties } from "libram";
import { estimatedTurns, globalOptions, log } from "./globalvars";

// Max price for tickets. You should rethink whether Barf is the best place if they're this expensive.
const TICKET_MAX_PRICE = 500000;

function ensureBarfAccess() {
  if (!(get("stenchAirportAlways") || get("_stenchAirportToday"))) {
    const ticket = $item`one-day ticket to Dinseylandfill`;
    // TODO: Get better item acquisition logic that e.g. checks own mall store.
    if (!have(ticket)) buy(1, ticket, TICKET_MAX_PRICE);
    use(ticket);
  }
  if (!get("_dinseyGarbageDisposed")) {
    print("Disposing of garbage.", "blue");
    retrieveItem($item`bag of park garbage`);
    visitUrl("place.php?whichplace=airport_stench&action=airport3_tunnels");
    runChoice(6);
    cliExecute("refresh inv");
  }
}

function dailySetup() {
  voterSetup();
  martini();
  gaze();
  configureGear();
  horse();
  prepFamiliars();
  dailyBuffs();
  configureMisc();
  volcanoDailies();
  cheat();
  gin();
  pickTea();

  refreshStash();
  const stashRun = stashAmount($item`navel ring of navel gazing`)
    ? $items`navel ring of navel gazing`
    : stashAmount($item`Greatest American Pants`)
    ? $items`Greatest American Pants`
    : [];
  withStash(stashRun, () => {
    gingerbreadPrepNoon();
    latte();
    jellyfish();
    hipsterFishing();
  });

  if (myInebriety() > inebrietyLimit()) return;
  gingerbreadPrepNoon();
  latte();
  jellyfish();
  dailyBuffs();

  retrieveItem($item`Half a Purse`);
  retrieveItem($item`seal tooth`);
  retrieveItem($item`The Jokester's gun`);
  putCloset(itemAmount($item`hobo nickel`), $item`hobo nickel`);
  putCloset(itemAmount($item`sand dollar`), $item`sand dollar`);
}

function barfTurn() {
  const startTurns = totalTurnsPlayed();
  horseradish();
  if (have($effect`Beaten Up`))
    throw "Hey, you're beaten up, and that's a bad thing. Lick your wounds, handle your problems, and run me again when you feel ready.";
  if (SourceTerminal.have()) {
    SourceTerminal.educate([$skill`Extract`, $skill`Digitize`]);
  }
  if (
    have($item`unwrapped knock-off retro superhero cape`) &&
    (get("retroCapeSuperhero") !== "robot" || get("retroCapeWashingInstructions") !== "kill")
  ) {
    cliExecute("retrocape robot kill");
  }
  if (
    have($item`latte lovers member's mug`) &&
    get("_latteRefillsUsed") < 3 &&
    get("_latteCopyUsed") &&
    get("latteUnlocks").includes("cajun") &&
    get("latteUnlocks").includes("rawhide")
  ) {
    const latteIngredients = [
      "cajun",
      "rawhide",
      get("latteUnlocks").includes("carrot")
        ? "carrot"
        : myPrimestat() === $stat`muscle`
        ? "vanilla"
        : myPrimestat() === $stat`mysticality`
        ? "pumpkin spice"
        : "cinnamon",
    ].join(" ");
    cliExecute(`latte refill ${latteIngredients}`);
  }

  // a. set up familiar
  useFamiliar(meatFamiliar());

  const embezzlerUp = getCounters("Digitize Monster", 0, 0).trim() !== "";
  let location = embezzlerUp ? prepWandererZone() : $location`Barf Mountain`;
  if (
    !get("_envyfishEggUsed") &&
    (booleanModifier("Adventure Underwater") || waterBreathingEquipment.some(have)) &&
    (booleanModifier("Underwater Familiar") || familiarWaterBreathingEquipment.some(have)) &&
    (have($effect`Fishy`) || (have($item`fishy pipe`) && !get("_fishyPipeUsed"))) &&
    !have($item`envyfish egg`) &&
    embezzlerUp
  ) {
    // now fight one underwater
    if (get("questS01OldGuy") === "unstarted") {
      visitUrl("place.php?whichplace=sea_oldman&action=oldman_oldman");
    }
    retrieveItem($item`pulled green taffy`);
    if (!have($effect`Fishy`)) use($item`fishy pipe`);
    location = $location`The Briny Deeps`;
  }

  const underwater = location === $location`The Briny Deeps`;
  meatOutfit(embezzlerUp, [], underwater);

  // c. set up mood stuff
  meatMood().execute(estimatedTurns());

  safeRestore(); //get enough mp to use summer siesta and enough hp to not get our ass kicked
  const ghostLocation = get("ghostLocation");
  // d. run adventure
  if (have($item`envyfish egg`) && !get("_envyfishEggUsed")) {
    meatOutfit(true);
    withMacro(Macro.meatKill(), () => use($item`envyfish egg`));
  } else if (
    myInebriety() <= inebrietyLimit() &&
    have($item`protonic accelerator pack`) &&
    get("questPAGhost") !== "unstarted" &&
    ghostLocation
  ) {
    useFamiliar(freeFightFamiliar());
    freeFightOutfit([new Requirement([], { forceEquip: $items`protonic accelerator pack` })]);
    adventureMacro(ghostLocation, physicalImmuneMacro);
  } else if (
    myInebriety() <= inebrietyLimit() &&
    have($item`"I Voted!" sticker`) &&
    getCounters("Vote", 0, 0) !== "" &&
    get("_voteFreeFights") < 3
  ) {
    useFamiliar(freeFightFamiliar());
    freeFightOutfit([new Requirement([], { forceEquip: $items`"I Voted!" sticker` })]);
    adventureMacroAuto(prepWandererZone(), Macro.step(physicalImmuneMacro).meatKill());
  } else {
    adventureMacroAuto(
      location,
      Macro.externalIf(
        underwater,
        Macro.if_(
          `monsterid ${$monster`Knob Goblin Embezzler`.id}`,
          Macro.item("pulled green taffy")
        )
      ).meatKill(),
      Macro.if_(
        `(monsterid ${$monster`Knob Goblin Embezzler`.id}) && !gotjump && !(pastround 2)`,
        Macro.externalIf(underwater, Macro.item("pulled green taffy")).meatKill()
      ).abort()
    );
  }

  if (
    Object.keys(reverseNumberology()).includes("69") &&
    get("_universeCalculated") < get("skillLevel144")
  ) {
    cliExecute("numberology 69");
  }

  if (myAdventures() === 1) {
    if (
      (have($item`magical sausage`) || have($item`magical sausage casing`)) &&
      get<number>("_sausagesEaten") < 23
    ) {
      eat($item`magical sausage`);
    }
  }
  if (totalTurnsPlayed() - startTurns === 1 && get("lastEncounter") === "Knob Goblin Embezzler")
    if (embezzlerUp) log.digitizedEmbezzlersFought++;
    else log.initialEmbezzlersFought++;
}

export function canContinue(): boolean {
  return (
    myAdventures() > 0 &&
    (globalOptions.stopTurncount === null || myTurncount() < globalOptions.stopTurncount)
  );
}

export function main(argString = ""): void {
  sinceKolmafiaRevision(20767);

  if (get("valueOfAdventure") <= 3500) {
    throw `Your valueOfAdventure is set to ${get(
      "valueOfAdventure"
    )}, which is too low for barf farming to be worthwhile. If you forgot to set it, use "set valueOfAdventure = XXXX" to set it to your marginal turn meat value.`;
  }
  if (get("valueOfAdventure") >= 10000) {
    throw `Your valueOfAdventure is set to ${get(
      "valueOfAdventure"
    )}, which is definitely incorrect. Please set it to your reliable marginal turn value.`;
  }

  const args = argString.split(" ");
  for (const arg of args) {
    if (arg.match(/\d+/)) {
      globalOptions.stopTurncount = myTurncount() + parseInt(arg, 10);
    }
    if (arg.match(/ascend/)) {
      globalOptions.ascending = true;
    }
  }
  const gardens = $items`packet of pumpkin seeds, Peppermint Pip Packet, packet of dragon's teeth, packet of beer seeds, packet of winter seeds, packet of thanksgarden seeds, packet of tall grass seeds, packet of mushroom spores`;
  const startingGarden = gardens.find((garden) =>
    Object.getOwnPropertyNames(getCampground()).includes(garden.name)
  );
  if (
    startingGarden &&
    !$items`packet of tall grass seeds, packet of mushroom spores`.includes(startingGarden) &&
    getCampground()[startingGarden.name] &&
    $items`packet of tall grass seeds, packet of mushroom spores`.some((gardenSeed) =>
      have(gardenSeed)
    )
  ) {
    visitUrl("campground.php?action=garden&pwd");
  }

  const aaBossFlag =
    xpath(
      visitUrl("account.php?tab=combat"),
      `//*[@id="opt_flag_aabosses"]/label/input[@type='checkbox']@checked`
    )[0] === "checked"
      ? 1
      : 0;

  try {
    print("Collecting garbage!", "blue");
    if (globalOptions.stopTurncount !== null) {
      print(`Stopping in ${globalOptions.stopTurncount - myTurncount()}`, "blue");
    }
    print();

    if (
      have($item`packet of tall grass seeds`) &&
      myGardenType() !== "grass" &&
      myGardenType() !== "mushroom"
    )
      use($item`packet of tall grass seeds`);

    setAutoAttack(0);
    visitUrl(`account.php?actions[]=flag_aabosses&flag_aabosses=1&action=Update`, true);
    withProperties(
      {
        battleAction: "custom combat script",
        autoSatisfyWithMall: true,
        autoSatisfyWithNPCs: true,
        autoSatisfyWithCoinmasters: true,
        dontStopForCounters: true,
        maximizerFoldables: true,
      },
      () => {
        cliExecute("mood apathetic");
        cliExecute("ccs garbo");
        safeRestore();

        if (questStep("questM23Meatsmith") === -1) {
          visitUrl("shop.php?whichshop=meatsmith&action=talk");
          runChoice(1);
        }
        if (questStep("questM24Doc") === -1) {
          visitUrl("shop.php?whichshop=doc&action=talk");
          runChoice(1);
        }
        if (questStep("questM25Armorer") === -1) {
          visitUrl("shop.php?whichshop=armory&action=talk");
          runChoice(1);
        }
        if (
          myClass() === $class`Seal Clubber` &&
          !have($skill`Furious Wallop`) &&
          guildStoreAvailable()
        ) {
          visitUrl("guild.php?action=buyskill&skillid=32", true);
        }
        const stashItems = $items`repaid diaper, Buddy Bjorn, Crown of Thrones, origami pasties, Pantsgiving`;
        if (
          myInebriety() <= inebrietyLimit() &&
          (myClass() !== $class`Seal Clubber` || !have($skill`Furious Wallop`))
        )
          stashItems.push($item`haiku katana`);
        // FIXME: Dynamically figure out pointer ring approach.
        withStash(stashItems, () => {
          withVIPClan(() => {
            // 0. diet stuff.
            runDiet();

            // 1. get a ticket
            ensureBarfAccess();

            // 2. make an outfit (amulet coin, pantogram, etc), misc other stuff (VYKEA, songboom, robortender drinks)
            dailySetup();

            setDefaultMaximizeOptions({
              preventEquip: $items`broken champagne bottle, Spooky Putty snake, Spooky Putty mitre, Spooky Putty leotard, Spooky Putty ball, papier-mitre`,
            });

            // 4. do some embezzler stuff
            freeFights();
            dailyFights();

            // 5. burn turns at barf
            try {
              while (canContinue()) {
                barfTurn();
              }
            } finally {
              setAutoAttack(0);
            }
          });
        });
      }
    );
  } finally {
    visitUrl(`account.php?actions[]=flag_aabosses&flag_aabosses=${aaBossFlag}&action=Update`, true);
    if (startingGarden && have(startingGarden)) use(startingGarden);
    if (questStep("_questPartyFair") > 0) {
      const partyFairInfo = get("_questPartyFairProgress").split(" ");
      print(
        `Gerald/ine wants ${partyFairInfo[0]} ${toItem(partyFairInfo[1]).plural}, please!`,
        "blue"
      );
    }
    print(
      `You fought ${log.initialEmbezzlersFought} KGEs at the beginning of the day, and an additional ${log.digitizedEmbezzlersFought} digitized KGEs throughout the day. Good work, probably!`,
      "blue"
    );
  }
}
