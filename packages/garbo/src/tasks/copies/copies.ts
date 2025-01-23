import {
  getClanLounge,
  myHash,
  myRain,
  print,
  runChoice,
  runCombat,
  toInt,
  use,
  useSkill,
  visitUrl,
} from "kolmafia";
import {
  $effect,
  $familiar,
  $item,
  $items,
  $location,
  $locations,
  $skill,
  ChateauMantegna,
  ChestMimic,
  CombatLoversLocket,
  Counter,
  get,
  have,
  HeavyRains,
  property,
  SourceTerminal,
} from "libram";
import { acquire } from "../../acquire";
import { globalOptions } from "../../config";
import {
  averageTargetNet,
  HIGHLIGHT,
  isFreeAndCopyable,
  WISH_VALUE,
} from "../../lib";
import { doingGregFight, gregReady } from "../../resources";
import { copyTargetCount, copyTargetSources } from "../../target";
import { puttyLeft } from "../../target/lib";
import { CopyTargetTask } from "../engine";
import { GarboStrategy, Macro } from "../../combat";
import { wanderer } from "../../garboWanderer";
import { copyTargetConfirmInvocation } from "../../target/fights";

let monsterInEggnet: boolean;
const mosterIsInEggnet = () =>
  (monsterInEggnet ??= ChestMimic.getReceivableMonsters().includes(
    globalOptions.target,
  ));

// TO DO: non-trivial combat strategies, choosing outfit function based on copy target
// Outfit needs to support prof, angel, and underwater
// Combat can passively support prof probably
// Might be a weird edge case where we're copying a free fight and want to charge our professor
// But I think we're fine?

export const CopyTargetFights: CopyTargetTask[] = (
  [
    {
      name: "Digitize",
      ready: () =>
        get("_sourceTerminalDigitizeMonster") === globalOptions.target &&
        Counter.get("Digitize Monster") <= 0,
      completed: () =>
        Counter.get("Digitize Monster") > 0 ||
        !(get("_sourceTerminalDigitizeMonster") === globalOptions.target),
      do: () => wanderer().getTarget("wanderer"),
      fightType: "wanderer",
      amount: () =>
        SourceTerminal.have() && SourceTerminal.getDigitizeUses() === 0 ? 1 : 0,
    },
    {
      name: "Guaranteed Romantic Monster",
      ready: () =>
        get("_romanticFightsLeft") > 0 &&
        Counter.get("Romantic Monster window begin") <= 0 &&
        Counter.get("Romantic Monster window end") <= 0,
      completed: () => get("_romanticFightsLeft") <= 0,
      do: () => wanderer().getTarget("wanderer"),
      fightType: "wanderer",
    },
    {
      name: "Enamorang",
      ready: () =>
        Counter.get("Enamorang") <= 0 &&
        get("enamorangMonster") === globalOptions.target,
      completed: () => Counter.get("Enamorang") <= 0,
      do: () => wanderer().getTarget("wanderer"),
      fightType: "wanderer",
    },
    {
      name: "Time-Spinner",
      ready: () =>
        have($item`Time-Spinner`) &&
        $locations`Noob Cave, The Dire Warren, The Haunted Kitchen`.some(
          (location) =>
            location.combatQueue.includes(globalOptions.target.name),
        ) &&
        get("_timeSpinnerMinutesUsed") <= 7,
      completed: () => get("_timeSpinnerMinutesUsed") > 7,
      do: (): void => {
        visitUrl(`inv_use.php?whichitem=${toInt($item`Time-Spinner`)}`);
        runChoice(1);
        visitUrl(
          `choice.php?whichchoice=1196&monid=${globalOptions.target.id}&option=1`,
        );
      },
      fightType: "regular",
      amount: () =>
        have($item`Time-Spinner`)
          ? Math.floor((10 - get("_timeSpinnerMinutesUsed")) / 3)
          : 0,
    },
    {
      name: "Spooky Putty & Rain-Doh",
      ready: () =>
        (have($item`Spooky Putty monster`) &&
          get("spookyPuttyMonster") === globalOptions.target) ||
        (have($item`Rain-Doh box full of monster`) &&
          get("rainDohMonster") === globalOptions.target),
      completed: () => puttyLeft() < 1,
      do: (): void => {
        if (
          have($item`Spooky Putty monster`) &&
          get("spookyPuttyMonster") === globalOptions.target
        ) {
          use($item`Spooky Putty monster`);
        } else if (
          have($item`Rain-Doh box full of monster`) &&
          get("rainDohMonster") === globalOptions.target
        ) {
          use($item`Rain-Doh box full of monster`);
        }
      },
      fightType: "regular",
      amount: puttyLeft,
    },
    {
      name: "4-d Camera",
      ready: () =>
        have($item`shaking 4-d camera`) &&
        get("cameraMonster") === globalOptions.target &&
        !get("_cameraUsed"),
      completed: () => get("_cameraUsed"),
      do: (): void => {
        use($item`shaking 4-d camera`);
      },
      fightType: "regular",
    },
    {
      name: "Ice Sculpture",
      ready: () =>
        have($item`ice sculpture`) &&
        get("iceSculptureMonster") === globalOptions.target &&
        !get("_iceSculptureUsed"),
      completed: () => get("_iceSculptureUsed"),
      do: (): void => {
        use($item`ice sculpture`);
      },
      fightType: "regular",
    },
    {
      name: "Green Taffy",
      ready: () =>
        have($item`envyfish egg`) &&
        get("envyfishMonster") === globalOptions.target &&
        !get("_envyfishEggUsed"),
      completed: () => get("_envyfishEggUsed"),
      do: (): void => {
        use($item`envyfish egg`);
      },
      fightType: "regular",
    },
    {
      name: "Screencapped Monster",
      ready: () =>
        have($item`screencapped monster`) &&
        property.get("screencappedMonster") === globalOptions.target,
      completed: () =>
        !have($item`screencapped monster`) ||
        !(property.get("screencappedMonster") === globalOptions.target),
      do: (): void => {
        use($item`screencapped monster`);
      },
      fightType: "regular",
    },
    {
      name: "Sticky Clay Homunculus",
      ready: () =>
        have($item`sticky clay homunculus`) &&
        property.get("crudeMonster") === globalOptions.target,
      completed: () =>
        !have($item`sticky clay homunculus`) ||
        !(property.get("crudeMonster") === globalOptions.target),
      do: (): void => {
        use($item`sticky clay homunculus`);
      },
      fightType: "regular",
    },
    {
      name: "Macrometeorite",
      ready: () =>
        gregReady() &&
        have($skill`Meteor Lore`) &&
        get("_macrometeoriteUses") < 10,
      completed: () => get("_macrometeoriteUses") >= 10,
      do: $location`Noob Cave`,
      canInitializeWandererCounters: true,
      fightType: "gregarious",
      amount: () =>
        doingGregFight() && have($skill`Meteor Lore`)
          ? 10 - get("_macrometeoriteUses")
          : 0,
    },
    {
      name: "Powerful Glove",
      ready: () =>
        gregReady() &&
        have($item`Powerful Glove`) &&
        get("_powerfulGloveBatteryPowerUsed") <= 90,
      completed: () => get("_powerfulGloveBatteryPowerUsed") >= 95,
      outfit: { acc1: $item`Powerful Glove` },
      do: $location`The Dire Warren`,
      canInitializeWandererCounters: true,
      fightType: "gregarious",
      amount: () =>
        doingGregFight() && have($item`Powerful Glove`)
          ? Math.min((100 - get("_powerfulGloveBatteryPowerUsed")) / 10)
          : 0,
    },
    {
      name: "Backup",
      ready: () =>
        get("lastCopyableMonster") === globalOptions.target &&
        have($item`backup camera`) &&
        get("_backUpUses") < 11,
      completed: () => get("_backUpUses") >= 11,
      do: () => wanderer().getTarget("backup"),
      canInitializeWandererCounters: true,
      outfit: {
        equip: $items`backup camera`,
        modes: { backupcamera: "meat" },
      },
      pre: () => {
        if (
          have($skill`Musk of the Moose`) &&
          !have($effect`Musk of the Moose`)
        ) {
          useSkill($skill`Musk of the Moose`);
        }
      },
      fightType: "backup",
      amount: () => (have($item`backup camera`) ? 11 - get("_backUpUses") : 0),
    },
    {
      name: "Chateau Painting",
      ready: () =>
        ChateauMantegna.have() &&
        !ChateauMantegna.paintingFought() &&
        ChateauMantegna.paintingMonster() === globalOptions.target,
      completed: () => ChateauMantegna.paintingFought(),
      do: (): void => {
        ChateauMantegna.fightPainting();
      },
      fightType: "chainstarter",
    },
    {
      name: "Combat Lover's Locket",
      completed: () =>
        !CombatLoversLocket.availableLocketMonsters().includes(
          globalOptions.target,
        ),
      do: (): void => {
        CombatLoversLocket.reminisce(globalOptions.target);
      },
      fightType: "chainstarter",
    },
    {
      name: "Fax",
      ready: () =>
        have($item`Clan VIP Lounge key`) &&
        !get("_photocopyUsed") &&
        have($item`photocopied monster`) &&
        property.get("photocopyMonster") === globalOptions.target &&
        getClanLounge()["deluxe fax machine"] !== undefined,
      completed: () => get("_photocopyUsed"),
      do: (): void => {
        use($item`photocopied monster`);
      },
      fightType: "chainstarter",
    },
    {
      name: "Mimic Egg",
      completed: () =>
        ChestMimic.differentiableQuantity(globalOptions.target) < 1,
      do: (): void => {
        ChestMimic.differentiate(globalOptions.target);
      },
      fightType: "chainstarter",
      amount: () => ChestMimic.differentiableQuantity(globalOptions.target),
    },
    {
      name: "Rain Man",
      ready: () => have($skill`Rain Man`) && myRain() >= 50,
      completed: () => myRain() < 50,
      do: (): void => {
        HeavyRains.rainMan(globalOptions.target);
      },
      fightType: "chainstarter",
      amount: () => Math.floor(myRain() / 50),
    },
    {
      name: "Professor MeatChain",
      completed: () => true,
      do: (): void => {},
      fightType: "fake",
      amount: () =>
        have($familiar`Pocket Professor`) && !get("_garbo_meatChain", false)
          ? Math.max(10 - get("_pocketProfessorLectures"), 0)
          : 0,
    },
    {
      name: "Professor WeightChain",
      completed: () => true,
      do: (): void => {},
      fightType: "fake",
      amount: () =>
        have($familiar`Pocket Professor`) && !get("_garbo_weightChain", false)
          ? Math.min(15 - get("_pocketProfessorLectures"), 5)
          : 0,
    },
    {
      name: "Mimic Egg (from clinic)",
      ready: () =>
        ChestMimic.have() &&
        $familiar`Chest Mimic`.experience >= 100 &&
        mosterIsInEggnet(),
      completed: () => get("_mimicEggsObtained") >= 11, // gonna need help here, too I think.
      do: (): void => {
        ChestMimic.receive(globalOptions.target);
        ChestMimic.differentiate(globalOptions.target);
      },
      canInitializeWandererCounters: false,
      fightType: "emergencychainstarter",
      amount: () => 0,
    },
    {
      name: "Pocket Wish",
      ready: () =>
        globalOptions.target.wishable &&
        get("_genieFightsUsed") >= 3 &&
        Math.floor(copyTargetCount()) > 1,
      prepare: () => {
        const potential = Math.floor(copyTargetCount());
        if (globalOptions.askedAboutWish) return globalOptions.wishAnswer;
        const profit = (potential + 1) * averageTargetNet() - WISH_VALUE;
        if (profit < 0) return false;
        print(
          `You have the following copy target sources untapped right now:`,
          HIGHLIGHT,
        );
        copyTargetSources
          .filter((source) => source.potential() > 0)
          .map((source) => `${source.potential()} from ${source.name}`)
          .forEach((text) => print(text, HIGHLIGHT));
        globalOptions.askedAboutWish = true;
        globalOptions.wishAnswer = copyTargetConfirmInvocation(
          `Garbo has detected you have ${potential} potential ways to copy a ${
            globalOptions.target
          }, but no way to start a fight with one. Current ${
            globalOptions.target
          } net (before potions) is ${averageTargetNet()}, so we expect to earn ${profit} meat, after the cost of a wish. Should we wish for ${
            globalOptions.target
          }?`,
        );
        return globalOptions.wishAnswer;
      },
      completed: () =>
        globalOptions.wishAnswer === false || get("_genieFightsUsed") >= 3, // gonna need help here, too I think.
      do: (): void => {
        acquire(1, $item`pocket wish`, WISH_VALUE);
        visitUrl(
          `inv_use.php?pwd=${myHash()}&which=3&whichitem=9537`,
          false,
          true,
        );
        visitUrl(
          `choice.php?pwd&whichchoice=1267&option=1&wish=to fight a ${globalOptions.target} `,
          true,
          true,
        );
        visitUrl("main.php", false);
        runCombat();
        globalOptions.askedAboutWish = false;
      },
      canInitializeWandererCounters: true,
      fightType: "emergencychainstarter",
      amount: () => 0,
    },
  ] as const
).map((partialTask) => ({
  combat: new GarboStrategy(() => Macro.target(partialTask.name)),
  outfit: {},
  spendsTurn: () => !isFreeAndCopyable(globalOptions.target),
  ...partialTask,
}));
