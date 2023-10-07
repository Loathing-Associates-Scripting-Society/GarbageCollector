import {
  availableAmount,
  canAdventure,
  canEquip,
  currentRound,
  eat,
  Location,
  mallPrice,
  maximize,
  myAdventures,
  myInebriety,
  myLevel,
  runChoice,
  runCombat,
  totalTurnsPlayed,
  toUrl,
  use,
  useSkill,
  visitUrl,
} from "kolmafia";
import {
  $effect,
  $item,
  $items,
  $location,
  $monster,
  $skill,
  clamp,
  Counter,
  ensureEffect,
  get,
  getModifier,
  have,
  questStep,
  SourceTerminal,
} from "libram";
import { garboAdventureAuto, Macro, withMacro } from "../combat";
import { globalOptions } from "../config";
import { wanderer } from "../garboWanderer";
import {
  embezzler,
  EMBEZZLER_MULTIPLIER,
  howManySausagesCouldIEat,
  kramcoGuaranteed,
  propertyManager,
  romanticMonsterImpossible,
  setChoice,
  sober,
} from "../lib";
import {
  barfOutfit,
  embezzlerOutfit,
  familiarWaterBreathingEquipment,
  freeFightOutfit,
  latteFilled,
  tryFillLatte,
  waterBreathingEquipment,
} from "../outfit";
import { digitizedMonstersRemaining } from "../turns";
import { completeBarfQuest } from "./daily";
import { GarboTask } from "./engine";
import { CombatStrategy, Quest } from "grimoire-kolmafia";
import { deliverThesisIfAble } from "../fights";
import { computeDiet, consumeDiet } from "../diet";

const steveAdventures: Map<Location, number[]> = new Map([
  [$location`The Haunted Bedroom`, [1, 3, 1]],
  [$location`The Haunted Nursery`, [1, 2, 2, 1, 1]],
  [$location`The Haunted Conservatory`, [1, 2, 2]],
  [$location`The Haunted Billiards Room`, [1, 2, 2]],
  [$location`The Haunted Wine Cellar`, [1, 2, 2, 3]],
  [$location`The Haunted Boiler Room`, [1, 2, 2]],
  [$location`The Haunted Laboratory`, [1, 1, 3, 1, 1]],
]);

const canDuplicate = () => SourceTerminal.have() && SourceTerminal.duplicateUsesRemaining() > 0;
const digitizedEmbezzler = () =>
  SourceTerminal.have() && SourceTerminal.getDigitizeMonster() === embezzler;

const isGhost = () => get("_voteMonster") === $monster`angry ghost`;
const isMutant = () => get("_voteMonster") === $monster`terrible mutant`;

const macroCombat = (startingMacro: () => Macro, macro?: () => Macro) => {
  const combatStrategy = new CombatStrategy().startingMacro(startingMacro);
  if (macro) {
    return combatStrategy.macro(macro);
  }
  return combatStrategy;
};

function shouldGoUnderwater(): boolean {
  if (!sober()) return false;
  if (myLevel() < 11) return false;

  if (questStep("questS01OldGuy") === -1) {
    visitUrl("place.php?whichplace=sea_oldman&action=oldman_oldman");
  }

  if (
    !getModifier("Adventure Underwater") &&
    waterBreathingEquipment.every((item) => !have(item) || !canEquip(item))
  ) {
    return false;
  }
  if (
    !getModifier("Underwater Familiar") &&
    familiarWaterBreathingEquipment.every((item) => !have(item))
  ) {
    return false;
  }

  if (have($item`envyfish egg`) || (globalOptions.ascend && get("_envyfishEggUsed"))) return false;
  if (!canAdventure($location`The Briny Deeps`)) return false;
  if (mallPrice($item`pulled green taffy`) < EMBEZZLER_MULTIPLIER() * get("valueOfAdventure")) {
    return false;
  }

  if (have($effect`Fishy`)) return true;
  if (have($item`fishy pipe`) && !get("_fishyPipeUsed")) {
    use($item`fishy pipe`);
    return have($effect`Fishy`);
  }
  return false;
}

const BarfTurnTasks: GarboTask[] = [
  {
    name: "Latte",
    completed: () => latteFilled(),
    do: () => tryFillLatte(),
    spendsTurn: false,
  },
  {
    name: "Generate End of Day Turns",
    completed: () => myAdventures() > 1 + globalOptions.saveTurns,
    do: () => {
      deliverThesisIfAble();

      const sausages = howManySausagesCouldIEat();
      if (sausages > 0) {
        maximize("MP", false);
        eat(sausages, $item`magical sausage`);
      }

      if (
        have($item`designer sweatpants`) &&
        myAdventures() === 1 + globalOptions.saveTurns &&
        !globalOptions.nodiet
      ) {
        while (get("_sweatOutSomeBoozeUsed") < 3 && get("sweat") >= 25 && myInebriety() > 0) {
          useSkill($skill`Sweat Out Some Booze`);
        }
        consumeDiet(computeDiet().sweatpants(), "SWEATPANTS");
      }
    },
    sobriety: "sober",
    spendsTurn: true,
  },
  {
    name: "Lights Out",
    ready: () =>
      canAdventure(get("nextSpookyravenStephenRoom") ?? $location`none`) &&
      get("nextSpookyravenStephenRoom") !== get("ghostLocation") &&
      totalTurnsPlayed() % 37 === 0,
    completed: () => totalTurnsPlayed() === get("lastLightsOutTurn"),
    do: () => {
      const steveRoom = get("nextSpookyravenStephenRoom");
      if (steveRoom && canAdventure(steveRoom)) {
        const fightingSteve = steveRoom === $location`The Haunted Laboratory`;
        const plan = steveAdventures.get(steveRoom);
        if (plan) {
          withMacro(
            Macro.if_($monster`Stephen Spookyraven`, Macro.basicCombat()).abort(),
            () => {
              visitUrl(toUrl(steveRoom));
              for (const choiceValue of plan) {
                runChoice(choiceValue);
              }
              if (fightingSteve || currentRound()) runCombat();
            },
            true,
          );
        }
      }
    },
    outfit: () => embezzlerOutfit(sober() ? {} : { offhand: $item`Drunkula's wineglass` }),
    spendsTurn: () => get("nextSpookyravenStephenRoom") === $location`The Haunted Laboratory`,
  },
  {
    name: "Proton Ghost",
    ready: () => have($item`protonic accelerator pack`) && !!get("ghostLocation"),
    completed: () => get("questPAGhost") === "unstarted",
    do: () => get("ghostLocation") as Location,
    outfit: () =>
      freeFightOutfit({
        modifier: get("ghostLocation") === $location`The Icy Peak` ? ["Cold Resistance 5 min"] : [],
        back: $item`protonic accelerator pack`,
      }),
    combat: macroCombat(() => Macro.ghostBustin()),
    spendsTurn: false,
    // Ghost fights are currently hard
    // and they resist physical attacks!
    sobriety: "sober",
  },
  {
    name: "Vote Wanderer",
    ready: () =>
      have($item`"I Voted!" sticker`) &&
      totalTurnsPlayed() % 11 === 1 &&
      get("_voteFreeFights") < 3,
    completed: () => get("lastVoteMonsterTurn") >= totalTurnsPlayed(),
    do: () => {
      propertyManager.setChoices(
        wanderer().getChoices({ wanderer: "wanderer", drunkSafe: !isGhost() }),
      );
      return wanderer().getTarget({ wanderer: "wanderer", drunkSafe: !isGhost() });
    },
    outfit: () =>
      freeFightOutfit(
        {
          equip: [
            $item`"I Voted!" sticker`,
            ...(!sober() && !isGhost() ? $items`Drunkula's wineglass` : []),
            ...(!have($item`mutant crown`) && isMutant()
              ? $items`mutant arm, mutant legs`.filter((i) => have(i))
              : []),
          ],
        },
        { wanderOptions: { wanderer: "wanderer", drunkSafe: !isGhost() } },
      ),
    combat: new CombatStrategy().startingMacro(() => Macro.basicCombat()),
    spendsTurn: false,
  },
  {
    name: "Digitize Wanderer",
    completed: () => Counter.get("Digitize Monster") > 0,
    acquire: () =>
      SourceTerminal.getDigitizeMonster() === embezzler && shouldGoUnderwater()
        ? [{ item: $item`pulled green taffy` }]
        : [],
    outfit: () =>
      digitizedEmbezzler()
        ? embezzlerOutfit({}, wanderer().getTarget({ wanderer: "wanderer", allowEquipment: false }))
        : freeFightOutfit(),
    do: () => {
      if (shouldGoUnderwater()) {
        return $location`The Briny Deeps`;
      } else {
        propertyManager.setChoices(
          wanderer().getChoices({ wanderer: "wanderer", allowEquipment: false }),
        );
        return wanderer().getTarget({ wanderer: "wanderer", allowEquipment: false });
      }
    },
    combat: new CombatStrategy()
      .startingMacro(() =>
        Macro.externalIf(shouldGoUnderwater(), Macro.item($item`pulled green taffy`)).meatKill(),
      )
      .macro(
        Macro.if_(
          `(monsterid ${embezzler.id}) && !gotjump && !(pastround 2)`,
          Macro.externalIf(shouldGoUnderwater(), Macro.item($item`pulled green taffy`)).meatKill(),
        ).abortWithMsg(
          `Expected a digitized ${SourceTerminal.getDigitizeMonster()}, but encountered something else.`,
        ),
      ),
    spendsTurn: () => !SourceTerminal.getDigitizeMonster()?.attributes.includes("FREE"),
  },
  {
    name: "Guaranteed Kramco",
    ready: () => romanticMonsterImpossible(),
    completed: () => !kramcoGuaranteed(),
    do: () => {
      propertyManager.setChoices(wanderer().getChoices("wanderer"));
      return wanderer().getTarget("wanderer");
    },
    outfit: () =>
      freeFightOutfit(
        {
          offhand: $item`Kramco Sausage-o-Matic™`,
        },
        { wanderOptions: "wanderer" },
      ),
    spendsTurn: false,
  },
  {
    name: "Void Monster",
    ready: () => have($item`cursed magnifying glass`) && get("_voidFreeFights") < 5,
    completed: () => get("cursedMagnifyingGlassCount") !== 13,
    do: () => {
      freeFightOutfit(
        {
          offhand: $item`cursed magnifying glass`,
        },
        { wanderOptions: "wanderer" },
      ).dress();
      propertyManager.setChoices(wanderer().getChoices("wanderer"));
      garboAdventureAuto(wanderer().getTarget("wanderer"), Macro.basicCombat());
      return get("cursedMagnifyingGlassCount") === 0;
    },
    spendsTurn: false,
  },
  {
    name: "Envyfish Egg",
    ready: () => have($item`envyfish egg`) && get("envyfishMonster") === embezzler,
    completed: () => get("_envyfishEggUsed"),
    do: () => {
      embezzlerOutfit().dress();
      withMacro(Macro.meatKill(), () => use($item`envyfish egg`), true);
      return get("_envyfishEggUsed");
    },
    spendsTurn: true,
  },
  {
    name: "Cheese Wizard Fondeluge",
    ready: () => have($skill`Fondeluge`) && romanticMonsterImpossible(),
    completed: () => have($effect`Everything Looks Yellow`),
    do: () => {
      propertyManager.setChoices(wanderer().getChoices("yellow ray"));
      return wanderer().getTarget("yellow ray");
    },
    outfit: () =>
      freeFightOutfit(
        {},
        { location: wanderer().getTarget("freefight"), wanderOptions: "freefight" },
      ),
    combat: new CombatStrategy().startingMacro(() =>
      Macro.if_(embezzler, Macro.meatKill())
        .familiarActions()
        .externalIf(canDuplicate(), Macro.trySkill($skill`Duplicate`))
        .skill($skill`Fondeluge`),
    ),
    duplicate: true,
    spendsTurn: false,
    sobriety: "sober",
  },
  {
    name: "Spit Acid",
    ready: () => have($item`Jurassic Parka`) && romanticMonsterImpossible(),
    completed: () => have($effect`Everything Looks Yellow`),
    do: () => {
      propertyManager.setChoices(wanderer().getChoices("yellow ray"));
      return wanderer().getTarget("yellow ray");
    },
    outfit: () =>
      freeFightOutfit(
        { shirt: $items`Jurassic Parka`, modes: { parka: "dilophosaur" } },
        {
          duplicate: true,
          wanderOptions: "yellow ray",
        },
      ),
    spendsTurn: false,
    sobriety: "sober",
  },
  {
    name: "Pig Skinner Free-For-All",
    ready: () => have($skill`Free-For-All`) && romanticMonsterImpossible(),
    completed: () => have($effect`Everything Looks Red`),
    do: () => {
      propertyManager.setChoices(wanderer().getChoices("freefight"));
      return wanderer().getTarget("freefight");
    },
    outfit: () =>
      freeFightOutfit(
        {},
        { location: wanderer().getTarget("freefight"), wanderOptions: "freefight" },
      ),
    combat: new CombatStrategy().startingMacro(() =>
      Macro.if_(embezzler, Macro.meatKill())
        .familiarActions()
        .externalIf(canDuplicate(), Macro.trySkill($skill`Duplicate`))
        .skill($skill`Free-For-All`),
    ),
    duplicate: true,
    spendsTurn: false,
    sobriety: "sober",
  },
  {
    name: "Shocking Lick",
    ready: () => romanticMonsterImpossible(),
    completed: () => get("shockingLickCharges") === 0,
    do: () => {
      propertyManager.setChoices(wanderer().getChoices("yellow ray"));
      return wanderer().getTarget("yellow ray");
    },
    outfit: () =>
      freeFightOutfit(
        {},
        {
          allowAttackFamiliars: !canDuplicate(),
          wanderOptions: "yellow ray",
        },
      ),
    combat: new CombatStrategy().startingMacro(() =>
      Macro.if_(embezzler, Macro.meatKill())
        .familiarActions()
        .externalIf(canDuplicate(), Macro.trySkill($skill`Duplicate`))
        .skill($skill`Shocking Lick`),
    ),
    duplicate: true,
    spendsTurn: false,
    sobriety: "sober",
  },
  {
    name: "Map for Pills",
    ready: () =>
      globalOptions.ascend &&
      clamp(myAdventures() - digitizedMonstersRemaining(), 1, myAdventures()) <=
        availableAmount($item`Map to Safety Shelter Grimace Prime`),
    completed: () => false,
    do: () => {
      const choiceToSet =
        availableAmount($item`distention pill`) <
        availableAmount($item`synthetic dog hair pill`) +
          availableAmount($item`Map to Safety Shelter Grimace Prime`)
          ? 1
          : 2;
      setChoice(536, choiceToSet);
      ensureEffect($effect`Transpondent`);
      use($item`Map to Safety Shelter Grimace Prime`);
      return true;
    },
    spendsTurn: true,
    sobriety: "drunk",
  },
  {
    name: "Barf",
    completed: () => false,
    outfit: () => {
      const lubing = get("dinseyRollercoasterNext") && have($item`lube-shoes`);
      return barfOutfit(lubing ? { equip: $items`lube-shoes` } : {});
    },
    do: () => $location`Barf Mountain`,
    combat: macroCombat(
      () => Macro.meatKill(),
      () =>
        Macro.if_(
          `(monsterid ${$monster`Knob Goblin Embezzler`.id}) && !gotjump && !(pastround 2)`,
          Macro.meatKill(),
        ).abort(),
    ),
    post: () => completeBarfQuest(),
    spendsTurn: true,
  },
];

export const BarfTurnQuest: Quest<GarboTask> = {
  name: "Barf Turn",
  tasks: BarfTurnTasks,
};
