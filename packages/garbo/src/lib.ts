import {
  availableChoiceOptions,
  canAdventure,
  choiceFollowsFight,
  cliExecute,
  eat,
  Familiar,
  familiarWeight,
  fileToBuffer,
  fullnessLimit,
  getLocketMonsters,
  getMonsters,
  gitInfo,
  handlingChoice,
  haveEquipped,
  haveSkill,
  holiday,
  inebrietyLimit,
  isDarkMode,
  Item,
  itemAmount,
  itemDropsArray,
  lastMonster,
  Location,
  mallPrices,
  meatDropModifier,
  Monster,
  mpCost,
  myBjornedFamiliar,
  myEnthronedFamiliar,
  myFamiliar,
  myFullness,
  myHp,
  myInebriety,
  myLocation,
  myMaxhp,
  myMaxmp,
  myMp,
  mySoulsauce,
  mySpleenUse,
  myThrall,
  myTurncount,
  numericModifier,
  print,
  printHtml,
  restoreHp,
  restoreMp,
  rollover,
  runChoice,
  runCombat,
  sessionStorage,
  setLocation,
  Skill,
  soulsauceCost,
  spleenLimit,
  todayToString,
  totalFreeRests,
  toUrl,
  use,
  useFamiliar,
  userConfirm,
  useSkill,
  visitUrl,
  weightAdjustment,
} from "kolmafia";
import {
  $effect,
  $familiar,
  $item,
  $location,
  $monster,
  $skill,
  $thralls,
  ActionSource,
  bestLibramToCast,
  ChateauMantegna,
  clamp,
  ClosedCircuitPayphone,
  CombatLoversLocket,
  Counter,
  ensureFreeRun,
  FindActionSourceConstraints,
  get,
  getBanishedMonsters,
  getKramcoWandererChance,
  getTodaysHolidayWanderers,
  have,
  JuneCleaver,
  Macro,
  maxBy,
  PropertiesManager,
  property,
  realmAvailable,
  set,
  SongBoom,
  SourceTerminal,
  sum,
  tryFindBanish,
  tryFindFreeRun,
  uneffect,
} from "libram";
import { acquire } from "./acquire";
import { globalOptions } from "./config";
import { garboAverageValue, garboValue } from "./garboValue";
import { Outfit, OutfitSpec } from "grimoire-kolmafia";

export const eventLog: {
  initialCopyTargetsFought: number;
  digitizedCopyTargetsFought: number;
  copyTargetSources: Array<string>;
  yachtzees: number;
} = {
  initialCopyTargetsFought: 0,
  digitizedCopyTargetsFought: 0,
  copyTargetSources: [],
  yachtzees: 0,
};

export enum BonusEquipMode {
  FREE,
  MEAT_TARGET,
  DMT,
  BARF,
}

export function modeIsFree(mode: BonusEquipMode): boolean {
  return [BonusEquipMode.FREE, BonusEquipMode.DMT].includes(mode);
}

export function modeUseLimitedDrops(mode: BonusEquipMode): boolean {
  return [BonusEquipMode.BARF, BonusEquipMode.FREE].includes(mode);
}

export function modeValueOfMeat(mode: BonusEquipMode): number {
  return modeIsFree(mode)
    ? 0
    : (baseMeat() +
        (mode === BonusEquipMode.MEAT_TARGET ? targetMeatDifferential() : 0)) /
        100;
}

export function modeValueOfItem(mode: BonusEquipMode): number {
  return mode === BonusEquipMode.BARF ? 0.72 : 0;
}

export const WISH_VALUE = 50000;
export const HIGHLIGHT = isDarkMode() ? "yellow" : "blue";
export const ESTIMATED_OVERDRUNK_TURNS = 60;
export const MEAT_TARGET_MULTIPLIER = (): number =>
  globalOptions.prefs.meatTargetMultiplier;

export const propertyManager = new PropertiesManager();

const songboomMeat = () =>
  SongBoom.have() &&
  (SongBoom.songChangesLeft() > 0 ||
    (SongBoom.song() === "Total Eclipse of Your Meat" &&
      myInebriety() <= inebrietyLimit()))
    ? 25
    : 0;

// all tourists have a basemeat of 250
export const baseMeat = () => 250 + songboomMeat();
export const targetMeat = () =>
  (globalOptions.target.minMeat + globalOptions.target.maxMeat) / 2 +
  songboomMeat();
export const basePointerRingMeat = () => 500;
export const targetPointerRingMeat = () => {
  if (globalOptions.target.attributes.includes("FREE")) return 0;
  const meat = targetMeat();
  if (meat >= 500) {
    return 700;
  } else if (meat >= 100) {
    return 500;
  } else if (meat >= 1) {
    return 300;
  }
  return 50;
};

export const targetMeatDifferential = () => {
  const baseMeatVal = baseMeat();
  const targetMeatVal = targetMeat();

  return clamp(targetMeatVal - baseMeatVal, 0, targetMeatVal);
};

export const targettingMeat = () =>
  !isFree(globalOptions.target) && targetMeat() > baseMeat();

export const targettingItems = () => !targettingMeat();

export const gooseDroneEligible = () =>
  targettingItems() &&
  itemDropsArray(globalOptions.target).filter(
    (item) => !["c", "0", "p", "a"].includes(item.type),
  ).length === 1 &&
  have($familiar`Grey Goose`);

export function averageTargetNet(): number {
  return targettingItems()
    ? valueDrops(globalOptions.target)
    : (targetMeat() * meatDropModifier()) / 100;
}

export function averageTouristNet(): number {
  return (baseMeat() * meatDropModifier()) / 100;
}

export function expectedTargetProfit(): number {
  return isFreeAndCopyable(globalOptions.target)
    ? averageTargetNet()
    : averageTargetNet() - averageTouristNet();
}

export function safeInterrupt(): void {
  if (
    globalOptions.prefs.rolloverBuffer * 60 * 1000 >
    rollover() * 1000 - Date.now()
  ) {
    throw new Error(
      `Eep! It's a mere ${Math.round(
        rollover() - Date.now() / 1000,
      )} seconds until rollover!`,
    );
  }
  if (get("garbo_interrupt", false)) {
    set("garbo_interrupt", false);
    throw new Error("User interrupt requested. Stopping Garbage Collector.");
  }
}

export function resetDailyPreference(trackingPreference: string): boolean {
  const today = todayToString();
  if (property.getString(trackingPreference) !== today) {
    property.set(trackingPreference, today);
    return true;
  } else {
    return false;
  }
}

export function setChoice(adventure: number, value: number): void {
  propertyManager.setChoices({ [adventure]: value });
}

/**
 * Shuffle a copy of {array}.
 * @param array Array to shuffle.
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffledArray[i];
    shuffledArray[i] = shuffledArray[j];
    shuffledArray[j] = temp;
  }
  return shuffledArray;
}

export function mapMonster(location: Location, monster: Monster): void {
  if (
    haveSkill($skill`Map the Monsters`) &&
    !get("mappingMonsters") &&
    get("_monstersMapped") < 3
  ) {
    useSkill($skill`Map the Monsters`);
  }

  if (!get("mappingMonsters")) throw "Failed to setup Map the Monsters.";

  const myTurns = myTurncount();
  let mapPage = "";
  // Handle zone intros and holiday wanderers
  for (let tries = 0; tries < 10; tries++) {
    mapPage = visitUrl(toUrl(location), false, true);
    if (mapPage.includes("Leading Yourself Right to Them")) break;
    // Time-pranks can show up here, annoyingly
    if (
      mapPage.includes("<!-- MONSTERID: 1965 -->") ||
      mapPage.includes("<!-- MONSTERID: 1622  -->")
    ) {
      runCombat(Macro.attack().repeat().toString());
    }
    if (handlingChoice()) runChoice(-1);
    if (myTurncount() > myTurns + 1) throw `Map the monsters unsuccessful?`;
    if (tries === 9) throw `Stuck trying to Map the monsters.`;
  }

  const fightPage = visitUrl(
    `choice.php?pwd&whichchoice=1435&option=1&heyscriptswhatsupwinkwink=${monster.id}`,
  );
  if (!fightPage.includes(monster.name)) {
    throw "Something went wrong starting the fight.";
  }
  if (choiceFollowsFight()) runChoice(-1);
}

/**
 * Returns true if the arguments have all elements equal.
 * @param array1 First array.
 * @param array2 Second array.
 */
export function arrayEquals<T>(array1: T[], array2: T[]): boolean {
  return (
    array1.length === array2.length &&
    array1.every((element, index) => element === array2[index])
  );
}

export function questStep(questName: string): number {
  const stringStep = property.getString(questName);
  if (stringStep === "unstarted" || stringStep === "") return -1;
  else if (stringStep === "started") return 0;
  else if (stringStep === "finished") return 999;
  else {
    if (stringStep.substring(0, 4) !== "step") {
      throw "Quest state parsing error.";
    }
    return parseInt(stringStep.substring(4), 10);
  }
}

export function tryFeast(familiar: Familiar): void {
  if (have(familiar)) {
    useFamiliar(familiar);
    use($item`moveable feast`);
  }
}

export function tryFindFreeRunOrBanish(
  constraints?: FindActionSourceConstraints,
): ActionSource | null {
  return tryFindFreeRun(constraints) ?? tryFindBanish(constraints);
}

const ltbRestraints: FindActionSourceConstraints = {
  requireUnlimited: () => true,
  noFamiliar: () => true,
  noRequirements: () => true,
  maximumCost: () => get("autoBuyPriceLimit"),
};
export function ltbRun(): ActionSource {
  return tryFindFreeRunOrBanish(ltbRestraints) ?? ensureFreeRun(ltbRestraints);
}

export function kramcoGuaranteed(): boolean {
  return (
    have($item`Kramco Sausage-o-Matic™`) && getKramcoWandererChance() >= 1
  );
}

const log: string[] = [];

export function logMessage(message: string): void {
  log.push(message);
}

export function printLog(color: string): void {
  for (const message of log) {
    print(message, color);
  }
}

/**
 * Prints Garbo's help menu to the GCLI.
 */
export function printHelpMenu(): void {
  type tableData = { tableItem: string; description: string };
  const helpData: tableData[] = JSON.parse(fileToBuffer("garbo_help.json"));
  const tableMaxCharWidth = 82;
  const tableRows = helpData.map(({ tableItem, description }) => {
    const croppedDescription =
      description.length > tableMaxCharWidth
        ? description.replace(/(.{82}\s)/g, `$&\n`)
        : description;
    return `<tr><td width=200><pre> ${tableItem}</pre></td><td width=600><pre>${croppedDescription}</pre></td></tr>`;
  });
  printHtml(
    `<table border=2 width=800 style="font-family:monospace;">${tableRows.join(
      ``,
    )}</table>`,
  );
}

/**
 * Determines the opportunity cost of not using the Pillkeeper to fight an embezzler
 * @returns The expected value of using a pillkeeper charge to fight an embezzler
 */
export function pillkeeperOpportunityCost(): number {
  const canTreasury = canAdventure($location`Cobb's Knob Treasury`);

  const alternateUses = [
    {
      can: canTreasury,
      value: MEAT_TARGET_MULTIPLIER() * get("valueOfAdventure"),
    },
    {
      can: realmAvailable("sleaze"),
      value: 40000,
    },
  ].filter((x) => x.can);

  const alternateUse = alternateUses.length
    ? maxBy(alternateUses, "value")
    : undefined;
  const alternateUseValue = alternateUse?.value;

  if (!alternateUseValue) return 0;
  if (!canTreasury) return alternateUseValue;

  const canStartChain = [
    CombatLoversLocket.have() && getLocketMonsters()[globalOptions.target.name],
    ChateauMantegna.have() &&
      ChateauMantegna.paintingMonster() === globalOptions.target &&
      !ChateauMantegna.paintingFought(),
    have($item`Clan VIP Lounge key`) && !get("_photocopyUsed"),
  ].some((x) => x);

  return canStartChain ? alternateUseValue : WISH_VALUE;
}

/**
 * Burns existing MP on the mall-optimal libram skill until unable to cast any more.
 */
export function burnLibrams(mpTarget = 0): void {
  let libramToCast = bestLibramToCast();
  while (libramToCast && mpCost(libramToCast) <= myMp() - mpTarget) {
    useSkill(libramToCast);
    libramToCast = bestLibramToCast();
  }
  if (mpTarget > 0) {
    cliExecute(`burn -${mpTarget}`);
  } else {
    cliExecute("burn *");
  }
}

export function howManySausagesCouldIEat() {
  if (!have($item`Kramco Sausage-o-Matic™`)) return 0;
  // You may be full but you can't be overfull
  if (myFullness() > fullnessLimit()) return 0;

  return clamp(
    23 - get("_sausagesEaten"),
    0,
    itemAmount($item`magical sausage`) +
      itemAmount($item`magical sausage casing`),
  );
}

export function safeRestoreMpTarget(): number {
  //  If our max MP is close to 200, we could be restoring every turn even if we don't need to, avoid that case.
  if (Math.abs(myMaxmp() - 200) < 40) {
    return Math.min(myMaxmp(), 100);
  }
  return Math.min(myMaxmp(), 200);
}

export function safeRestore(): void {
  if (
    get("_lastCombatLost") &&
    lastMonster() !== $monster`Sssshhsssblllrrggghsssssggggrrgglsssshhssslblgl`
  ) {
    set("_lastCombatLost", "false");
    throw new Error(
      "You lost your most recent combat! Check to make sure everything is alright before rerunning.",
    );
  }
  if (have($effect`Beaten Up`)) {
    if (
      lastMonster() ===
      $monster`Sssshhsssblllrrggghsssssggggrrgglsssshhssslblgl`
    ) {
      uneffect($effect`Beaten Up`);
    } else {
      throw new Error(
        "Hey, you're beaten up, and that's a bad thing. Lick your wounds, handle your problems, and run me again when you feel ready.",
      );
    }
  }
  if (myHp() < Math.min(myMaxhp() * 0.5, get("garbo_restoreHpTarget", 2000))) {
    restoreHp(Math.min(myMaxhp() * 0.9, get("garbo_restoreHpTarget", 2000)));
  }
  const mpTarget = safeRestoreMpTarget();
  const shouldRestoreMp = () => myMp() < mpTarget;

  if (shouldRestoreMp() && howManySausagesCouldIEat() > 0) {
    eat($item`magical sausage`);
  }

  const soulFoodCasts = Math.floor(
    mySoulsauce() / soulsauceCost($skill`Soul Food`),
  );
  if (shouldRestoreMp() && soulFoodCasts > 0) {
    useSkill(soulFoodCasts, $skill`Soul Food`);
  }

  if (shouldRestoreMp()) restoreMp(mpTarget);

  burnLibrams(mpTarget * 2); // Leave a mp buffer when burning
}

/**
 * Compares the local version of Garbo against the most recent release branch, printing results to the CLI
 */
export function checkGithubVersion(): void {
  if (process.env.GITHUB_REPOSITORY === "CustomBuild") {
    print("Skipping version check for custom build");
  } else if (process.env.GITHUB_REPOSITORY !== undefined) {
    const localSHA =
      gitInfo("loathers-garbage-collector-release").commit ||
      gitInfo("Loathing-Associates-Scripting-Society-garbage-collector-release")
        .commit;

    const gitData = visitUrl(
      `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/branches`,
    );
    if (!gitData) print("Failed to reach github!");
    else {
      // Query GitHub for latest release commit
      const gitBranches: { name: string; commit: { sha: string } }[] =
        JSON.parse(gitData);
      const releaseSHA = gitBranches.find(
        (branchInfo) => branchInfo.name === "release",
      )?.commit?.sha;

      print(
        `Local Version: ${localSHA} (built from ${process.env.GITHUB_REF_NAME}@${process.env.GITHUB_SHA})`,
      );
      if (releaseSHA === localSHA) {
        print("Garbo is up to date!", HIGHLIGHT);
      } else if (releaseSHA === undefined) {
        print(
          "Garbo may be out of date, unable to query GitHub for latest version. Maybe run 'git update'?",
          HIGHLIGHT,
        );
      } else {
        print(`Release Version: ${releaseSHA}`);
        print("Garbo is out of date. Please run 'git update'!", "red");
      }
    }
  } else {
    print(
      "Garbo was built from an unknown repository, unable to check for update.",
      HIGHLIGHT,
    );
  }
}

export function formatNumber(num: number): string {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

export function getChoiceOption(partialText: string): number {
  if (handlingChoice()) {
    const findResults = Object.entries(availableChoiceOptions()).find(
      (value) => value[1].indexOf(partialText) > -1,
    );
    if (findResults) {
      return parseInt(findResults[0]);
    }
  }
  return -1;
}

/**
 * Confirmation dialog that supports automatic resolution via garbo_autoUserConfirm preference
 * @param msg string to display in confirmation dialog
 * @param defaultValue default answer if user doesn't provide one
 * @param timeOut time to show dialog before submitting default value
 * @returns answer to confirmation dialog
 */
export function userConfirmDialog(
  msg: string,
  defaultValue: boolean,
  timeOut?: number,
): boolean {
  if (globalOptions.prefs.autoUserConfirm) {
    print(`Automatically selected ${defaultValue} for ${msg}`, "red");
    return defaultValue;
  }

  if (timeOut) return userConfirm(msg, timeOut, defaultValue);
  return userConfirm(msg);
}

function determineFreeBunnyBanish(): boolean {
  const extraOrbFights = have($item`miniature crystal ball`) ? 1 : 0;
  const possibleGregsFromSpleen =
    Math.floor((spleenLimit() - mySpleenUse()) / 2) * (3 + extraOrbFights);
  const currentAvailableGregs =
    Math.max(0, get("beGregariousCharges")) * (3 + extraOrbFights);
  const habitatFights =
    (3 - clamp(get("_monsterHabitatsRecalled"), 0, 3)) * (5 + extraOrbFights);
  const expectedPocketProfFights = !have($familiar`Pocket Professor`)
    ? 0
    : (!get("_garbo_meatChain", false)
        ? Math.max(10 - get("_pocketProfessorLectures"), 0)
        : 0) +
      (!get("_garbo_weightChain", false)
        ? Math.min(15 - get("_pocketProfessorLectures"), 5)
        : 0);
  const expectedDigitizesDuringGregs =
    SourceTerminal.have() && get("_sourceTerminalDigitizeUses") < 3 ? 3 : 0; // To encounter 3 digitize monsters it takes 91 adventures. Just estimate we fight all 3 to be safe.
  const expectedReplacerFights =
    (have($skill`Meteor Lore`) ? 10 - get("_macrometeoriteUses") : 0) +
    (have($item`Powerful Glove`)
      ? Math.floor((100 - get("_powerfulGloveBatteryPowerUsed")) / 10)
      : 0);
  const useFreeBanishes =
    getBanishedMonsters().get($item`ice house`) !== $monster`fluffy bunny` &&
    // 60 turns of banish from mafia middle finger ring, and 30 x 2 from two snokebombs
    // Account for our chain-starting fight as well as other embezzler sources that occur during our greg chain
    1 +
      possibleGregsFromSpleen +
      currentAvailableGregs +
      habitatFights +
      expectedPocketProfFights +
      expectedDigitizesDuringGregs +
      expectedReplacerFights <
      120 &&
    habitatFights + currentAvailableGregs + possibleGregsFromSpleen > 0 &&
    have($item`mafia middle finger ring`) &&
    !get("_mafiaMiddleFingerRingUsed") &&
    have($skill`Snokebomb`) &&
    get(`_snokebombUsed`) <= 1;

  return useFreeBanishes;
}

let usingFreeBunnyBanish: boolean;
export function getUsingFreeBunnyBanish(): boolean {
  if (usingFreeBunnyBanish === undefined) {
    usingFreeBunnyBanish = determineFreeBunnyBanish();
  }
  return usingFreeBunnyBanish;
}

const reservedBanishes = new Map<
  ActionSource["source"],
  () => boolean // function that returns true if we should disallow usage of the source while we're reserving embezzler banishers
>([
  [$skill`Snokebomb`, () => get(`_snokebombUsed`) > 0], // We intend to save at least 2 uses for embezzlers, so if we've already used one, disallow usage.
  [$item`mafia middle finger ring`, () => true],
]);

export function freeRunConstraints(spec?: OutfitSpec): {
  allowedAction: (action: ActionSource) => boolean;
} {
  return {
    allowedAction: (action: ActionSource): boolean => {
      const initialActionOutfit = Outfit.from(
        action.constraints.equipmentRequirements?.() ?? {},
      );

      if (!initialActionOutfit?.equip(spec ?? {})) return false;

      const disallowUsage = reservedBanishes.get(action.source);
      return !(disallowUsage?.() && getUsingFreeBunnyBanish());
    },
  };
}

// Barf setup info
const olfactionCopies = have($skill`Transcendent Olfaction`) ? 3 : 0;
const gallapagosCopies = have($skill`Gallapagosian Mating Call`) ? 1 : 0;
const garbageTourists = 1 + olfactionCopies + gallapagosCopies,
  touristFamilies = 1,
  angryTourists = 1;
const barfTourists = garbageTourists + touristFamilies + angryTourists;
export const garbageTouristRatio = garbageTourists / barfTourists;
const touristFamilyRatio = touristFamilies / barfTourists;
// 30 tourists till NC, with families counting as 3
// Estimate number of turns till the counter hits 27
// then estimate the expected number of turns required to hit a counter of >= 30
export const turnsToNC =
  (27 * barfTourists) /
    (garbageTourists + angryTourists + 3 * touristFamilies) +
  1 * touristFamilyRatio +
  2 * (1 - touristFamilyRatio) * touristFamilyRatio +
  3 * (1 - touristFamilyRatio) * (1 - touristFamilyRatio);

const GHOST_DOG_ADVENTURES = [
  "Puttin' it on Wax",
  "Wooof! Wooooooof!",
  "Playing Fetch*",
  "Your Dog Found Something Again",
] as const;

const JUNE_CLEAVER_ADVENTURES = [
  "Aunts not Ants",
  "Bath Time",
  "Beware of Aligator",
  "Delicious Sprouts",
  "Hypnotic Master",
  "Lost and Found",
  "Poetic Justice",
  "Summer Days",
  "Teacher's Pet",
] as const;

const VIOLET_FOG_ADVENTURES = [
  "She's So Unusual",
  "The Big Scary Place",
  "The Prince of Wishful Thinking",
  "Violet Fog",
] as const;

type LastAdventureOptions = {
  extraEncounters: string[];
  includeGhostDog: boolean;
  includeHolidayWanderers: boolean;
  includeJuneCleaver: boolean;
  includeVioletFog: boolean;
};

export function lastAdventureWasWeird(
  {
    extraEncounters = [],
    includeGhostDog = true,
    includeHolidayWanderers = true,
    includeJuneCleaver = true,
    includeVioletFog = true,
  } = {} as Partial<LastAdventureOptions>,
): boolean {
  return [
    ...extraEncounters,
    ...(includeGhostDog ? GHOST_DOG_ADVENTURES : []),
    ...(includeHolidayWanderers
      ? getTodaysHolidayWanderers().map((monster) => monster.name)
      : []),
    ...(includeJuneCleaver ? JUNE_CLEAVER_ADVENTURES : []),
    ...(includeVioletFog ? VIOLET_FOG_ADVENTURES : []),
  ].includes(get("lastEncounter"));
}

export const juneCleaverChoiceValues = {
  1467: {
    1: 0,
    2: 0,
    3: 5 * get("valueOfAdventure"),
  },
  1468: { 1: 0, 2: 5, 3: 0 },
  1469: { 1: 0, 2: $item`Dad's brandy`, 3: 1500 },
  1470: { 1: 0, 2: $item`teacher's pen`, 3: 0 },
  1471: { 1: $item`savings bond`, 2: 250, 3: 0 },
  1472: {
    1: $item`trampled ticket stub`,
    2: $item`fire-roasted lake trout`,
    3: 0,
  },
  1473: { 1: $item`gob of wet hair`, 2: 0, 3: 0 },
  1474: { 1: 0, 2: $item`guilty sprout`, 3: 0 },
  1475: { 1: $item`mother's necklace`, 2: 0, 3: 0 },
} as const;

export function valueJuneCleaverOption(result: Item | number): number {
  return result instanceof Item ? garboValue(result) : result;
}

export function bestJuneCleaverOption(
  id: (typeof JuneCleaver.choices)[number],
): 1 | 2 | 3 {
  const options = [1, 2, 3] as const;
  return maxBy(options, (option) =>
    valueJuneCleaverOption(juneCleaverChoiceValues[id][option]),
  );
}

export const romanticMonsterImpossible = (): boolean =>
  Counter.get("Romantic Monster Window end") === Infinity ||
  (Counter.get("Romantic Monster Window begin") > 0 &&
    Counter.get("Romantic Monster window begin") !== Infinity) ||
  get("_romanticFightsLeft") <= 0;

export function sober(): boolean {
  return (
    myInebriety() <=
    inebrietyLimit() + (myFamiliar() === $familiar`Stooper` ? -1 : 0)
  );
}

export type GarboItemLists = {
  Newark: string[];
  "Feliz Navidad": string[];
  trainset: string[];
};

export const asArray = <T>(singleOrArray: T | T[]): T[] =>
  Array.isArray(singleOrArray) ? singleOrArray : [singleOrArray];

let _bestShadowRift: Location | null = null;
export function bestShadowRift(): Location {
  if (!_bestShadowRift) {
    _bestShadowRift = withLocation($location`Shadow Rift`, () =>
      ClosedCircuitPayphone.chooseRift({
        canAdventure: true,
        otherFilter: (l: Location) =>
          l !== $location`Shadow Rift (The 8-Bit Realm)`,
        sortBy: (l: Location) => {
          // We probably aren't capping item drops with the penalty
          // so we don't really need to compute the actual outfit (or the dropModifier for that matter actually)
          const dropModifier = 1 + numericModifier("Item Drop") / 100;
          return sum(getMonsters(l), (m) => {
            return sum(
              itemDropsArray(m),
              ({ drop, rate }) =>
                garboValue(drop) * clamp((rate * dropModifier) / 100, 0, 1),
            );
          });
        },
      }),
    );
    if (!_bestShadowRift) {
      throw new Error("Failed to find a suitable Shadow Rift to adventure in");
    }
  }
  return _bestShadowRift;
}

export function withLocation<T>(location: Location, action: () => T): T {
  const start = myLocation();
  try {
    setLocation(location);
    return action();
  } finally {
    setLocation(start);
  }
}

export function freeRest(): boolean {
  if (get("timesRested") >= totalFreeRests()) return false;

  if (myHp() >= myMaxhp() && myMp() >= myMaxmp()) {
    if (acquire(1, $item`awful poetry journal`, 10000, false)) {
      use($item`awful poetry journal`);
    } else {
      // burn some mp so that we can rest
      const bestSkill = maxBy(
        Skill.all().filter((sk) => have(sk) && mpCost(sk) >= 1),
        (sk) => -mpCost(sk),
      ); // are there any other skills that cost mana which we should blacklist?
      // Facial expressions? But this usually won't be an issue since all *NORMAL* classes have access to a level1 1mp skill
      useSkill(bestSkill);
    }
  }

  if (get("chateauAvailable")) {
    visitUrl("place.php?whichplace=chateau&action=chateau_restlabelfree");
  } else if (get("getawayCampsiteUnlocked")) {
    visitUrl("place.php?whichplace=campaway&action=campaway_tentclick");
  } else {
    visitUrl("campground.php?action=rest");
  }

  return true;
}

export function printEventLog(): void {
  if (resetDailyPreference("garboTargetDate")) {
    property.set("garboTargetCount", 0);
    property.set("garboTargetSources", "");
    property.set("garboYachtzeeCount", 0);
  }
  const totalTargetCopies =
    property.getNumber("garboTargetCount", 0) +
    eventLog.initialCopyTargetsFought +
    eventLog.digitizedCopyTargetsFought;

  const allTargetSources = property
    .getString("garboTargetSources")
    .split(",")
    .filter((source) => source);
  allTargetSources.push(...eventLog.copyTargetSources);

  const yacthzeeCount = get("garboYachtzeeCount", 0) + eventLog.yachtzees;

  property.set("garboTargetCount", totalTargetCopies);
  property.set("garboTargetSources", allTargetSources.join(","));
  property.set("garboYachtzeeCount", yacthzeeCount);

  print(
    `You fought ${eventLog.initialCopyTargetsFought} ${globalOptions.target} at the beginning of the day, and an additional ${eventLog.digitizedCopyTargetsFought} digitized ${globalOptions.target} throughout the day. Good work, probably!`,
    HIGHLIGHT,
  );
  print(
    `Including this, you have fought ${totalTargetCopies} across all ascensions today`,
    HIGHLIGHT,
  );
  if (yacthzeeCount > 0) {
    print(
      `You explored the undersea yacht ${eventLog.yachtzees} times`,
      HIGHLIGHT,
    );
    print(
      `Including this, you explored the undersea yacht ${yacthzeeCount} times across all ascensions today`,
      HIGHLIGHT,
    );
  }
}

function untangleDigitizes(turnCount: number, chunks: number): number {
  const turnsPerChunk = turnCount / chunks;
  const monstersPerChunk = Math.sqrt((turnsPerChunk + 3) / 5 + 1 / 4) - 1 / 2;
  return Math.round(chunks * monstersPerChunk);
}

export function digitizedMonstersRemainingForTurns(
  estimatedTurns: number,
): number {
  if (!SourceTerminal.have()) return 0;

  const digitizesLeft = SourceTerminal.getDigitizeUsesRemaining();
  if (digitizesLeft === SourceTerminal.getMaximumDigitizeUses()) {
    return untangleDigitizes(
      estimatedTurns,
      SourceTerminal.getMaximumDigitizeUses(),
    );
  }

  const monsterCount = SourceTerminal.getDigitizeMonsterCount() + 1;

  const turnsLeftAtNextMonster =
    estimatedTurns - Counter.get("Digitize Monster");
  if (turnsLeftAtNextMonster <= 0) return 0;
  const turnsAtLastDigitize =
    turnsLeftAtNextMonster + ((monsterCount + 1) * monsterCount * 5 - 3);
  return (
    untangleDigitizes(turnsAtLastDigitize, digitizesLeft + 1) -
    SourceTerminal.getDigitizeMonsterCount()
  );
}

function maxCarriedFamiliarDamage(familiar: Familiar): number {
  // Only considering familiars we reasonably may carry
  switch (familiar) {
    // +5 to Familiar Weight
    case $familiar`Animated Macaroni Duck`:
      return 50;
    case $familiar`Barrrnacle`:
    case $familiar`Gelatinous Cubeling`:
    case $familiar`Penguin Goodfella`:
      return 30;
    case $familiar`Misshapen Animal Skeleton`:
      return 40 + numericModifier("Spooky Damage");

    // +25% Meat from Monsters
    case $familiar`Hobo Monkey`:
      return 25;

    // +20% Meat from Monsters
    case $familiar`Grouper Groupie`:
      // Double sleaze damage at Barf Mountain
      return (
        25 +
        numericModifier("Sleaze Damage") *
          (myLocation() === $location`Barf Mountain` ? 2 : 1)
      );
    case $familiar`Jitterbug`:
      return 20;
    case $familiar`Mutant Cactus Bud`:
      // 25 poison damage (25+12+6+3+1)
      return 47;
    case $familiar`Robortender`:
      return 20;
  }

  return 0;
}

function maxFamiliarDamage(familiar: Familiar): number {
  const totalFamWeight = familiarWeight(familiar) + weightAdjustment();
  switch (familiar) {
    case $familiar`Cocoabo`:
      return totalFamWeight + 3;
    case $familiar`Feather Boa Constrictor`:
      // Double sleaze damage at Barf Mountain
      return (
        totalFamWeight +
        3 +
        numericModifier("Sleaze Damage") *
          (myLocation() === $location`Barf Mountain` ? 2 : 1)
      );
    case $familiar`Ninja Pirate Zombie Robot`:
      return Math.floor((totalFamWeight + 3) * 1.5);
    case $familiar`Jill-of-All-Trades`:
      return totalFamWeight + 3;
    // TODO: Unknown rate, assume 2x until properly spaded
    case $familiar`Adventurous Spelunker`:
      return Math.floor((totalFamWeight + 3) * 2);
  }
  return 0;
}

export function maxPassiveDamage(): number {
  // Only considering passive damage sources we reasonably may have
  const vykeaMaxDamage =
    get("_VYKEACompanionLevel") > 0 ? 10 * get("_VYKEACompanionLevel") + 10 : 0;

  // Lasagmbie does max 2*level damage while Vermincelli does max level + (1/2 * level) + (1/2 * 1/2 * level) + ...
  const thrallMaxDamage =
    myThrall().level >= 5 &&
    $thralls`Lasagmbie,Vermincelli`.includes(myThrall())
      ? myThrall().level * 2
      : 0;

  const crownMaxDamage = haveEquipped($item`Crown of Thrones`)
    ? maxCarriedFamiliarDamage(myEnthronedFamiliar())
    : 0;

  const bjornMaxDamage = haveEquipped($item`Buddy Bjorn`)
    ? maxCarriedFamiliarDamage(myBjornedFamiliar())
    : 0;

  const familiarMaxDamage = maxFamiliarDamage(myFamiliar());

  return (
    vykeaMaxDamage +
    thrallMaxDamage +
    crownMaxDamage +
    bjornMaxDamage +
    familiarMaxDamage
  );
}

let monsterManuelCached: boolean | undefined = undefined;
export function monsterManuelAvailable(): boolean {
  if (monsterManuelCached !== undefined) return Boolean(monsterManuelCached);
  monsterManuelCached = visitUrl("questlog.php?which=3").includes(
    "Monster Manuel",
  );
  return Boolean(monsterManuelCached);
}

const listItems: Partial<{ [key in keyof GarboItemLists]: Item[] }> = {};
function getDropsList(key: keyof GarboItemLists) {
  return (listItems[key] ??= (
    JSON.parse(fileToBuffer("garbo_item_lists.json")) as GarboItemLists
  )[key].map((i) => Item.get(i)));
}
export function felizValue(): number {
  return garboAverageValue(...getDropsList("Feliz Navidad"));
}

export function newarkValue(): number {
  return garboAverageValue(...getDropsList("Newark"));
}

export function candyFactoryValue(): number {
  return garboAverageValue(...getDropsList("trainset"));
}

export function allMallPrices() {
  const today = todayToString();
  if (sessionStorage.getItem("allpricedate") !== today) {
    mallPrices("allitems");
    sessionStorage.setItem("allpricedate", today);
  }
}

export function aprilFoolsRufus() {
  if (holiday().includes("April Fool's Day")) {
    visitUrl("questlog.php?which=7");
  }
}

type LuckyAdventure = {
  location: Location;
  phase: "target" | "yachtzee" | "barf";
  value: () => number;
  outfit?: () => Outfit;
  choices?: () => {
    [choice: number]: string | number;
  };
};

const luckyAdventures: LuckyAdventure[] = [
  {
    location: $location`The Castle in the Clouds in the Sky (Top Floor)`,
    phase: "barf",
    value: () =>
      canAdventure($location`The Castle in the Clouds in the Sky (Top Floor)`)
        ? garboValue($item`Mick's IcyVapoHotness Inhaler`) -
          get("valueOfAdventure")
        : 0,
  },
];

function determineBestLuckyAdventure(): LuckyAdventure {
  return maxBy(luckyAdventures, ({ value }) => value());
}

let bestLuckyAdventure: LuckyAdventure;
export function getBestLuckyAdventure(): LuckyAdventure {
  return (bestLuckyAdventure ??= determineBestLuckyAdventure());
}

const SCALE_PATTERN = /Scale: /;
const CAP_PATTERN = /Cap: (\d*)/;
function calculateScalerCap({ attributes }: Monster): number {
  const scaleMatch = SCALE_PATTERN.test(attributes);
  if (!scaleMatch) return 0;
  const capMatch = CAP_PATTERN.exec(attributes);
  if (!capMatch?.[1]) return Infinity;
  return Number(capMatch[1]);
}

const MONSTER_SCALER_CAPS = new Map<Monster, number>();
export function scalerCap(monster: Monster): number {
  const cached = MONSTER_SCALER_CAPS.get(monster);
  if (cached) return cached;
  const cap = calculateScalerCap(monster);
  MONSTER_SCALER_CAPS.set(monster, cap);
  return cap;
}

const STRONG_SCALER_THRESHOLD = 1_000;
export const isStrongScaler = (m: Monster) =>
  scalerCap(m) > STRONG_SCALER_THRESHOLD;

export const isFreeAndCopyable = (monster: Monster) =>
  monster.copyable && monster.attributes.includes("FREE");
export const valueDrops = (monster: Monster) =>
  sum(itemDropsArray(monster), ({ drop, rate, type }) =>
    !["c", "0", "p", "a"].includes(type) ? (garboValue(drop) * rate) / 100 : 0,
  );
export const isFree = (monster: Monster) => monster.attributes.includes("FREE");
