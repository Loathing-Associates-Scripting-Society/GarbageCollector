import { Engine, Task } from "grimoire-kolmafia";
import { canAdventure, cliExecute, Item, use } from "kolmafia";
import {
  $effect,
  $item,
  $items,
  $location,
  $skill,
  FloristFriar,
  get,
  have,
  realmAvailable,
  Requirement,
  tryFindFreeRun,
} from "libram";
import { freeRunConstraints, ltbRun, propertyManager } from "../lib";
import { garboAdventureAuto, Macro } from "../combat";
import { freeFightFamiliar } from "../familiar";
import { wanderer } from "../garboWanderer";
import { freeFightOutfit, toSpec } from "../outfit";
import postCombatActions from "../post";
import { bestYachtzeeFamiliar } from "./familiar";
import { waterBreathingEquipment } from "../outfit";

function yachtzeeTasks(equipment: Item): Task[] {
  const familiar = bestYachtzeeFamiliar();

  const meatOutfit = toSpec(
    new Requirement(
      [
        "meat",
        ...(familiar.underwater || have($effect`Driving Waterproofly`) || have($effect`Wet Willied`)
          ? []
          : ["underwater familiar"]),
      ],
      {
        forceEquip: [equipment],
        preventEquip: $items`anemoney clip, cursed magnifying glass, Kramco Sausage-o-Matic™, cheap sunglasses`,
        modes: equipment === $item`The Crown of Ed the Undying` ? { edpiece: "fish" } : {},
      },
    ),
  );

  return [
    {
      name: "Yachtzee",
      ready: () => get("noncombatForcerActive") && have($effect`Fishy`),
      completed: () => false,
      do: $location`The Sunken Party Yacht`,
      outfit: () => {
        return {
          familiar,

          ...meatOutfit,
        };
      },
      post: () => {
        if (
          canAdventure($location`The Spooky Forest`) &&
          FloristFriar.have() &&
          FloristFriar.Crookweed.available()
        ) {
          FloristFriar.Crookweed.plant();
        }
      },
    },
    {
      name: "Fishy Pipe",
      ready: () => have($item`fishy pipe`) && !have($effect`Fishy`),
      completed: () => get("_fishyPipeUsed"),
      do: () => use($item`fishy pipe`),
    },
    {
      name: "Spikolodon Spikes",
      ready: () => have($item`Jurassic Parka`) && get("_spikolodonSpikeUses") < 5,
      completed: () => get("noncombatForcerActive"),
      do: () => {
        const run = tryFindFreeRun(freeRunConstraints(false)) ?? ltbRun();
        const familiar =
          run.constraints.familiar?.() ?? freeFightFamiliar({ allowAttackFamiliars: false });
        run.constraints.preparation?.();
        freeFightOutfit({ shirt: $item`Jurassic Parka`, ...toSpec(run), familiar }).dress();
        cliExecute("parka spikolodon");

        const targetZone = $location`Sloppy Seconds Diner`;
        const macro = Macro.familiarActions()
          .skill($skill`Launch spikolodon spikes`)
          .step(run.macro);

        const ncSkipper = wanderer().unsupportedChoices.get(targetZone);
        if (ncSkipper) propertyManager.setChoices(ncSkipper);
        garboAdventureAuto(targetZone, macro);
        postCombatActions();
      },
    },
    {
      name: "Clara's Bell",
      ready: () => have($item`Clara's bell`) && !get("_claraBellUsed"),
      completed: () => get("noncombatForcerActive"),
      do: () => use($item`Clara's bell`),
    },
  ];
}

export function yachtzeeChain() {
  const equipment = waterBreathingEquipment.find((i) => have(i));

  if (realmAvailable("sleaze") && equipment) {
    const engine = new Engine(yachtzeeTasks(equipment));
    try {
      engine.run();
    } finally {
      engine.destruct();
    }
  }
}
