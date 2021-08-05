import {
  availableAmount,
  buy,
  chew,
  cliExecute,
  drink,
  eat,
  equip,
  fullnessLimit,
  getProperty,
  getWorkshed,
  haveEffect,
  inebrietyLimit,
  itemAmount,
  mallPrice,
  maximize,
  myClass,
  myFamiliar,
  myFullness,
  myInebriety,
  myLevel,
  myMaxhp,
  mySpleenUse,
  numericModifier,
  print,
  retrieveItem,
  setProperty,
  spleenLimit,
  sweetSynthesis,
  toInt,
  use,
  useFamiliar,
  userConfirm,
  useSkill,
} from "kolmafia";
import {
  $class,
  $classes,
  $effect,
  $familiar,
  $item,
  $items,
  $skill,
  get,
  have,
  set,
} from "libram";
import { withChoice } from "libram";
import { acquire } from "./acquire";
import { embezzlerCount } from "./fights";
import { estimatedTurns, globalOptions } from "./globalvars";
import { baseMeat, clamp, ensureEffect } from "./lib";

const MPA = get("valueOfAdventure");
print(`Using adventure value ${MPA}.`, "blue");

function itemPriority(...items: Item[]) {
  for (const item of items) {
    if (have(item)) return item;
  }
  return items[items.length - 1];
}

function eatSafe(qty: number, item: Item) {
  acquire(qty, $item`Special Seasoning`);
  acquire(qty, item);
  if (!eat(qty, item)) throw "Failed to eat safely";
}

function drinkSafe(qty: number, item: Item) {
  const prevDrunk = myInebriety();
  acquire(qty, item);
  if (!drink(qty, item)) throw "Failed to drink safely";
  if (item.inebriety === 1 && prevDrunk === qty + myInebriety() - 1) {
    // sometimes mafia does not track the mime army shot glass property
    setProperty("_mimeArmyShotglassUsed", "true");
  }
}

function chewSafe(qty: number, item: Item) {
  acquire(qty, item);
  if (!chew(qty, item)) throw "Failed to chew safely";
}

function eatSpleen(qty: number, item: Item) {
  if (mySpleenUse() < 5) throw "No spleen to clear with this.";
  eatSafe(qty, item);
}

function drinkSpleen(qty: number, item: Item) {
  if (mySpleenUse() < 5) throw "No spleen to clear with this.";
  drinkSafe(qty, item);
}

function adventureGain(item: Item) {
  if (item.adventures.includes("-")) {
    const [min, max] = item.adventures.split("-").map((s) => parseInt(s, 10));
    return (min + max) / 2.0;
  } else {
    return parseInt(item.adventures, 10);
  }
}

function propTrue(prop: string | boolean) {
  if (typeof prop === "boolean") {
    return prop as boolean;
  } else {
    return get(prop);
  }
}

function useIfUnused(item: Item, prop: string | boolean, maxPrice: number) {
  if (!propTrue(prop)) {
    if (mallPrice(item) <= maxPrice) {
      acquire(1, item, maxPrice);
      use(1, item);
    } else {
      print(`Skipping ${item.name}; too expensive (${mallPrice(item)} > ${maxPrice}).`);
    }
  }
}

const valuePerSpleen = (item: Item) => (adventureGain(item) * MPA - mallPrice(item)) / item.spleen;
let savedBestSpleenItem: Item | null = null;
let savedPotentialSpleenItems: Item[] | null = null;
function getBestSpleenItems() {
  if (savedBestSpleenItem === null || savedPotentialSpleenItems === null) {
    savedPotentialSpleenItems = $items`octolus oculus, transdermal smoke patch, antimatter wad, voodoo snuff, blood-drive sticker`;
    savedPotentialSpleenItems.sort((x, y) => valuePerSpleen(y) - valuePerSpleen(x));
    for (const spleenItem of savedPotentialSpleenItems) {
      print(`${spleenItem} value/spleen: ${valuePerSpleen(spleenItem)}`);
    }
    savedBestSpleenItem = savedPotentialSpleenItems[0];
  }

  return { bestSpleenItem: savedBestSpleenItem, potentialSpleenItems: savedPotentialSpleenItems };
}

function fillSomeSpleen() {
  const { bestSpleenItem } = getBestSpleenItems();
  print(`Spleen item: ${bestSpleenItem}`);
  fillSpleenWith(bestSpleenItem);
}

function fillSpleenWith(spleenItem: Item) {
  if (mySpleenUse() + spleenItem.spleen <= spleenLimit()) {
    // (adventureGain * spleenA + adventures) * 1.04 + 40 = 30 * spleenB + synthTurns
    // spleenA + spleenB = spleenTotal
    // (adventureGain * (spleenTotal - spleenB) + adventures) * 1.04 + 40 = 30 * spleenB + synthTurns
    // 1.04 * adventureGain * (spleenTotal - spleenB) + 1.04 * adventures + 40 = 30 * spleenB + synthTurns
    // 1.04 * adventureGain * spleenTotal - 1.04 * adventureGain * spleenB + 1.04 * adventures + 40 = 30 * spleenB + synthTurns
    // 1.04 * adventureGain * spleenTotal + 1.04 * adventures + 40 = 30 * spleenB + synthTurns + 1.04 * adventureGain * spleenB
    // (1.04 * adventureGain * spleenTotal + 1.04 * adventures + 40 - synthTurns) / (30 + 1.04 * adventureGain) = spleenB
    const synthTurns = haveEffect($effect`Synthesis: Greed`);
    const spleenTotal = spleenLimit() - mySpleenUse();
    const adventuresPerItem = adventureGain(spleenItem);
    const spleenSynth = Math.ceil(
      (1.04 * adventuresPerItem * spleenTotal + estimatedTurns() - synthTurns) /
        (30 + 1.04 * adventuresPerItem)
    );
    if (have($skill`Sweet Synthesis`)) {
      for (let i = 0; i < clamp(spleenSynth, 0, spleenLimit() - mySpleenUse()); i++) {
        sweetSynthesis($effect`Synthesis: Greed`);
      }
    }
    const count = Math.floor((spleenLimit() - mySpleenUse()) / spleenItem.spleen);
    acquire(count, spleenItem);
    chewSafe(count, spleenItem);
  }
}

function fillStomach() {
  if (myLevel() >= 15 && !get("_hungerSauceUsed") && mallPrice($item`Hunger™ Sauce`) < 3 * MPA) {
    acquire(1, $item`Hunger™ Sauce`, 3 * MPA);
    use(1, $item`Hunger™ Sauce`);
  }
  useIfUnused($item`milk of magnesium`, "_milkOfMagnesiumUsed", 5 * MPA);

  while (myFullness() + 5 <= fullnessLimit()) {
    if (myMaxhp() < 1000) maximize("0.05hp, hot res", false);
    const count = Math.floor(Math.min((fullnessLimit() - myFullness()) / 5, mySpleenUse() / 5));
    eatSpleen(count, $item`Ol' Scratch's salad fork`);
    mindMayo(Mayo.flex, count);
    eatSpleen(count, $item`extra-greasy slider`);
    fillSomeSpleen();
  }
}

function fillLiver() {
  if (myFamiliar() === $familiar`Stooper`) {
    useFamiliar($familiar`none`);
  }
  if (!get("_mimeArmyShotglassUsed") && itemAmount($item`mime army shotglass`) > 0) {
    equip($item`tuxedo shirt`);
    drink(itemPriority($item`astral pilsner`, $item`splendid martini`));
  }
  while (myInebriety() + 1 <= inebrietyLimit() && itemAmount($item`astral pilsner`) > 0) {
    drink(1, $item`astral pilsner`);
  }
  while (myInebriety() + 5 <= inebrietyLimit()) {
    if (myMaxhp() < 1000) maximize("0.05hp, cold res", false);
    const count = Math.floor(Math.min((inebrietyLimit() - myInebriety()) / 5, mySpleenUse() / 5));
    drinkSpleen(count, $item`Frosty's frosty mug`);
    drinkSpleen(count, $item`jar of fermented pickle juice`);
    fillSomeSpleen();
  }
}

export function runDiet(): void {
  if (
    get("barrelShrineUnlocked") &&
    !get("_barrelPrayer") &&
    $classes`Turtle Tamer, Accordion Thief`.includes(myClass())
  ) {
    cliExecute("barrelprayer buff");
  }

  const { bestSpleenItem } = getBestSpleenItems();

  if (mySpleenUse() === 0) {
    if (!have($effect`Eau d' Clochard`)) {
      if (!have($item`beggin' cologne`)) {
        const equilibriumPrice =
          (baseMeat *
            numericModifier($effect`Eau d' Clochard`, "Meat") *
            numericModifier($item`beggin' cologne`, "Effect Duration") +
            Math.min(numericModifier($item`beggin' cologne`, "Effect Duration"), embezzlerCount()) *
              750) /
            100 -
          valuePerSpleen(bestSpleenItem);
        if (equilibriumPrice > 0) buy(1, $item`beggin' cologne`, equilibriumPrice);
      }
      if (have($item`beggin' cologne`)) {
        chew(1, $item`beggin' cologne`);
      }
    }
    if (have($skill`Sweet Synthesis`)) ensureEffect($effect`Synthesis: Collection`);
    if (have($item`body spradium`)) ensureEffect($effect`Boxing Day Glow`);
  }

  useIfUnused($item`fancy chocolate car`, get("_chocolatesUsed") === 0, 2 * MPA);

  const loveChocolateCount = Math.max(3 - Math.floor(20000 / MPA) - get("_loveChocolatesUsed"), 0);
  const loveChocolateEat = Math.min(
    loveChocolateCount,
    itemAmount($item`LOV Extraterrestrial Chocolate`)
  );
  use(loveChocolateEat, $item`LOV Extraterrestrial Chocolate`);

  const choco = new Map([
    [toInt($class`Seal Clubber`), $item`chocolate seal-clubbing club`],
    [toInt($class`Turtle Tamer`), $item`chocolate turtle totem`],
    [toInt($class`Pastamancer`), $item`chocolate pasta spoon`],
    [toInt($class`Sauceror`), $item`chocolate saucepan`],
    [toInt($class`Accordion Thief`), $item`chocolate stolen accordion`],
    [toInt($class`Disco Bandit`), $item`chocolate disco ball`],
  ]);
  if (choco.has(toInt(myClass())) && get("_chocolatesUsed") < 3) {
    const used = get("_chocolatesUsed");
    const item = choco.get(toInt(myClass())) || $item`none`;
    const count = clamp(3 - used, 0, 3);
    use(count, item);
  }

  useIfUnused(
    $item`fancy chocolate sculpture`,
    get("_chocolateSculpturesUsed") < 1,
    5 * MPA + 5000
  );
  useIfUnused($item`essential tofu`, "_essentialTofuUsed", 5 * MPA);

  if (!get("_etchedHourglassUsed") && have($item`etched hourglass`)) {
    use(1, $item`etched hourglass`);
  }

  if (getProperty("_timesArrowUsed") !== "true" && mallPrice($item`time's arrow`) < 5 * MPA) {
    acquire(1, $item`time's arrow`, 5 * MPA);
    cliExecute("csend 1 time's arrow to botticelli");
    setProperty("_timesArrowUsed", "true");
  }

  if (have($skill`Ancestral Recall`) && mallPrice($item`blue mana`) < 3 * MPA) {
    const casts = Math.max(10 - get("_ancestralRecallCasts"), 0);
    acquire(casts, $item`blue mana`, 3 * MPA);
    useSkill(casts, $skill`Ancestral Recall`);
  }

  if (globalOptions.ascending) useIfUnused($item`borrowed time`, "_borrowedTimeUsed", 5 * MPA);

  fillSomeSpleen();
  fillStomach();
  fillLiver();

  if (!get("_distentionPillUsed") && 1 <= myInebriety()) {
    if (!get<boolean>("garbo_skipPillCheck", false) && !have($item`distention pill`, 1)) {
      set(
        "garbo_skipPillCheck",
        userConfirm(
          "You do not have any distention pills. Continue anyway? (Defaulting to no in 15 seconds)",
          15000,
          false
        )
      );
    }
    if (
      (have($item`distention pill`, 1) || !get<boolean>("garbo_skipPillCheck", false)) &&
      !use($item`distention pill`)
    ) {
      print("WARNING: Out of distention pills.", "red");
    }
  }

  if (!get("_syntheticDogHairPillUsed") && 1 <= myInebriety()) {
    if (!get<boolean>("garbo_skipPillCheck", false) && !have($item`synthetic dog hair pill`, 1)) {
      set(
        "garbo_skipPillCheck",
        userConfirm(
          "You do not have any synthetic dog hair pills. Continue anyway? (Defaulting to no in 15 seconds)",
          15000,
          false
        )
      );
    }
    if (
      (have($item`synthetic dog hair pill`, 1) || !get<boolean>("garbo_skipPillCheck", false)) &&
      !use($item`synthetic dog hair pill`)
    ) {
      print("WARNING: Out of synthetic dog hair pills.", "red");
    }
  }

  const mojoFilterCount = 3 - get("currentMojoFilters");
  acquire(mojoFilterCount, $item`mojo filter`, valuePerSpleen(bestSpleenItem), false);
  if (have($item`mojo filter`)) {
    use(Math.min(mojoFilterCount, availableAmount($item`mojo filter`)), $item`mojo filter`);
    fillSomeSpleen();
  }

  while (myFullness() < fullnessLimit()) {
    if (mallPrice($item`fudge spork`) < 3 * MPA && !get("_fudgeSporkUsed"))
      eat(1, $item`fudge spork`);
    mindMayo(Mayo.zapine, 1);
    eatSafe(1, $item`jumping horseradish`);
  }
  while (myInebriety() < inebrietyLimit()) {
    drinkSafe(1, $item`Ambitious Turkey`);
  }
}

export function horseradish(): void {
  if (myFullness() < fullnessLimit()) {
    if (mallPrice($item`fudge spork`) < 3 * MPA && !get("_fudgeSporkUsed"))
      eat(1, $item`fudge spork`);
    mindMayo(Mayo.zapine, 1);
    eatSafe(1, $item`jumping horseradish`);
  }
}

const Mayo = {
  nex: $item`Mayonex`,
  diol: $item`Mayodiol`,
  zapine: $item`Mayozapine`,
  flex: $item`Mayoflex`,
};

function mindMayo(mayo: Item, quantity: number) {
  if (getWorkshed() !== $item`portable Mayo Clinic`) return;
  if (get("mayoInMouth") && get("mayoInMouth") !== mayo.name)
    throw `You used a bad mayo, my friend!`; //Is this what we want?
  retrieveItem(quantity, mayo);
  if (!have($item`Mayo Minder™`)) buy($item`Mayo Minder™`);
  if (get("mayoMinderSetting") !== mayo.name) {
    withChoice(1076, toInt(mayo) - 8260, () => use($item`Mayo Minder™`));
  }
}
