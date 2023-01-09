import {
  descToItem,
  getWorkshed,
  handlingChoice,
  Item,
  runChoice,
  toInt,
  toItem,
  visitUrl,
} from "kolmafia";
import { $item, get } from "libram";
import { globalOptions } from "../config";
import { maxBy } from "../lib";
import { garboValue } from "../session";

export enum TrainsetPiece {
  UNKNOWN = "",
  EMPTY = "empty",
  GAIN_MEAT = "meat_mine",
  EFFECT_MP = "tower_fizzy",
  GAIN_STATS = "viewing_platform",
  HOT_RES_COLD_DMG = "tower_frozen",
  STENCH_RES_SPOOKY_DMG = "spooky_graveyard",
  SMUT_BRIDGE_OR_STATS = "logging_mill",
  CANDY = "candy_factory",
  DOUBLE_NEXT_STATION = "coal_hopper",
  COLD_RES_STENCH_DMG = "tower_sewage",
  SPOOKY_RES_SLEAZE_DMG = "oil_refinery",
  SLEAZE_RES_HOT_DMG = "oil_bridge",
  MORE_ML = "water_bridge",
  MOXIE_STATS = "groin_silo",
  RANDOM_BOOZE = "grain_silo",
  MYS_STATS = "brain_silo",
  MUS_STATS = "brawn_silo",
  BUFF_FOOD_DROP = "prawn_silo",
  DROP_LAST_FOOD_OR_RANDOM = "trackside_diner",
  ORE = "ore_hopper",
}

const pieces: TrainsetPiece[] = [
  TrainsetPiece.EMPTY,
  TrainsetPiece.GAIN_MEAT,
  TrainsetPiece.EFFECT_MP,
  TrainsetPiece.GAIN_STATS,
  TrainsetPiece.HOT_RES_COLD_DMG,
  TrainsetPiece.STENCH_RES_SPOOKY_DMG,
  TrainsetPiece.SMUT_BRIDGE_OR_STATS,
  TrainsetPiece.CANDY,
  TrainsetPiece.DOUBLE_NEXT_STATION,
  TrainsetPiece.COLD_RES_STENCH_DMG,
  TrainsetPiece.UNKNOWN,
  TrainsetPiece.SPOOKY_RES_SLEAZE_DMG,
  TrainsetPiece.SLEAZE_RES_HOT_DMG,
  TrainsetPiece.MORE_ML,
  TrainsetPiece.MOXIE_STATS,
  TrainsetPiece.RANDOM_BOOZE,
  TrainsetPiece.MYS_STATS,
  TrainsetPiece.MUS_STATS,
  TrainsetPiece.BUFF_FOOD_DROP,
  TrainsetPiece.DROP_LAST_FOOD_OR_RANDOM,
  TrainsetPiece.ORE,
];

function getPieceId(piece: TrainsetPiece): number {
  return Math.max(0, pieces.indexOf(piece));
}

function getTrainsetPositionsUntilConfigurable(): number {
  const pos = toInt(get("trainsetPosition", ""));
  const configured = toInt(get("lastTrainsetConfiguration", ""));
  const turnsSinceConfigured = pos - configured;

  return Math.max(0, 40 - turnsSinceConfigured);
}

export function isTrainsetConfigurable(): boolean {
  return getWorkshed() === $item`model train set` && getTrainsetPositionsUntilConfigurable() <= 0;
}

export function setTrainsetConfiguration(pieces: TrainsetPiece[]): void {
  visitUrl("campground.php?action=workshed");

  const pieceIds = pieces.map((piece, index) => `slot[${index}]=${getPieceId(piece)}`);

  const url = `choice.php?forceoption=0&whichchoice=1485&option=1&pwd&${pieceIds.join("&")}`;

  visitUrl(url, true);
  visitUrl("main.php");

  const expected = pieces.join(",");

  if (expected !== get("trainsetConfiguration", "")) {
    throw new Error(
      `Expected trainset configuration to have changed, expected "${expected}" but instead got ${get(
        "trainsetConfiguration",
        ""
      )}`
    );
  }
}

export const defaultPieces = [
  TrainsetPiece.DOUBLE_NEXT_STATION,
  TrainsetPiece.GAIN_MEAT,
  TrainsetPiece.CANDY,
  TrainsetPiece.RANDOM_BOOZE,
  TrainsetPiece.DROP_LAST_FOOD_OR_RANDOM,
  TrainsetPiece.ORE,
  TrainsetPiece.EFFECT_MP,
  TrainsetPiece.GAIN_STATS,
];

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

export function getTrainsetConfiguration(): TrainsetPiece[] {
  return get("trainsetConfiguration").split(",") as TrainsetPiece[];
}

export function stringToWorkshedItem(): Item {
  const lowerCaseWorkshed = globalOptions.workshed.toLowerCase();
  const validItems = [] as Item[];
  if (["cold medicine cabinet", "cmc"].includes(lowerCaseWorkshed)) {
    validItems.push($item`cold medicine cabinet`);
  } else if (["model train set", "trainset", "mts"].includes(lowerCaseWorkshed)) {
    validItems.push($item`model train set`);
  } else if (["asdon martin keyfob"].includes(lowerCaseWorkshed)) {
    validItems.push($item`Asdon Martin keyfob`);
  } else if (["diabolic pizza cube"].includes(lowerCaseWorkshed)) {
    validItems.push($item`diabolic pizza cube`);
  } else if (["portable mayo clinic"].includes(lowerCaseWorkshed)) {
    validItems.push($item`portable Mayo Clinic`);
  } else if (["little geneticist dna-splicing lab"].includes(lowerCaseWorkshed)) {
    validItems.push($item`Little Geneticist DNA-Splicing Lab`);
  } else if (["spinning wheel"].includes(lowerCaseWorkshed)) {
    validItems.push($item`spinning wheel`);
  } else if (["warbear auto-anvil"].includes(lowerCaseWorkshed)) {
    validItems.push($item`warbear auto-anvil`);
  } else if (["warbear chemistry"].includes(lowerCaseWorkshed)) {
    validItems.push($item`warbear chemistry lab`);
  } else if (["warbear high-efficiency still"].includes(lowerCaseWorkshed)) {
    validItems.push($item`warbear high-efficiency still`);
  } else if (["warbear induction oven"].includes(lowerCaseWorkshed)) {
    validItems.push($item`warbear induction oven`);
  } else if (["warbear jackhammer drill press"].includes(lowerCaseWorkshed)) {
    validItems.push($item`warbear jackhammer drill press`);
  } else if (["warbear lp-rom burner"].includes(lowerCaseWorkshed)) {
    validItems.push($item`warbear LP-ROM burner`);
  } else if (["none", ""].includes(lowerCaseWorkshed)) {
    validItems.push($item`none`);
  }

  if (validItems.length >= 2) {
    throw new Error(
      `Error: workshed argument ${globalOptions.workshed} matches more than 1 workshed: ${validItems}`
    );
  } else if (validItems.length === 1) return validItems[0];

  // Last ditch effort to cast to a proper item
  const workshedItem = toItem(globalOptions.workshed);
  if (globalOptions.workshed.length > 0 && workshedItem !== $item`none`) return workshedItem;

  throw new Error(`Error: unable to parse workshed argument: ${globalOptions.workshed}.`);
}
