import {
  availableAmount,
  buy,
  changeMcd,
  cliExecute,
  getCampground,
  getClanLounge,
  haveSkill,
  itemAmount,
  mallPrice,
  maximize,
  myClass,
  myPrimestat,
  myThrall,
  numericModifier,
  print,
  retrieveItem,
  runChoice,
  setAutoAttack,
  toInt,
  use,
  useFamiliar,
  useSkill,
  visitUrl,
} from "kolmafia";
import {
  $class,
  $effect,
  $familiar,
  $familiars,
  $item,
  $items,
  $location,
  $skill,
  $stat,
  $thrall,
  adventureMacro,
  get,
  have,
  property,
  SongBoom,
  SourceTerminal,
} from "libram";
import { horseradish } from "./diet";
import { meatFamiliar } from "./familiar";
import {
  baseMeat,
  ensureEffect,
  findRun,
  prepWandererZone,
  questStep,
  Requirement,
  saleValue,
  tryFeast,
} from "./lib";
import { freeFightOutfit } from "./outfit";
import { withStash } from "./clan";
import { set, withChoice, withChoices } from "libram";
import { estimatedTurns } from "./globalvars";
import { Macro } from "./combat";

export function voterSetup(): void {
  if (have($item`"I Voted!" sticker`) || !(get("voteAlways") || get("_voteToday"))) return;
  visitUrl("place.php?whichplace=town_right&action=townright_vote");

  const votingMonsterPriority = [
    "terrible mutant",
    "angry ghost",
    "government bureaucrat",
    "annoyed snake",
    "slime blob",
  ];

  const initPriority = new Map<string, number>([
    ["Meat Drop: +30", 10],
    ["Item Drop: +15", 9],
    ["Familiar Experience: +2", 8],
    ["Adventures: +1", 7],
    ["Monster Level: +10", 5],
    [`${myPrimestat()} Percent: +25`, 3],
    [`Experience (${myPrimestat()}): +4`, 2],
    ["Meat Drop: -30", -2],
    ["Item Drop: -15", -2],
    ["Familiar Experience: -2", -2],
  ]);

  const monsterVote =
    votingMonsterPriority.indexOf(get("_voteMonster1")) <
    votingMonsterPriority.indexOf(get("_voteMonster2"))
      ? 1
      : 2;

  const voteLocalPriorityArr = [
    [0, initPriority.get(get("_voteLocal1")) || (get("_voteLocal1").indexOf("-") === -1 ? 1 : -1)],
    [1, initPriority.get(get("_voteLocal2")) || (get("_voteLocal2").indexOf("-") === -1 ? 1 : -1)],
    [2, initPriority.get(get("_voteLocal3")) || (get("_voteLocal3").indexOf("-") === -1 ? 1 : -1)],
    [3, initPriority.get(get("_voteLocal4")) || (get("_voteLocal4").indexOf("-") === -1 ? 1 : -1)],
  ];

  const bestVotes = voteLocalPriorityArr.sort((a, b) => b[1] - a[1]);
  const firstInit = bestVotes[0][0];
  const secondInit = bestVotes[1][0];

  visitUrl(
    `choice.php?option=1&whichchoice=1331&g=${monsterVote}&local[]=${firstInit}&local[]=${secondInit}`
  );
}

export function configureGear(): void {
  if (have($familiar`Cornbeefadon`) && !have($item`amulet coin`)) {
    useFamiliar($familiar`Cornbeefadon`);
    use($item`box of Familiar Jacks`);
  }

  if (have($item`portable pantogram`) && !have($item`pantogram pants`)) {
    retrieveItem($item`ten-leaf clover`);
    retrieveItem($item`porquoise`);
    retrieveItem($item`bubblin' crude`);
    const m = new Map([
      [$stat`Muscle`, 1],
      [$stat`Mysticality`, 2],
      [$stat`Moxie`, 3],
    ]).get(myPrimestat());
    visitUrl("inv_use.php?pwd&whichitem=9573");
    visitUrl(`choice.php?whichchoice=1270&pwd&option=1&m=${m}&e=5&s1=5789,1&s2=706,1&s3=24,1`);
  }

  if (have($item`Fourth of May Cosplay Saber`) && get("_saberMod") === 0) {
    // Get familiar weight.
    visitUrl("main.php?action=may4");
    runChoice(4);
  }

  if (have($item`Bastille Battalion control rig`) && get("_bastilleGames") === 0) {
    cliExecute("bastille myst brutalist gesture");
  }
}

export function latte(): void {
  const latte = $item`latte lovers member's mug`;
  if (have(latte) && questStep("questL02Larva") > -1 && questStep("questL11MacGuffin") > -1) {
    withChoice(1329, 2, () => visitUrl("main.php?latte=1", false));
    if (
      numericModifier(latte, "Familiar Weight") !== 5 ||
      numericModifier(latte, "Meat Drop") !== 40
    ) {
      if (!get("latteUnlocks").includes("cajun") && findRun()) {
        withChoices({ 923: 1, 924: 1 }, () => {
          while (!get("latteUnlocks").includes("cajun") && findRun()) {
            const runSource = findRun();
            if (!runSource) break;
            if (runSource.prepare) runSource.prepare();
            freeFightOutfit([
              new Requirement([], { forceEquip: $items`latte lovers member's mug` }),
              ...(runSource.requirement ? [runSource.requirement] : []),
            ]);
            adventureMacro($location`The Black Forest`, runSource.macro);
            horseradish();
          }
        });
      }
      if (!get("latteUnlocks").includes("rawhide") && findRun()) {
        withChoices({ 502: 2, 505: 2 }, () => {
          while (!get("latteUnlocks").includes("rawhide") && findRun()) {
            const runSource = findRun();
            if (!runSource) break;
            if (runSource.prepare) runSource.prepare();
            freeFightOutfit([
              new Requirement([], { forceEquip: $items`latte lovers member's mug` }),
              ...(runSource.requirement ? [runSource.requirement] : []),
            ]);
            adventureMacro($location`The Spooky Forest`, runSource.macro);
            horseradish();
          }
        });
      }
      if (!get("latteUnlocks").includes("carrot") && findRun()) {
        while (!get("latteUnlocks").includes("carrot") && findRun()) {
          const runSource = findRun();
          if (!runSource) break;
          if (runSource.prepare) runSource.prepare();
          freeFightOutfit([
            new Requirement([], { forceEquip: $items`latte lovers member's mug` }),
            ...(runSource.requirement ? [runSource.requirement] : []),
          ]);
          adventureMacro($location`The Dire Warren`, runSource.macro);
          horseradish();
        }
      }
      if (
        get("latteUnlocks").includes("cajun") &&
        get("latteUnlocks").includes("rawhide") &&
        get("_latteRefillsUsed") < 3
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
    }
  }
}

export function prepFamiliars(): void {
  if (have($familiar`Robortender`)) {
    for (const drink of $items`Newark, drive-by shooting, Feliz Navidad, single entendre, Bloody Nora`) {
      if (get("_roboDrinks").includes(drink.name)) continue;
      useFamiliar($familiar`Robortender`);
      if (itemAmount(drink) === 0) retrieveItem(1, drink);
      print(`Feeding robortender ${drink}.`, "blue");
      visitUrl(`inventory.php?action=robooze&which=1&whichitem=${toInt(drink)}`);
    }
  }

  if (have($item`mumming trunk`) && !get("_mummeryMods").includes("Meat Drop")) {
    useFamiliar(meatFamiliar());
    cliExecute("mummery meat");
  }

  if (
    have($item`mumming trunk`) &&
    !get("_mummeryMods").includes("Item Drop") &&
    have($familiar`Trick-or-Treating Tot`)
  ) {
    useFamiliar($familiar`Trick-or-Treating Tot`);
    cliExecute("mummery item");
  }

  if (get("_feastUsed") === 0) {
    withStash($items`moveable feast`, () => {
      if (have($item`moveable feast`))
        [
          ...$familiars`Pocket Professor, Frumious Bandersnatch, Pair of Stomping Boots`,
          meatFamiliar(),
        ].forEach(tryFeast);
    });
  }
}

export function horse(): void {
  visitUrl("place.php?whichplace=town_right");
  if (get("horseryAvailable") && get("_horsery") !== "dark horse") {
    cliExecute("horsery dark");
  }
}

export function dailyBuffs(): void {
  if (
    !get("_clanFortuneBuffUsed") &&
    have($item`Clan VIP Lounge key`) &&
    getClanLounge()["Clan Carnival Game"] !== undefined
  ) {
    cliExecute("fortune buff meat");
  }

  if (!get("demonSummoned") && get("demonName2", false) && get("questL11Manor") === "finished") {
    cliExecute("summon Preternatural Greed");
  }

  while (SourceTerminal.have() && SourceTerminal.getEnhanceUses() < 3) {
    cliExecute("terminal enhance meat.enh");
  }
  if (!get("_madTeaParty")) {
    retrieveItem($item`filthy knitted dread sack`);
    ensureEffect($effect`Down the Rabbit Hole`);
    cliExecute("hatter 22");
  }
}

export function configureMisc(): void {
  if (SongBoom.songChangesLeft() > 0) SongBoom.setSong("Total Eclipse of Your Meat");
  if (SourceTerminal.have()) {
    SourceTerminal.educate([$skill`Extract`, $skill`Digitize`]);
    SourceTerminal.enquiry($effect`familiar.enq`);
  }

  if (get("_VYKEACompanionLevel") === 0) {
    const vykeas: [number, number][] = [
      [1, 0],
      [2, 1],
      [3, 11],
    ]; //excluding 4 and 5 as per bean's suggestion
    const vykeaProfit = (level: number, cost: number) =>
      estimatedTurns() * baseMeat * 0.1 * level -
      5 * mallPrice($item`VYKEA rail`) +
      cost * mallPrice($item`VYKEA dowel`) +
      5 * mallPrice($item`VYKEA plank`) +
      1 * mallPrice($item`VYKEA hex key`);

    if (vykeas.some(([level, cost]) => vykeaProfit(level, cost) > 0)) {
      const level = vykeas.sort((a, b) => vykeaProfit(...b) - vykeaProfit(...a))[0][0];
      retrieveItem($item`VYKEA hex key`);
      cliExecute(`create level ${level} couch`);
    }
  }

  if (
    myClass() === $class`Pastamancer` &&
    myThrall() !== $thrall`Lasagmbie` &&
    haveSkill($skill`Bind Lasagmbie`)
  ) {
    useSkill($skill`Bind Lasagmbie`);
  }

  if (
    getClanLounge()["Olympic-sized Clan crate"] !== undefined &&
    !get("_olympicSwimmingPoolItemFound") &&
    have($item`Clan VIP Lounge key`)
  ) {
    cliExecute("swim item");
  }

  changeMcd(10);
}

export function volcanoDailies(): void {
  if (!(get("hotAirportAlways") || get("_hotAirportToday"))) return;
  if (!get("_volcanoItemRedeemed")) checkVolcanoQuest();

  print("Getting my free volcoino!", "blue");
  if (!get("_infernoDiscoVisited")) {
    $items`smooth velvet pocket square, smooth velvet socks, smooth velvet hat, smooth velvet shirt, smooth velvet hanky, smooth velvet pants`.forEach(
      (discoEquip) => {
        retrieveItem(discoEquip);
      }
    );
    maximize("disco style", false);
    visitUrl("place.php?whichplace=airport_hot&action=airport4_zone1");
    runChoice(7);
  }

  if (have($skill`Unaccompanied Miner`) && get("_unaccompaniedMinerUsed") < 5) {
    cliExecute(`minevolcano.ash ${5 - get("_unaccompaniedMinerUsed")}`);
  }
}
function checkVolcanoQuest() {
  print("Checking volcano quest", "blue");
  visitUrl("place.php?whichplace=airport_hot&action=airport4_questhub");
  const volcanoItems = [
    property.getItem("_volcanoItem1") || $item`none`,
    property.getItem("_volcanoItem2") || $item`none`,
    property.getItem("_volcanoItem3") || $item`none`,
  ];
  const volcanoWhatToDo: Map<Item, () => boolean> = new Map<Item, () => boolean>([
    [
      $item`New Age healing crystal`,
      () => {
        if (availableAmount($item`New Age healing crystal`) >= 5) return true;
        else {
          return (
            buy(
              5 - availableAmount($item`New Age healing crystal`),
              $item`New Age healing crystal`,
              1000
            ) ===
            5 - availableAmount($item`New Age healing crystal`)
          );
        }
      },
    ],
    [
      $item`SMOOCH bottlecap`,
      () => {
        if (availableAmount($item`SMOOCH bottlecap`) > 0) return true;
        else return buy(1, $item`SMOOCH bottlecap`, 5000) === 1;
      },
    ],
    [
      $item`gooey lava globs`,
      () => {
        if (availableAmount($item`gooey lava globs`) >= 5) {
          return true;
        } else {
          const toBuy = 5 - availableAmount($item`gooey lava globs`);
          return buy(toBuy, $item`gooey lava globs`, 5000) === toBuy;
        }
      },
    ],
    [
      $item`fused fuse`,
      () => {
        return have($item`Clara's bell`);
      },
    ],
    [
      $item`smooth velvet bra`,
      () => {
        if (availableAmount($item`smooth velvet bra`) < 3) {
          cliExecute(
            `acquire ${(
              3 - availableAmount($item`smooth velvet bra`)
            ).toString()} smooth velvet bra`
          );
        }
        return availableAmount($item`smooth velvet bra`) >= 3;
      },
    ],
    [
      $item`SMOOCH bracers`,
      () => {
        if (availableAmount($item`SMOOCH bracers`) < 3) {
          cliExecute(
            `acquire ${(3 - availableAmount($item`SMOOCH bracers`)).toString()} smooch bracers`
          );
        }
        return availableAmount($item`SMOOCH bracers`) >= 3;
      },
    ],
  ]);
  for (const [volcanoItem, tryToGetIt] of volcanoWhatToDo.entries()) {
    if (volcanoItems.includes(volcanoItem)) {
      if (tryToGetIt()) {
        if (volcanoItem !== $item`fused fuse`) {
          visitUrl("place.php?whichplace=airport_hot&action=airport4_questhub");
          print(`Alright buddy, turning in ${volcanoItem.plural} for a volcoino!`, "red");
          const choice =
            volcanoItems.indexOf(volcanoItem) === -1 ? 4 : 1 + volcanoItems.indexOf(volcanoItem);
          runChoice(choice);
        }
      }
    }
  }
}

export function cheat(): void {
  if (have($item`Deck of Every Card`)) {
    ["1952 Mickey Mantle", "Island", "Ancestral Recall"].forEach((card) => {
      if (get("_deckCardsDrawn") <= 10 && !get("_deckCardsSeen").includes(card))
        cliExecute(`cheat ${card}`);
    });
  }
}

export function gin(): void {
  if (have($item`Time-Spinner`)) {
    if (
      !get("_timeSpinnerReplicatorUsed") &&
      get("timeSpinnerMedals") >= 5 &&
      get("_timeSpinnerMinutesUsed") <= 8
    ) {
      cliExecute("FarFuture drink");
    }
  }
}

const teas = $items`cuppa Activi tea, cuppa Alacri tea, cuppa Boo tea, cuppa Chari tea, cuppa Craft tea, cuppa Cruel tea, cuppa Dexteri tea, cuppa Feroci tea, cuppa Flamibili tea, cuppa Flexibili tea, cuppa Frost tea, cuppa Gill tea, cuppa Impregnabili tea, cuppa Improprie tea, cuppa Insani tea, cuppa Irritabili tea, cuppa Loyal tea, cuppa Mana tea, cuppa Mediocri tea, cuppa Monstrosi tea, cuppa Morbidi tea, cuppa Nas tea, cuppa Net tea, cuppa Neuroplastici tea, cuppa Obscuri tea, cuppa Physicali tea, cuppa Proprie tea, cuppa Royal tea, cuppa Serendipi tea, cuppa Sobrie tea, cuppa Toast tea, cuppa Twen tea, cuppa Uncertain tea, cuppa Vitali tea, cuppa Voraci tea, cuppa Wit tea, cuppa Yet tea`;
export function pickTea(): void {
  if (!getCampground()["potted tea tree"] || get("_pottedTeaTreeUsed")) return;
  const bestTea = teas.sort((a, b) => saleValue(b) - saleValue(a))[0];
  const shakeVal = 3 * saleValue(...teas);
  const teaAction = shakeVal > saleValue(bestTea) ? "shake" : bestTea.name;
  cliExecute(`teatree ${teaAction}`);
}

export function gaze(): void {
  if (!get("getawayCampsiteUnlocked")) return;
  if (!get("_campAwayCloudBuffs")) visitUrl("place.php?whichplace=campaway&action=campaway_sky");
  while (get("_campAwaySmileBuffs") < 3)
    visitUrl("place.php?whichplace=campaway&action=campaway_sky");
}
export function jellyfish(): void {
  if (
    !have($familiar`Space Jellyfish`) ||
    !(
      (have($skill`Meteor Lore`) && get("_macrometeoriteUses") < 10) ||
      (have($item`Powerful Glove`) && get("_powerfulGloveBatteryPowerUsed") < 91)
    )
  ) {
    return;
  }
  useFamiliar($familiar`Space Jellyfish`);
  setAutoAttack(0);
  freeFightOutfit();
  while (findRun(false) && have($skill`Meteor Lore`) && get("_macrometeoriteUses") < 10) {
    const runSource = findRun(false);
    if (!runSource) break;
    if (runSource.prepare) runSource.prepare();
    freeFightOutfit([...(runSource.requirement ? [runSource.requirement] : [])]);
    const jellyMacro = Macro.while_(
      "!pastround 28 && hasskill macrometeorite",
      Macro.skill("extract jelly").skill("macrometeorite")
    )
      .trySkill("extract jelly")
      .step(runSource.macro);
    adventureMacro($location`Barf Mountain`, jellyMacro);
  }
  if (have($item`Powerful Glove`)) {
    while (findRun(false) && get("_powerfulGloveBatteryPowerUsed") < 91) {
      const runSource = findRun(false);
      if (!runSource) break;
      if (runSource.prepare) runSource.prepare();
      freeFightOutfit([
        new Requirement([], { forceEquip: $items`Powerful Glove` }),
        ...(runSource.requirement ? [runSource.requirement] : []),
      ]);
      const jellyMacro = Macro.while_(
        "!pastround 28 && hasskill CHEAT CODE: Replace Enemy",
        Macro.skill("extract jelly").skill("CHEAT CODE: Replace Enemy")
      )
        .trySkill("extract jelly")
        .step(runSource.macro);
      adventureMacro($location`Barf Mountain`, jellyMacro);
    }
  }
}

export function gingerbreadPrepNoon(): void {
  if (!get("gingerbreadCityAvailable") && !get("_gingerbreadCityToday")) return;
  if (
    get("gingerAdvanceClockUnlocked") &&
    !get("_gingerbreadClockVisited") &&
    get("_gingerbreadCityTurns") <= 3
  ) {
    withChoice(1215, 1, () => adventureMacro($location`Gingerbread Civic Center`, Macro.abort()));
  }
  while (
    findRun() &&
    get("_gingerbreadCityTurns") + (get("_gingerbreadClockAdvanced") ? 5 : 0) < 9
  ) {
    const run = findRun();
    if (!run) break;
    if (run.prepare) run.prepare();
    freeFightOutfit([...(run.requirement ? [run.requirement] : [])]);
    adventureMacro($location`Gingerbread Civic Center`, run.macro);
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
}

export function hipsterFishing(): void {
  if (get("_hipsterAdv") >= 7) return;
  if (have($familiar`Mini-Hipster`)) {
    useFamiliar($familiar`Mini-Hipster`);
  } else if (have($familiar`Artistic Goth Kid`)) {
    useFamiliar($familiar`Artistic Goth Kid`);
  } else return;

  while (findRun(false) && get("_hipsterAdv") < 7) {
    const targetLocation =
      prepWandererZone().combatPercent === 100 ? prepWandererZone() : $location`Noob Cave`;
    const runSource = findRun(false);
    if (!runSource) return;
    if (runSource.prepare) runSource.prepare();
    freeFightOutfit([
      ...(runSource.requirement ? [runSource.requirement] : []),
      new Requirement([], {
        bonusEquip: new Map<Item, number>([
          [$item`ironic moustache`, saleValue($item`mole skin notebook`)],
          [$item`chiptune guitar`, saleValue($item`ironic knit cap`)],
          [$item`fixed-gear bicycle`, saleValue($item`ironic oversized sunglasses`)],
        ]),
      }),
    ]);
    adventureMacro(
      targetLocation,
      Macro.if_(
        `(monsterid 969) || (monsterid 970) || (monsterid 971) || (monsterid 972) || (monsterid 973) || (monstername Black Crayon *)`,
        Macro.meatKill()
      ).step(runSource.macro)
    );
  }
}

export function martini(): void {
  if (
    !have($item`Kremlin's Greatest Briefcase`) ||
    get("_kgbClicksUsed") > 17 ||
    get("_kgbDispenserUses") >= 3
  ) {
    return;
  }
  cliExecute("briefcase collect");
}
