import {
  getWorkshed,
  haveEffect,
  Item,
  myTotalTurnsSpent,
  totalTurnsPlayed,
  use,
  visitUrl,
} from "kolmafia";
import {
  $effect,
  $item,
  $items,
  AsdonMartin,
  DNALab,
  get,
  have,
  TrainSet,
} from "libram";
import { dietCompleted } from "../../diet";
import { globalOptions } from "../../config";
import { potionSetupCompleted } from "../../potions";
import { estimatedGarboTurns, estimatedTurnsTomorrow } from "../../turns";
import {
  getPrioritizedStations,
  grabMedicine,
  rotateToOptimalCycle,
} from "../../resources";
import { GarboTask } from "../engine";
type WorkshedOptions = {
  workshed: Item;
  done?: () => boolean;
  action?: () => void;
  minTurns?: number;
  available?: () => boolean;
};
class GarboWorkshed {
  private static _nextWorkshed: GarboWorkshed | null = null;
  private static _currentWorkshed: GarboWorkshed | null = null;

  workshed: Item;
  done?: () => boolean;
  action?: () => void;
  minTurns?: number;
  available = () => true;
  constructor(options: WorkshedOptions) {
    this.workshed = options.workshed;
    if (options.done) this.done = options.done;
    if (options.action) this.action = options.action;
    if (options.available) this.available = options.available;
    this.minTurns = options.minTurns ?? 0;
  }

  canRemove(): boolean {
    return (
      (this.done?.() ?? true) ||
      estimatedGarboTurns() <= (GarboWorkshed.next?.minTurns ?? 0)
    );
  }

  use(): void {
    if (!this.done?.()) this.action?.();
  }

  static get(item: Item | null): GarboWorkshed | null {
    return worksheds.find(({ workshed }) => workshed === item) ?? null;
  }

  static get current(): GarboWorkshed | null {
    GarboWorkshed._currentWorkshed ??= GarboWorkshed.get(getWorkshed());
    return GarboWorkshed._currentWorkshed;
  }

  static get next(): GarboWorkshed | null {
    if (get("_workshedItemUsed")) return null;
    GarboWorkshed._nextWorkshed ??= GarboWorkshed.get(globalOptions.workshed);
    return GarboWorkshed._nextWorkshed;
  }

  static useNext(): GarboWorkshed | null {
    if (get("_workshedItemUsed")) return null;
    const next = GarboWorkshed.next;
    if (next && have(next.workshed)) {
      use(next.workshed);
      if (GarboWorkshed.get(getWorkshed()) === next) {
        GarboWorkshed._nextWorkshed = null;
        GarboWorkshed._currentWorkshed = next;
      }
    }
    return GarboWorkshed._currentWorkshed;
  }
}

let _attemptedMakingTonics = false;
let _lastCMCTurn = myTotalTurnsSpent();
const worksheds = [
  new GarboWorkshed({
    workshed: $item`model train set`,
    // We should always get value from the trainset, so we would never switch from it
    done: () => false,
    available: (): boolean => {
      if (!TrainSet.canConfigure()) return false;
      if (!get("trainsetConfiguration")) {
        // Visit the workshed to make sure it's actually empty, instead of us having not yet seen it this run
        visitUrl("campground.php?action=workshed");
        visitUrl("main.php");
      }

      if (!get("trainsetConfiguration")) return true;
      if (globalOptions.ascend && estimatedGarboTurns() <= 40) return false;
      const bestStations = getPrioritizedStations();
      if (bestStations.includes(TrainSet.next())) return false;
      return true;
    },
    action: rotateToOptimalCycle,
  }),
  new GarboWorkshed({
    workshed: $item`cold medicine cabinet`,
    done: () => get("_coldMedicineConsults") >= 5,
    available: () =>
      get("_nextColdMedicineConsult") <= totalTurnsPlayed() &&
      myTotalTurnsSpent() !== _lastCMCTurn, // TODO: Ensure that we have a good expected cmc result
    action: () => {
      grabMedicine();
      _lastCMCTurn = myTotalTurnsSpent();
    },
    minTurns: 80,
  }),
  new GarboWorkshed({
    workshed: $item`Asdon Martin keyfob`,
    done: () => {
      return (
        haveEffect($effect`Driving Observantly`) >=
        estimatedGarboTurns() +
          (globalOptions.ascend ? 0 : estimatedTurnsTomorrow)
      );
    },
    action: () => {
      AsdonMartin.drive(
        $effect`Driving Observantly`,
        estimatedGarboTurns() +
          (globalOptions.ascend ? 0 : estimatedTurnsTomorrow),
      );
    },
  }),
  new GarboWorkshed({
    workshed: $item`Little Geneticist DNA-Splicing Lab`,
    done: () => {
      // This will likely always return true or false for now, depending on the start state of garbo
      // Since we don't actually support using the syringe in combat at this time, the counter will never change
      return _attemptedMakingTonics || get("_dnaPotionsMade") >= 3;
    },
    action: () => {
      // Just grab whatever tonics for now, since we don't actually have support for DNA
      if (get("dnaSyringe")) DNALab.makeTonic(3);
      _attemptedMakingTonics = true;
    },
  }),
  new GarboWorkshed({
    workshed: $item`spinning wheel`,
    done: () => get("_spinningWheel"),
    action: () => {
      // We simply assume you will not gain a level while garboing, since we do not do powerlevellings
      // So we will just use the spinning wheel immediately
      visitUrl("campground.php?action=spinningwheel");
    },
  }),
  ...$items`diabolic pizza cube, portable Mayo Clinic, warbear high-efficiency still, warbear induction oven`.map(
    (item) => new GarboWorkshed({ workshed: item, done: dietCompleted }),
  ),
  ...$items`warbear chemistry lab, warbear LP-ROM burner`.map(
    (item) => new GarboWorkshed({ workshed: item, done: potionSetupCompleted }),
  ),
  ...$items`snow machine, warbear jackhammer drill press, warbear auto-anvil`.map(
    (item) => new GarboWorkshed({ workshed: item }),
  ),
];

function workshedTask(workshed: GarboWorkshed): GarboTask {
  return {
    name: `Workshed: ${workshed.workshed}`,
    completed: () => workshed.done?.() ?? true,
    ready: () => getWorkshed() === workshed.workshed && workshed.available(),
    do: () => workshed?.use(),
    spendsTurn: false,
  };
}

const SAFETY_TURNS_THRESHOLD = 25;
export default function workshedTasks(): GarboTask[] {
  return [
    ...worksheds.map(workshedTask),
    {
      name: "Swap Workshed",
      completed: () => get("_workshedItemUsed"),
      ready: () => {
        const canRemove = GarboWorkshed.current?.canRemove() ?? true;
        const haveNext =
          GarboWorkshed.next !== null && have(GarboWorkshed.next.workshed);
        const enoughTurns =
          !GarboWorkshed.next?.minTurns ||
          GarboWorkshed.next.minTurns + SAFETY_TURNS_THRESHOLD >
            estimatedGarboTurns();
        return canRemove && haveNext && enoughTurns;
      },
      do: () => GarboWorkshed.useNext(),
      spendsTurn: false,
    },
  ];
}
