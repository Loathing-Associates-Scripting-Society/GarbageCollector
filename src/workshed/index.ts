import { getWorkshed, haveEffect, Item, print, totalTurnsPlayed, use, visitUrl } from "kolmafia";
import { $effect, $item, $items, AsdonMartin, clamp, DNALab, get, have, TrainSet } from "libram";
import { dietCompleted } from "../diet";
import { globalOptions } from "../config";
import { potionSetupCompleted } from "../potions";
import { estimatedTurns } from "../turns";
import { getBestCycle, grabMedicine, offsetDefaultPieces } from "./utils";

let _nextWorkshed: GarboWorkshed | null = null;
let _currentWorkshed: GarboWorkshed | null = null;
class GarboWorkshed {
  workshed: Item;
  done = () => true;
  action = () => {
    return;
  };
  constructor(workshed: Item, done?: () => boolean, action?: () => void) {
    this.workshed = workshed;
    if (done) this.done = done;
    if (action) this.action = action;
  }

  static getGarboWorkshed(item: Item): GarboWorkshed {
    return worksheds.find(({ workshed }) => workshed === item) ?? defaultWorkshed;
  }

  static currentWorkshed(): GarboWorkshed {
    _currentWorkshed ??= GarboWorkshed.getGarboWorkshed(getWorkshed());
    return _currentWorkshed ?? defaultWorkshed;
  }

  static nextWorkshed(): GarboWorkshed {
    _nextWorkshed ??= GarboWorkshed.getGarboWorkshed(globalOptions.workshed);
    return _nextWorkshed ?? defaultWorkshed;
  }
}
const defaultWorkshed = new GarboWorkshed($item`none`);
const estimatedTurnsTomorrow = 400 + clamp((get("valueOfAdventure") - 4000) / 8, 0, 600);

const worksheds = [
  new GarboWorkshed(
    $item`model train set`,
    () => {
      // We should always get value from the trainset, so we would never switch from it
      return false;
    },
    () => {
      if (!TrainSet.canConfigure()) return;
      if (get("trainsetConfiguration") === "") {
        print("Reconfiguring trainset, as our next station is empty", "blue");
        return TrainSet.setConfiguration(getBestCycle());
      } else {
        const bestTwoStations = getBestCycle().splice(0, 2);
        const offset = get("trainsetPosition") % 8;
        if (bestTwoStations.includes(TrainSet.next())) return;
        print(`Reconfiguring trainset, as our next station is ${TrainSet.next()}}`, "blue");
        return TrainSet.setConfiguration(offsetDefaultPieces(offset));
      }
    }
  ),
  new GarboWorkshed(
    $item`cold medicine cabinet`,
    () => {
      return get("_coldMedicineConsults") >= 5;
    },
    () => {
      if (get("_nextColdMedicineConsult") > totalTurnsPlayed()) return;
      grabMedicine();
    }
  ),
  new GarboWorkshed(
    $item`Asdon Martin keyfob`,
    () => {
      return (
        haveEffect($effect`Driving Observantly`) >=
        estimatedTurns() + (globalOptions.ascend ? 0 : estimatedTurnsTomorrow)
      );
    },
    () => {
      AsdonMartin.drive(
        $effect`Driving Observantly`,
        estimatedTurns() + (globalOptions.ascend ? 0 : estimatedTurnsTomorrow)
      );
    }
  ),
  new GarboWorkshed(
    $item`Little Geneticist DNA-Splicing Lab`,
    () => {
      // This will likely always return true or false for now, depending on the start state of garbo
      // Since we don't actually support using the syringe in combat at this time, the counter will never change
      return get("_dnaPotionsMade") >= 3;
    },
    () => {
      // Just grab whatever tonics for now, since we don't actually have support for DNA
      if (get("dnaSyringe")) DNALab.makeTonic(3);
    }
  ),
  new GarboWorkshed(
    $item`spinning wheel`,
    () => {
      return get("_spinningWheel");
    },
    () => {
      // We simply assume you will not gain a level while garboing, since we do not do powerlevellings
      // So we will just use the spinning wheel immediately
      visitUrl("campground.php?action=spinningwheel");
    }
  ),
  ...$items`diabolic pizza cube, portable Mayo Clinic, warbear high-efficiency still, warbear induction oven`.map(
    (item) => new GarboWorkshed(item, dietCompleted)
  ),
  ...$items`warbear chemistry lab, warbear LP-ROM burner`.map(
    (item) => new GarboWorkshed(item, potionSetupCompleted)
  ),
  ...$items`snow machine, warbear jackhammer drill press, warbear auto-anvil`.map(
    (item) => new GarboWorkshed(item)
  ),
];

if (
  GarboWorkshed.currentWorkshed().workshed === $item`model train set` &&
  GarboWorkshed.nextWorkshed().workshed !== $item`none`
) {
  print(
    `Warning: We currently do not support switching from the model train set to another workshed, so ${
      GarboWorkshed.nextWorkshed().workshed
    } will not be set-up during this run of garbo!`,
    "red"
  );
}

export default function handleWorkshed(): void {
  if (!GarboWorkshed.currentWorkshed().done()) GarboWorkshed.currentWorkshed().action();
  if (
    !get("_workshedItemUsed") &&
    GarboWorkshed.currentWorkshed().done() &&
    GarboWorkshed.nextWorkshed().workshed !== $item`none` &&
    have(GarboWorkshed.nextWorkshed().workshed)
  ) {
    use(GarboWorkshed.nextWorkshed().workshed);
    if (!GarboWorkshed.currentWorkshed().done()) GarboWorkshed.currentWorkshed().action();
  }
}
