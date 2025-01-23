import { DraggableFight } from "garbo-lib";
import { Outfit } from "grimoire-kolmafia";
import { Location, mallPrice, retrieveItem } from "kolmafia";
import {
  $familiar,
  $item,
  $items,
  $location,
  $monster,
  $skill,
  get,
  have,
  PocketProfessor,
  Requirement,
  set,
  tryFindFreeRun,
  undelay,
} from "libram";
import { GarboStrategy, Macro } from "../../combat";
import { globalOptions } from "../../config";
import { freeFightFamiliar } from "../../familiar";
import {
  freeRunConstraints,
  isFree,
  ltbRun,
  MEAT_TARGET_MULTIPLIER,
  targettingMeat,
} from "../../lib";
import { freeFightOutfit, meatTargetOutfit, toSpec } from "../../outfit";
import {
  crateStrategy,
  doingGregFight,
  hasMonsterReplacers,
  totalGregCharges,
} from "../../resources";
import { checkUnderwater } from "../../target/lib";
import { BaseGarboEngine, CopyTargetTask } from "../engine";

export class CopyTargetEngine extends BaseGarboEngine<CopyTargetTask> {
  private lastFight: CopyTargetTask | null = null;
  private profChain: string | null = null;
  private SPECIAL_TASKS = {
    saberCrate: {
      name: "Saber Crate",
      completed: () => !get("_garbo_doneGregging", false) || !doingGregFight(),
      ready: () =>
        (have($item`Fourth of May Cosplay Saber`) &&
          get("_saberForceUses") < 5 &&
          get("_saberForceMonsterCount") < 2) ||
        get("_saberForceMonster") !== $monster`crate`,
      do: $location`Noob Cave`,
      outfit: () => {
        const run =
          tryFindFreeRun(
            freeRunConstraints({ equip: $items`Fourth of May Cosplay Saber` }),
          ) ?? ltbRun();
        const spec = toSpec(
          new Requirement([], {
            forceEquip: $items`Fourth of May Cosplay Saber`,
            preventEquip: $items`Kramco Sausage-o-Matic™, carnivorous potted plant`,
          }).merge(
            run.constraints.equipmentRequirements?.() ??
              new Requirement([], {}),
          ),
        );
        const familiar =
          run.constraints.familiar?.() ??
          freeFightFamiliar({ canChooseMacro: false });
        return {
          ...spec,
          familiar,
        };
      },
      choices: {
        1387: 2,
      },
      combat: new GarboStrategy(() => {
        const run =
          tryFindFreeRun(
            freeRunConstraints({ equip: $items`Fourth of May Cosplay Saber` }),
          ) ?? ltbRun();
        return Macro.if_($monster`crate`, Macro.skill($skill`Use the Force`))
          .if_($monster`sausage goblin`, Macro.kill())
          .ifInnateWanderer(Macro.step(run.macro))
          .abort();
      }),
      spendsTurn: false,
    },
  } as const satisfies Record<string, CopyTargetTask>;

  draggable(task: CopyTargetTask): DraggableFight | null {
    return (
      (["wanderer", "backup"] as const).find(
        (fightType) => fightType === task.fightType,
      ) ?? null
    );
  }

  underwater(task: CopyTargetTask): boolean {
    // Only run for copy target fights
    if (!task.fightType) return false;
    // Only run for _draggable_ copy target fights
    if (!this.draggable(task)) return false;
    // Only run if we can actually go underwater
    if (!checkUnderwater()) return false;
    // Only run if taffy is worth it
    if (
      mallPrice($item`pulled green taffy`) >
        (targettingMeat()
          ? MEAT_TARGET_MULTIPLIER() * get("valueOfAdventure")
          : get("valueOfAdventure")) &&
      retrieveItem($item`pulled green taffy`)
    ) {
      return false;
    }

    return true;
  }

  createOutfit(task: CopyTargetTask): Outfit {
    if (task.fightType) {
      const baseOutfit = undelay(task.outfit);
      const spec = baseOutfit
        ? baseOutfit instanceof Outfit
          ? baseOutfit.spec()
          : baseOutfit
        : {};

      // Prof chains
      if (have($familiar`Pocket Professor`) && !spec.familiar) {
        const chain = ["_garbo_meatChain", "_garbo_weightChain"].find(
          (pref) => !get(pref, false),
        );
        if (chain) {
          this.profChain = chain;
          spec.familiar = $familiar`Pocket Professor`;
          spec.famequip ??= $item`Pocket Professor memory chip`;
          spec.avoid ??= [];
          spec.avoid.push($item`Roman Candelabra`);
          if (chain === "_garbo_weightchain") {
            return Outfit.from(
              { ...spec, modifier: ["Familiar Weight"] },
              new Error("Unable to build outfit for weight chain!"),
            );
          }
        }
      }

      if (
        !spec.familiar &&
        !get("_badlyRomanticArrows") &&
        !this.underwater(task)
      ) {
        const { familiar, famequip } =
          [
            { familiar: $familiar`Reanimated Reanimator` },
            {
              familiar: $familiar`Obtuse Angel`,
              famequip: $item`quake of arrows`,
            },
          ].find(({ familiar }) => have(familiar)) ?? {};
        if (familiar) {
          spec.familiar = familiar;
          if (famequip) spec.famequip ??= famequip;
        }
      }

      if (isFree(globalOptions.target)) {
        const options = this.underwater(task)
          ? { location: $location`The Briny Deeps` }
          : {};
        return freeFightOutfit(spec, options);
      } else {
        if (task.do instanceof Location) return meatTargetOutfit(spec, task.do);
        if (this.underwater(task)) {
          return meatTargetOutfit(spec, $location`The Briny Deeps`);
        }
        return meatTargetOutfit(spec);
      }
    }

    return super.createOutfit(task);
  }

  do(task: CopyTargetTask) {
    if (this.profChain && PocketProfessor.currentlyAvailableLectures() <= 0) {
      return;
    }

    if (this.underwater(task)) {
      return $location`The Briny Deeps`;
    }
    return super.do(task);
  }

  // TODO: `proceedWithOrb` logic
  // Reconsider the way it works for free fights?
  // Reconsider
  findAvailableFight(type: CopyTargetTask["fightType"]) {
    return this.tasks.find(
      (task) => task.fightType === type && this.available(task),
    );
  }

  post(task: CopyTargetTask): void {
    this.lastFight = task;
    if (task.fightType === "gregarious" && totalGregCharges(true) === 0) {
      set("_garbo_doneGregging", true);
    }

    if (this.profChain) {
      set(this.profChain, true);
      this.profChain = null;
    }
    super.post(task);
  }

  getNextTask(): CopyTargetTask | undefined {
    // TO DO: allow for interpolating non-embezzler tasks into this
    // E.g., kramco, digitize initialization, crate-sabers, and proton ghosts
    // Actually I think those are it? I don't think there's a third

    // We do a wanderer if it's available, because they're basically involuntary
    const wanderer = this.findAvailableFight("wanderer");
    if (wanderer) return wanderer;

    // Conditional fights we want to do when we can
    // But we don't want to reset our orb with a gregarious fight; that defeats the purpose
    const conditional = this.findAvailableFight("conditional");
    if (conditional?.fightType === "gregarious") {
      if (this.available(this.SPECIAL_TASKS.saberCrate)) {
        return this.SPECIAL_TASKS.saberCrate;
      }
      const hasReplacers = hasMonsterReplacers();

      const skipConditionals = crateStrategy() === "Orb" && hasReplacers;

      if (!skipConditionals) return conditional;
    }

    const regularCopy =
      this.findAvailableFight("backup") ??
      this.findAvailableFight("regular") ??
      this.findAvailableFight("chainstarter");
    if (regularCopy) return regularCopy;
    return (
      conditional ??
      this.findAvailableFight("emergencychainstarter") ??
      undefined
    );
  }
}
