import {
  Engine,
  EngineOptions,
  getTasks,
  Outfit,
  Quest,
  StrictCombatTask,
} from "grimoire-kolmafia";
import { eventLog, safeInterrupt, safeRestore, sober } from "../lib";
import { wanderer } from "../garboWanderer";
import {
  $familiar,
  $item,
  $skill,
  Delayed,
  get,
  SourceTerminal,
  undelay,
} from "libram";
import { equip, itemAmount, print, totalTurnsPlayed } from "kolmafia";
import { GarboStrategy } from "../combat";
import { globalOptions } from "../config";
import { sessionSinceStart } from "../session";
import { garboValue } from "../garboValue";
import { DraggableFight } from "garbo-lib";

export type GarboTask = StrictCombatTask<never, GarboStrategy> & {
  sobriety?: Delayed<"drunk" | "sober" | undefined>;
  spendsTurn: Delayed<boolean>;
  duplicate?: Delayed<boolean>;
};

export type CopyTargetTask = GarboTask & {
  fightType?:
    | "regular"
    | "conditional"
    | "chainstarter"
    | "gregarious"
    | "emergencychainstarter"
    | "fake";
  draggable?: DraggableFight;
  canInitializeWandererCounters: boolean;
  wrongEncounterName?: boolean;
};

function logTargetFight(encounterType: string) {
  const isDigitize = encounterType.includes("Digitize Wanderer");
  if (isDigitize) {
    eventLog.digitizedCopyTargetsFought++;
  } else {
    eventLog.initialCopyTargetsFought++;
  }
  eventLog.copyTargetSources.push(isDigitize ? "Digitize" : "Unknown Source");
}

/** A base engine for Garbo!
 * Runs extra logic before executing all tasks.
 */
export class BaseGarboEngine<T extends GarboTask> extends Engine<never, T> {
  available(task: T): boolean {
    safeInterrupt();
    const taskSober = undelay(task.sobriety);
    if (taskSober) {
      return (
        ((taskSober === "drunk" && !sober()) ||
          (taskSober === "sober" && sober())) &&
        super.available(task)
      );
    }
    return super.available(task);
  }

  dress(task: T, outfit: Outfit) {
    super.dress(task, outfit);
    if (itemAmount($item`tiny stillsuit`) > 0) {
      equip($familiar`Cornbeefadon`, $item`tiny stillsuit`);
    }
  }

  prepare(task: T): void {
    if ("combat" in task) safeRestore();
    super.prepare(task);
  }

  execute(task: T): void {
    const spentTurns = totalTurnsPlayed();
    const duplicate = undelay(task.duplicate);
    const before = SourceTerminal.getSkills();
    if (
      duplicate &&
      SourceTerminal.have() &&
      SourceTerminal.duplicateUsesRemaining() > 0
    ) {
      SourceTerminal.educate([$skill`Extract`, $skill`Duplicate`]);
    }
    super.execute(task);
    if (totalTurnsPlayed() !== spentTurns) {
      if (!undelay(task.spendsTurn)) {
        print(
          `Task ${task.name} spent a turn but was marked as not spending turns`,
        );
      }
    }
    const foughtATarget = get("lastEncounter") === globalOptions.target.name;
    if (foughtATarget) logTargetFight(task.name);
    wanderer().clear();
    sessionSinceStart().value(garboValue);
    if (duplicate && SourceTerminal.have()) {
      for (const skill of before) {
        SourceTerminal.educate(skill);
      }
    }
  }
}

export class CopyTargetEngine extends BaseGarboEngine<CopyTargetTask> {
  getNextTask(): CopyTargetTask | undefined {
    // TO DO: copy logic from `getNextCopyTargetFight`
    // But also handle things like "initialize digitize if our next fight isn't a digitize"
    // and "don't kramco if we're backing up"
    // and so on and so forth
    return super.getNextTask();
  }
}

/**
 * A safe engine for Garbo!
 * Treats soft limits as tasks that should be skipped, with a default max of one attempt for any task.
 */
export class SafeGarboEngine extends BaseGarboEngine<GarboTask> {
  constructor(tasks: GarboTask[]) {
    const options = new EngineOptions();
    options.default_task_options = { limit: { skip: 1 } };
    super(tasks, options);
  }
}

function runQuests<T extends GarboTask, E extends typeof BaseGarboEngine<T>>(
  quests: Quest<T>[],
  garboEngine: E,
) {
  const engine = new garboEngine(getTasks(quests));

  try {
    engine.run();
  } finally {
    engine.destruct();
  }
}

export function runSafeGarboQuests(quests: Quest<GarboTask>[]): void {
  runQuests(quests, SafeGarboEngine);
}

export function runGarboQuests(quests: Quest<GarboTask>[]): void {
  runQuests(quests, BaseGarboEngine);
}
