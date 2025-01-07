import {
  autosellPrice,
  descToItem,
  Effect,
  handlingChoice,
  Item,
  mallPrice,
  runChoice,
  toSlot,
  visitUrl,
} from "kolmafia";
import {
  $item,
  $items,
  $monsters,
  $slot,
  arrayEquals,
  get,
  maxBy,
  set,
  sum,
  TrainSet,
} from "libram";
import { globalOptions } from "../config";
import { candyFactoryValue } from "../lib";
import { garboAverageValue, garboValue } from "../garboValue";
import { estimatedGarboTurns } from "../turns";
import { copyTargetCount } from "../target";
import { Potion } from "../potions";

const GOOD_TRAIN_STATIONS = [
  { piece: TrainSet.Station.GAIN_MEAT, value: () => 900 },
  {
    // Some day this'll be better
    piece: TrainSet.Station.TRACKSIDE_DINER,
    value: () =>
      $monsters`Witchess Knight`.includes(globalOptions.target) &&
      copyTargetCount() > 0
        ? garboValue($item`jumping horseradish`)
        : garboAverageValue(
            ...$items`bowl of cottage cheese, hot buttered roll, toast`,
          ),
  },
  { piece: TrainSet.Station.CANDY_FACTORY, value: candyFactoryValue },
  {
    piece: TrainSet.Station.GRAIN_SILO,
    value: () =>
      2 *
      garboAverageValue(
        ...$items`bottle of gin, bottle of vodka, bottle of whiskey, bottle of rum, bottle of tequila, boxed wine`,
      ),
  },
  {
    piece: TrainSet.Station.ORE_HOPPER,
    value: () =>
      garboAverageValue(
        ...$items`linoleum ore, asbestos ore, chrome ore, teflon ore, vinyl ore, velcro ore, bubblewrap ore, cardboard ore, styrofoam ore`,
      ),
  },
];

let trainCycle: TrainSet.Cycle;
function getBestCycle(): TrainSet.Cycle {
  if (!trainCycle) {
    const cycle = [
      TrainSet.Station.COAL_HOPPER,
      ...GOOD_TRAIN_STATIONS.sort(
        ({ value: a }, { value: b }) => b() - a(),
      ).map(({ piece }) => piece),
      TrainSet.Station.TOWER_FIZZY,
      TrainSet.Station.VIEWING_PLATFORM,
    ] as TrainSet.Cycle;
    trainCycle = cycle;
  }
  return [...trainCycle];
}

function valueStation(station: TrainSet.Station): number {
  if (station === TrainSet.Station.COAL_HOPPER) {
    return valueStation(getBestCycle()[1]);
  }
  return (
    GOOD_TRAIN_STATIONS.find(({ piece }) => piece === station)?.value() ?? 0
  );
}

function valueOffset(offset: number): number {
  const firstFortyTurns = 5 * sum(getBestCycle(), valueStation);
  const extraTurns = sum(getBestCycle().slice(0, offset - 1), valueStation);
  return (firstFortyTurns + extraTurns) / (40 + offset);
}

let bestOffset: number | null = null;
function getBestOffset(): number {
  return (bestOffset ??= maxBy([2, 3, 4, 5, 6, 7, 8], valueOffset));
}

export function getPrioritizedStations(): TrainSet.Station[] {
  return getBestCycle().slice(0, getBestOffset() - 1);
}

function getRotatedCycle(): TrainSet.Cycle {
  const offset = get("trainsetPosition") % 8;
  const newPieces: TrainSet.Station[] = [];
  const defaultPieces = getBestCycle();
  for (let i = 0; i < 8; i++) {
    const newPos = (i + offset) % 8;
    newPieces[newPos] = defaultPieces[i];
  }
  return newPieces as TrainSet.Cycle;
}

export function trainNeedsRotating(): boolean {
  if (!TrainSet.canConfigure()) return false;
  if (!get("trainsetConfiguration")) {
    // Visit the workshed to make sure it's actually empty, instead of us having not yet seen it this run
    visitUrl("campground.php?action=workshed");
    visitUrl("main.php");
  }

  if (!get("trainsetConfiguration")) return true;
  if (arrayEquals(getRotatedCycle(), TrainSet.cycle())) return false;
  if (globalOptions.ascend && estimatedGarboTurns() <= 40) return false;
  const bestStations = getPrioritizedStations();
  if (bestStations.includes(TrainSet.next())) return false;
  return true;
}

export function rotateToOptimalCycle(): boolean {
  const hasRotated = TrainSet.setConfiguration(getRotatedCycle());

  // If the trainset was not configured but still claims to be configurable
  if (!hasRotated && TrainSet.canConfigure()) {
    // Set the trainset configuration to believe it'll be configurable in one turn
    set("lastTrainsetConfiguration", get("trainsetPosition") - 39);
  }

  return hasRotated;
}

export function grabMedicine(): void {
  const options = visitUrl("campground.php?action=workshed");
  let i = 0;
  let match;
  const regexp = /descitem\((\d+)\)/g;
  const itemChoices = new Map<Item, number>();
  if (!globalOptions.nobarf) {
    // if spending turns at barf, we probably will be able to get an extro so always consider it
    itemChoices.set($item`Extrovermectin™`, -1);
  }

  while ((match = regexp.exec(options)) !== null) {
    i++;
    const item = descToItem(match[1]);
    itemChoices.set(item, i);
  }

  const bestItem = maxBy([...itemChoices.keys()], garboValue);
  const bestChoice = itemChoices.get(bestItem);
  if (bestChoice && bestChoice > 0) {
    visitUrl("campground.php?action=workshed");
    runChoice(bestChoice);
  }
  if (handlingChoice()) visitUrl("main.php");
}

// Function to calculate the value for each item
function calculateItemValue(item: Item, effect: Effect): number {
  return (
    new Potion($item`diabolic pizza`, {
      effect: effect,
      duration: Math.sqrt(autosellPrice(item)),
    }).gross(copyTargetCount()) -
    mallPrice(item) +
    (toSlot(item) === $slot`familiar`
      ? mallPrice($item`box of Familiar Jacks`)
      : 0) +
    item.name.length / 10
  );
}

// Consolidated function to get the best item for a given letter
function bestPizzaItemForLetter(letter: string, effect: Effect): Item {
  const items = $items.all().filter((i) => i.name.startsWith(letter));

  const itemsWithValues = items.map((item) => ({
    item,
    value: calculateItemValue(item, effect),
  }));

  return maxBy(itemsWithValues, (entry) => entry.value).item;
}

// Function to design the pizza based on the effect's name letters
function designPizza(effect: Effect): Item[] {
  return effect.name
    .substring(0, 4)
    .split("")
    .map((letter) => bestPizzaItemForLetter(letter, effect));
}

// Simulation to calculate pizza cost and benefit
export function simCreatePizza(effect: Effect): [number, number] {
  const pizzaItems = designPizza(effect);

  const benefit = pizzaItems.reduce(
    (acc, it) => acc + calculateItemValue(it, effect),
    0,
  );
  const cost = pizzaItems.reduce((acc, it) => acc + mallPrice(it), 0);

  return [cost, benefit];
}

// Function to create the pizza by calling the appropriate URL
export function createPizza(effect: Effect) {
  const pizzaItems = designPizza(effect);

  visitUrl(
    `campground.php?action=makepizza&pizza=${pizzaItems.map((item) => item.id).join(",")}`,
    true,
    true,
  );
}
