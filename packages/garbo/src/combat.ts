import {
  adv1,
  choiceFollowsFight,
  currentHitStat,
  equippedAmount,
  equippedItem,
  getAutoAttack,
  getMonsters,
  haveEquipped,
  haveSkill,
  hippyStoneBroken,
  inMultiFight,
  Item,
  itemAmount,
  itemType,
  Location,
  mpCost,
  myAdventures,
  myBuffedstat,
  myClass,
  myFamiliar,
  myFury,
  myMp,
  myPath,
  mySoulsauce,
  numericModifier,
  retrieveItem,
  runCombat,
  setAutoAttack,
  setCcs,
  Skill,
  toInt,
  visitUrl,
  writeCcs,
} from "kolmafia";
import {
  $class,
  $effect,
  $element,
  $familiar,
  $item,
  $items,
  $location,
  $locations,
  $monster,
  $monsters,
  $skill,
  $slot,
  $stat,
  CinchoDeMayo,
  Counter,
  get,
  getTodaysHolidayWanderers,
  have,
  HeavyRains,
  SongBoom,
  SourceTerminal,
  StrictMacro,
} from "libram";
import { globalOptions, isQuickCombat } from "./config";
import { canOpenRedPresent, meatFamiliar, timeToMeatify } from "./familiar";
import { digitizedMonstersRemaining } from "./turns";
import {
  gooseDroneEligible,
  isStrongScaler,
  maxPassiveDamage,
  monsterManuelAvailable,
  targettingMeat,
} from "./lib";
import { CombatStrategy } from "grimoire-kolmafia";
import { copyTargetCount } from "./target";

export function shouldRedigitize(): boolean {
  const digitizesLeft = SourceTerminal.getDigitizeUsesRemaining();
  const monsterCount = SourceTerminal.getDigitizeMonsterCount() + 1;
  // triangular number * 10 - 3
  const digitizeAdventuresUsed = monsterCount * (monsterCount + 1) * 5 - 3;
  // Redigitize if fewer adventures than this digitize usage.
  return (
    SourceTerminal.have() &&
    SourceTerminal.canDigitize() &&
    myAdventures() * 1.04 < digitizesLeft * digitizeAdventuresUsed
  );
}

export class Macro extends StrictMacro {
  abortWithMsg(errorMessage: string): Macro {
    return this.step(`abort "${errorMessage}"`);
  }

  static abortWithMsg(errorMessage: string): Macro {
    return new Macro().step(`abort "${errorMessage}"`);
  }

  tryHaveSkill(skill: Skill | null): Macro {
    if (!skill) return this;
    return this.externalIf(haveSkill(skill), Macro.trySkill(skill));
  }

  static tryHaveSkill(skill: Skill | null): Macro {
    return new Macro().tryHaveSkill(skill);
  }

  tryHaveItem(item: Item | null): Macro {
    if (!item) return this;
    return this.externalIf(have(item), Macro.tryItem(item));
  }

  static tryHaveItem(item: Item | null): Macro {
    return new Macro().tryHaveItem(item);
  }

  trySingAlong(): Macro {
    if (!SongBoom.have() || SongBoom.song() !== "Total Eclipse of Your Meat") {
      return this;
    }
    return this.tryHaveSkill($skill`Sing Along`);
  }

  static trySingAlong(): Macro {
    return new Macro().trySingAlong();
  }

  ifInnateWanderer(macro: Macro): Macro {
    // if this monster appears without action on the part of the script

    const monsters = [
      ...(myPath() === HeavyRains.path ? [...HeavyRains.wanderers] : []),
      ...getTodaysHolidayWanderers(),
    ];

    return this.externalIf(monsters.length > 0, Macro.if_(monsters, macro));
  }

  static ifInnateWanderer(macro: Macro): Macro {
    // if this monster appears without action on the part of the script
    return new Macro().ifInnateWanderer(macro);
  }

  familiarActions(): Macro {
    return this.externalIf(
      myFamiliar() === $familiar`Grey Goose` && timeToMeatify(),
      Macro.trySkill($skill`Meatify Matter`),
    )
      .externalIf(
        canOpenRedPresent() && myFamiliar() === $familiar`Crimbo Shrub`,
        Macro.trySkill($skill`Open a Big Red Present`),
      )
      .externalIf(
        myFamiliar() === $familiar`Space Jellyfish`,
        Macro.externalIf(
          get("_spaceJellyfishDrops") < 5,
          Macro.if_(
            $locations`Barf Mountain, Pirates of the Garbage Barges, Uncle Gator's Country Fun-Time Liquid Waste Sluice, The Toxic Teacups`.flatMap(
              (l) => getMonsters(l),
            ),
            Macro.trySkill($skill`Extract Jelly`),
          ),
          Macro.trySkill($skill`Extract Jelly`),
        ),
      );
  }

  static familiarActions(): Macro {
    return new Macro().familiarActions();
  }

  tryCopier(itemOrSkill: Item | Skill): Macro {
    switch (itemOrSkill) {
      case $item`Spooky Putty sheet`:
        return this.externalIf(
          get("spookyPuttyCopiesMade") +
            Math.max(1, get("_raindohCopiesMade")) <
            6 &&
            $items`Spooky Putty sheet, Spooky Putty monster`.some((item) =>
              have(item),
            ),
          Macro.tryItem(itemOrSkill),
        );
      case $item`Rain-Doh black box`:
        return this.externalIf(
          get("_raindohCopiesMade") +
            Math.max(1, get("spookyPuttyCopiesMade")) <
            6 &&
            $items`Rain-Doh black box, Rain-Doh box full of monster`.some(
              (item) => have(item),
            ),
          Macro.tryItem(itemOrSkill),
        );
      case $item`4-d camera`:
        return this.externalIf(
          !get("_cameraUsed") && !have($item`shaking 4-d camera`),
          Macro.tryHaveItem(itemOrSkill),
        );
      case $item`crappy camera`:
        return this.externalIf(
          !get("_crappyCameraUsed") && !have($item`shaking crappy camera`),
          Macro.tryHaveItem(itemOrSkill),
        );
      case $item`unfinished ice sculpture`:
        return this.externalIf(
          !get("_iceSculptureUsed") && !have($item`ice sculpture`),
          Macro.tryHaveItem(itemOrSkill),
        );
      case $item`pulled green taffy`:
        return this.externalIf(
          !get("_envyfishEggUsed") && !have($item`envyfish egg`),
          Macro.tryHaveItem(itemOrSkill),
        );
      case $item`print screen button`:
        return this.tryHaveItem(itemOrSkill);
      case $item`alpine watercolor set`:
        return this.tryHaveItem(itemOrSkill);
      case $item`LOV Enamorang`:
        return this.externalIf(
          get("_enamorangs") < 5 && !get("enamorangMonster"),
          Macro.tryHaveItem(itemOrSkill),
        );
      case $skill`Digitize`:
        return this.externalIf(
          SourceTerminal.canDigitize(),
          Macro.trySkill(itemOrSkill),
        );
    }

    // Unsupported item or skill
    return this;
  }

  static tryCopier(itemOrSkill: Item | Skill): Macro {
    return new Macro().tryCopier(itemOrSkill);
  }

  delevel(): Macro {
    return this.tryHaveSkill($skill`Curse of Weaksauce`)
      .externalIf(
        have($skill`Meteor Lore`),
        Macro.trySkill($skill`Micrometeorite`),
      )
      .tryHaveSkill($skill`Pocket Crumbs`)
      .tryHaveItem($item`train whistle`)
      .tryHaveSkill($skill`Entangling Noodles`)
      .tryHaveItem($item`little red book`)
      .tryHaveItem($item`Rain-Doh blue balls`)
      .tryHaveItem($item`Rain-Doh indigo cup`);
  }

  static delevel(): Macro {
    return new Macro().delevel();
  }

  meatKill(delevel = isStrongScaler(globalOptions.target)): Macro {
    const sealClubberSetup =
      myClass() === $class`Seal Clubber` && have($skill`Furious Wallop`);
    const opsSetup = equippedAmount($item`Operation Patriot Shield`) > 0;
    const katanaSetup = equippedAmount($item`haiku katana`) > 0;
    const capeSetup =
      get("retroCapeSuperhero") === "robot" &&
      get("retroCapeWashingInstructions") === "kill" &&
      itemType(equippedItem($slot`weapon`)) === "pistol";
    const pigSkinnerSetup = have($skill`Head in the Game`);
    const bearArmsSetup =
      equippedAmount($item`right bear arm`) > 0 &&
      equippedAmount($item`left bear arm`) > 0;

    const willCrit =
      (equippedAmount($item`mafia pointer finger ring`) > 0 ||
        equippedAmount($item`bindlestocking`) > 0) &&
      (sealClubberSetup ||
        opsSetup ||
        katanaSetup ||
        capeSetup ||
        pigSkinnerSetup ||
        bearArmsSetup);

    return this.externalIf(
      shouldRedigitize(),
      Macro.if_(globalOptions.target, Macro.trySkill($skill`Digitize`)),
    )
      .externalIf(delevel, Macro.if_(globalOptions.target, Macro.delevel()))
      .externalIf(
        have($skill`Blow the Purple Candle!`),
        Macro.if_(
          globalOptions.target,
          Macro.trySkill($skill`Blow the Purple Candle!`),
        ),
      )
      .trySingAlong()
      .familiarActions()
      .tryEgg()
      .tryDrone()
      .externalIf(
        have($skill`Extract Oil`) && get("_oilExtracted") < 15,
        Macro.if_(
          $monster`garbage tourist`,
          Macro.trySkill($skill`Extract Oil`),
        ),
      )
      .externalIf(
        digitizedMonstersRemaining() <= 5 - get("_meteorShowerUses") &&
          have($skill`Meteor Lore`) &&
          get("_meteorShowerUses") < 5,
        Macro.if_(globalOptions.target, Macro.trySkill($skill`Meteor Shower`)),
      )
      .externalIf(
        get("cosmicBowlingBallReturnCombats") < 1,
        Macro.trySkill($skill`Bowl Straight Up`),
      )
      .externalIf(
        have($skill`Transcendent Olfaction`) &&
          (get("olfactedMonster") !== $monster`garbage tourist` ||
            !have($effect`On the Trail`)) &&
          get("_olfactionsUsed") < 3,
        Macro.if_(
          $monster`garbage tourist`,
          Macro.trySkill($skill`Transcendent Olfaction`),
        ),
      )
      .externalIf(
        get("_gallapagosMonster") !== $monster`garbage tourist` &&
          have($skill`Gallapagosian Mating Call`),
        Macro.if_(
          $monster`garbage tourist`,
          Macro.trySkill($skill`Gallapagosian Mating Call`),
        ),
      )
      .externalIf(
        get("longConMonster") !== $monster`garbage tourist` &&
          get("_longConUsed") < 5 &&
          have($skill`Long Con`),
        Macro.if_($monster`garbage tourist`, Macro.trySkill($skill`Long Con`)),
      )
      .externalIf(
        get("motifMonster") !== $monster`garbage tourist` &&
          have($skill`Motif`) &&
          !have($effect`Everything Looks Blue`),
        Macro.if_($monster`garbage tourist`, Macro.trySkill($skill`Motif`)),
      )
      .externalIf(
        !get("_latteCopyUsed") &&
          (get("_latteMonster") !== $monster`garbage tourist` ||
            Counter.get("Latte Monster") > 30) &&
          have($item`latte lovers member's mug`),
        Macro.if_(
          $monster`garbage tourist`,
          Macro.trySkill($skill`Offer Latte to Opponent`),
        ),
      )
      .externalIf(
        get("_feelNostalgicUsed") < 3 &&
          get("lastCopyableMonster") === $monster`garbage tourist` &&
          have($skill`Feel Nostalgic`),
        Macro.if_(
          `!monsterid ${$monster`garbage tourist`.id}`,
          Macro.trySkill($skill`Feel Nostalgic`),
        ),
      )
      .externalIf(opsSetup, Macro.trySkill($skill`Throw Shield`))
      .meatStasis(willCrit)
      .externalIf(
        hippyStoneBroken() && monsterManuelAvailable(),
        Macro.if_(
          `(monsterid 1758 || monsterid 1759 || monsterid 1760) && monsterhpbelow ${Math.floor(
            (100 + numericModifier("Monster Level")) / 5,
          )}`,
          Macro.trySkill($skill`Feel Superior`),
        ),
      )
      .externalIf(sealClubberSetup, Macro.trySkill($skill`Furious Wallop`))
      .externalIf(opsSetup, Macro.attack())
      .externalIf(katanaSetup, Macro.trySkill($skill`Summer Siesta`))
      .externalIf(capeSetup, Macro.trySkill($skill`Precision Shot`))
      .externalIf(bearArmsSetup, Macro.trySkill($skill`Kodiak Moment`))
      .externalIf(pigSkinnerSetup, Macro.attack())
      .externalIf(
        myClass() === $class`Disco Bandit`,
        Macro.trySkill($skill`Disco Dance of Doom`)
          .trySkill($skill`Disco Dance II: Electric Boogaloo`)
          .trySkill($skill`Disco Dance 3: Back in the Habit`),
      )
      .externalIf(
        myClass() === $class`Cheese Wizard` && myFamiliar().experience < 400,
        Macro.trySkill($skill`Stilton Splatter`),
      )
      .kill();
  }

  static meatKill(): Macro {
    return new Macro().meatKill();
  }

  meatStasis(checkPassive: boolean): Macro {
    // We can't stasis without manuel's monsterhpabove if we want to crit
    if (checkPassive && !monsterManuelAvailable()) {
      return this;
    }

    const checkGet = (i: Item) =>
      have(i) && (itemAmount(i) > 0 || retrieveItem(i));
    const stasisItem =
      $items`facsimile dictionary, dictionary, seal tooth`.find(checkGet);
    const pinataCastsAvailable = Math.floor(CinchoDeMayo.currentCinch() / 5);
    const canPinata =
      CinchoDeMayo.have() &&
      pinataCastsAvailable > 0 &&
      monsterManuelAvailable();

    // We retrieve a seal tooth at the start of the day, so this is just to make sure nothing has gone awry.
    if (!stasisItem) {
      throw new Error("Acquire a seal tooth and run garbo again.");
    }

    // Construct the monster HP component of the stasis condition
    // Evaluate the passive damage
    const passiveDamage = maxPassiveDamage() + 5;
    // Are we aiming to crit? If so, we need to respect the passive damage
    // Also we need to respect our health total
    const hpCheck = checkPassive
      ? `!hppercentbelow 25 && monsterhpabove ${passiveDamage}`
      : "!hppercentbelow 25";
    // Same story but for the sixgun shot, which wants 40 more HP if possible
    const hpCheckSixgun = checkPassive
      ? `!hppercentbelow 25 && monsterhpabove ${passiveDamage + 40}`
      : "!hppercentbelow 25";
    // Same story but for Cincho's projectile pinata, which wants 50 more HP if possible
    const hpCheckCincho = checkPassive
      ? `!hppercentbelow 25 && monsterhpabove ${passiveDamage + 50}`
      : "!hppercentbelow 25";

    // Determine how long we'll be stasising for
    // By default there's no reason to stasis
    let stasisRounds = 0;
    if (
      [
        $familiar`Cocoabo`,
        $familiar`Feather Boa Constrictor`,
        $familiar`Ninja Pirate Zombie Robot`,
        $familiar`Stocking Mimic`,
      ].includes(myFamiliar())
    ) {
      // Cocoabo-likes drop meat for the first ten rounds of combat
      stasisRounds = 10;
    }
    if (
      myFamiliar() === $familiar`Hobo Monkey` ||
      myFamiliar() === $familiar`Jill-of-All-Trades` ||
      haveEquipped($item`Buddy Bjorn`) ||
      haveEquipped($item`Crown of Thrones`) ||
      get("_bittycar")
    ) {
      // These things can take a little longer to proc sometimes
      stasisRounds = 20;
    }

    if (isQuickCombat()) {
      // long fights can be very slow
      stasisRounds = Math.min(5, stasisRounds);
    }

    // Ignore unexpected monsters, holiday scaling monsters seem to abort with monsterhpabove
    // Delevel the sausage goblins as otherwise they can kind of hurt
    return this.if_(
      [
        ...getMonsters($location`Barf Mountain`),
        globalOptions.target,
        $monster`sausage goblin`,
      ],
      Macro.externalIf(
        have($item`Time-Spinner`),
        Macro.if_(
          `${hpCheck} && monstername sausage goblin`,
          Macro.tryHaveItem($item`Time-Spinner`),
        ),
      )
        .externalIf(
          have($skill`Meteor Lore`),
          Macro.if_(
            `${hpCheck} && monstername sausage goblin`,
            Macro.tryHaveSkill($skill`Micrometeorite`),
          ),
        )
        .externalIf(
          haveEquipped($item`Pantsgiving`),
          Macro.if_(`${hpCheck}`, Macro.trySkill($skill`Pocket Crumbs`)),
        )
        .externalIf(
          SourceTerminal.getSkills().includes($skill`Extract`),
          Macro.if_(`${hpCheck}`, Macro.trySkill($skill`Extract`)),
        )
        .externalIf(
          haveEquipped($item`vampyric cloake`) &&
            get("_vampyreCloakeFormUses") < 10,
          Macro.if_(`${hpCheck}`, Macro.tryHaveSkill($skill`Become a Wolf`)),
        )
        .externalIf(
          haveEquipped($item`Cincho de Mayo`) && canPinata,
          Macro.while_(
            `${hpCheckCincho} && ${Macro.makeBALLSPredicate(
              $skill`Cincho: Projectile Piñata`,
            )}`,
            Macro.trySkill($skill`Cincho: Projectile Piñata`),
          ),
        )
        .externalIf(
          have($item`porquoise-handled sixgun`),
          Macro.if_(
            `${hpCheckSixgun}`,
            Macro.tryItem($item`porquoise-handled sixgun`),
          ),
        )
        .while_(
          `${hpCheck} && !pastround ${stasisRounds}`,
          Macro.item(stasisItem),
        ),
    );
  }

  static meatStasis(checkPassive: boolean): Macro {
    return new Macro().meatStasis(checkPassive);
  }

  startCombat(): Macro {
    return this.trySingAlong()
      .tryHaveSkill($skill`Curse of Weaksauce`)
      .familiarActions()
      .externalIf(
        get("cosmicBowlingBallReturnCombats") < 1,
        Macro.trySkill($skill`Bowl Straight Up`),
      )
      .externalIf(
        haveEquipped($item`vampyric cloake`) &&
          get("_vampyreCloakeFormUses") < 10,
        Macro.tryHaveSkill($skill`Become a Wolf`),
      )
      .externalIf(
        haveEquipped($item`Pantsgiving`),
        Macro.trySkill($skill`Pocket Crumbs`),
      )
      .externalIf(
        SourceTerminal.getSkills().includes($skill`Extract`),
        Macro.trySkill($skill`Extract`),
      )
      .tryHaveItem($item`porquoise-handled sixgun`)
      .externalIf(
        have($skill`Meteor Lore`),
        Macro.trySkill($skill`Micrometeorite`),
      )
      .tryHaveItem($item`Time-Spinner`)
      .tryHaveItem($item`Rain-Doh indigo cup`)
      .tryHaveItem($item`Rain-Doh blue balls`)
      .externalIf(
        haveEquipped($item`Buddy Bjorn`) ||
          haveEquipped($item`Crown of Thrones`),
        Macro.while_(
          "!pastround 3 && !hppercentbelow 25",
          Macro.item($item`seal tooth`),
        ),
      )
      .externalIf(
        [
          $familiar`Cocoabo`,
          $familiar`Feather Boa Constrictor`,
          $familiar`Ninja Pirate Zombie Robot`,
          $familiar`Stocking Mimic`,
        ].some((familiar) => myFamiliar() === familiar),
        Macro.while_(
          "!pastround 10 && !hppercentbelow 25",
          Macro.item($item`seal tooth`),
        ),
      )
      .externalIf(
        myFamiliar() === $familiar`Hobo Monkey`,
        Macro.while_(
          `!match "shoulder, and hands you some Meat." && !pastround 5 && !hppercentbelow 25`,
          Macro.item($item`seal tooth`),
        ),
      );
  }

  static startCombat(): Macro {
    return new Macro().startCombat();
  }

  kill(): Macro {
    const riftId = toInt($location`Shadow Rift`);
    const doingYachtzee =
      globalOptions.prefs.yachtzeechain && !get("_garboYachtzeeChainCompleted");
    const canPinata =
      haveEquipped($item`Cincho de Mayo`) && CinchoDeMayo.currentCinch() >= 5;
    return this.externalIf(
      myClass() === $class`Sauceror` && have($skill`Curse of Weaksauce`),
      Macro.trySkill($skill`Curse of Weaksauce`),
    )
      .externalIf(
        !doingYachtzee && canPinata,
        Macro.while_(
          `${Macro.makeBALLSPredicate(
            $skill`Cincho: Projectile Piñata`,
          )} && !pastround 24 && !hppercentbelow 25`,
          Macro.trySkill($skill`Cincho: Projectile Piñata`),
        ),
      )
      .tryHaveSkill($skill`Become a Wolf`)
      .externalIf(
        !(myClass() === $class`Sauceror` && have($skill`Curse of Weaksauce`)),
        Macro.while_(
          `!pastround 24 && !hppercentbelow 25 && !missed 1 && !snarfblat ${riftId}`,
          Macro.attack(),
        ),
      )
      .externalIf(
        myBuffedstat($stat`Muscle`) > myBuffedstat($stat`Mysticality`) &&
          (currentHitStat() === $stat`Muscle` ||
            itemType(equippedItem($slot`weapon`)) === "knife"),

        Macro.ifNot(
          $element`Cold`,
          Macro.trySkillRepeat($skill`Northern Explosion`),
        ).trySkillRepeat(
          $skill`Lunging Thrust-Smack`,
          $skill`Saucegeyser`,
          $skill`Weapon of the Pastalord`,
          $skill`Cannelloni Cannon`,
          $skill`Wave of Sauce`,
          $skill`Saucestorm`,
        ),
        Macro.trySkillRepeat(
          $skill`Saucegeyser`,
          $skill`Weapon of the Pastalord`,
          $skill`Cannelloni Cannon`,
          $skill`Wave of Sauce`,
          $skill`Saucestorm`,
        )
          .ifNot(
            $element`Cold`,
            Macro.trySkillRepeat($skill`Northern Explosion`),
          )
          .trySkillRepeat($skill`Lunging Thrust-Smack`),
      )
      .attack()
      .repeat();
  }

  static kill(): Macro {
    return new Macro().kill();
  }

  basicCombat(): Macro {
    return this.startCombat().kill();
  }

  static basicCombat(): Macro {
    return new Macro().basicCombat();
  }

  ghostBustin(): Macro {
    // Only bust ghosts if you have enough stunners to prevent getting hit
    let stunRounds = 0;
    let classStun: Skill | null = null;
    let extraStun: Skill | null = null;
    if (have($item`Rain-Doh blue balls`)) stunRounds++;
    if (get("lovebugsUnlocked")) stunRounds++;
    if (
      myClass() === $class`Seal Clubber` &&
      have($skill`Club Foot`) &&
      myMp() >= mpCost($skill`Club Foot`)
    ) {
      const clubRounds =
        Math.min(myFury(), 3) +
        (itemType(equippedItem($slot`weapon`)) === "club" ? 1 : 0) -
        1;
      if (stunRounds > 0) {
        classStun = $skill`Club Foot`;
        stunRounds += clubRounds;
      }
    } else if (
      myClass() === $class`Turtle Tamer` &&
      have($skill`Shell Up`) &&
      myMp() >= mpCost($skill`Shell Up`)
    ) {
      const shellRounds =
        (have($effect`Blessing of the Storm Tortoise`) ? 2 : 0) +
        (have($effect`Grand Blessing of the Storm Tortoise`) ? 3 : 0) +
        (have($effect`Glorious Blessing of the Storm Tortoise`) ? 4 : 0);
      if (shellRounds > 0) {
        classStun = $skill`Shell Up`;
        stunRounds += shellRounds;
      }
    } else if (
      myClass() === $class`Pastamancer` &&
      have($skill`Entangling Noodles`) &&
      myMp() >= mpCost($skill`Entangling Noodles`)
    ) {
      classStun = $skill`Entangling Noodles`;
      stunRounds += 2;
    } else if (
      myClass() === $class`Sauceror` &&
      have($skill`Soul Bubble`) &&
      mySoulsauce() >= 5
    ) {
      classStun = $skill`Soul Bubble`;
      stunRounds += 2;
    } else if (
      myClass() === $class`Accordion Thief` &&
      have($skill`Accordion Bash`) &&
      itemType(equippedItem($slot`weapon`)) === "accordion" &&
      myMp() >= mpCost($skill`Accordion Bash`)
    ) {
      classStun = $skill`Accordion Bash`;
      stunRounds += 2;
    } else if (myClass() === $class`Disco Bandit`) {
      // Rave Knockout seems like a pain
    }

    // Don't use shadow noodles unless we really need it.
    if (
      stunRounds < 3 &&
      classStun !== $skill`Entangling Noodles` &&
      have($skill`Shadow Noodles`) &&
      myMp() >=
        mpCost(classStun ?? $skill.none) + mpCost($skill`Shadow Noodles`)
    ) {
      extraStun = $skill`Shadow Noodles`;
      stunRounds += 2;
    }

    // Lacking multi-round stuns
    if (stunRounds < 3) {
      return this.basicCombat();
    }

    return this.trySingAlong()
      .familiarActions()
      .tryHaveItem($item`Rain-Doh blue balls`)
      .externalIf(
        get("lovebugsUnlocked"),
        Macro.trySkill($skill`Summon Love Gnats`),
      )
      .tryHaveSkill(classStun)
      .tryHaveSkill(extraStun)
      .trySkill($skill`Shoot Ghost`)
      .trySkill($skill`Shoot Ghost`)
      .trySkill($skill`Shoot Ghost`)
      .trySkill($skill`Trap Ghost`)
      .kill();
  }

  static ghostBustin(): Macro {
    return new Macro().ghostBustin();
  }

  tryDrone(): Macro {
    return this.externalIf(
      myFamiliar() === $familiar`Grey Goose` &&
        gooseDroneEligible() &&
        get("gooseDronesRemaining") < copyTargetCount(),
      Macro.if_(
        globalOptions.target,
        Macro.trySkill($skill`Emit Matter Duplicating Drones`),
      ),
    );
  }

  static tryDrone(): Macro {
    return new Macro().tryDrone();
  }

  tryEgg(): Macro {
    return this.externalIf(
      myFamiliar() === $familiar`Chest Mimic` &&
        $familiar`Chest Mimic`.experience >= 50,
      Macro.if_(
        globalOptions.target,
        Macro.trySkillRepeat($skill`%fn, lay an egg`),
      ),
    );
  }

  static tryEgg(): Macro {
    return new Macro().tryEgg();
  }

  target(action: string): Macro {
    const doneHabitat =
      !have($skill`Just the Facts`) ||
      (get("_monsterHabitatsRecalled") === 3 &&
        get("_monsterHabitatsFightsLeft") <= 1);
    return this.if_(
      globalOptions.target,
      Macro.externalIf(isStrongScaler(globalOptions.target), Macro.delevel())
        .if_(
          $location`The Briny Deeps`,
          Macro.tryCopier($item`pulled green taffy`),
        )
        .externalIf(
          myFamiliar() === $familiar`Reanimated Reanimator`,
          Macro.trySkill($skill`Wink at`),
        )
        .externalIf(
          myFamiliar() === $familiar`Obtuse Angel`,
          Macro.trySkill($skill`Fire a badly romantic arrow`),
        )
        .tryEgg()
        .tryDrone()
        .externalIf(
          doneHabitat &&
            get("beGregariousCharges") > 0 &&
            (get("beGregariousMonster") !== globalOptions.target ||
            have($item`miniature crystal ball`)
              ? get("beGregariousFightsLeft") === 0
              : get("beGregariousFightsLeft") <= 1),
          Macro.trySkill($skill`Be Gregarious`),
        )
        .externalIf(
          have($skill`Just the Facts`) &&
            get("_monsterHabitatsRecalled") < 3 &&
            (get("_monsterHabitatsMonster") !== globalOptions.target ||
            have($item`miniature crystal ball`)
              ? get("_monsterHabitatsFightsLeft") === 0
              : get("_monsterHabitatsFightsLeft") <= 1),
          Macro.trySkill($skill`Recall Facts: Monster Habitats`),
        )
        .externalIf(
          have($skill`Recall Facts: %phylum Circadian Rhythms`) &&
            !get("_circadianRhythmsRecalled"),
          Macro.trySkill($skill`Recall Facts: %phylum Circadian Rhythms`),
        )
        .externalIf(
          SourceTerminal.getDigitizeMonster() !== globalOptions.target ||
            shouldRedigitize(),
          Macro.tryCopier($skill`Digitize`),
        )
        .tryCopier($item`Spooky Putty sheet`)
        .tryCopier($item`Rain-Doh black box`)
        .tryCopier($item`4-d camera`)
        .tryCopier($item`unfinished ice sculpture`)
        .externalIf(
          get("_enamorangs") === 0,
          Macro.tryCopier($item`LOV Enamorang`),
        )
        .meatKill(false),
    ).abortWithMsg(
      `Macro for ${action} expected ${globalOptions.target} but encountered something else.`,
    );
  }

  static target(action: string): Macro {
    return new Macro().target(action);
  }

  duplicate(): Macro {
    return this.externalIf(
      haveEquipped($item`pro skateboard`) && !get("_epicMcTwistUsed"),
      Macro.trySkill($skill`Do an epic McTwist!`),
    ).externalIf(
      SourceTerminal.have() && SourceTerminal.duplicateUsesRemaining() > 0,
      Macro.trySkill($skill`Duplicate`),
    );
  }

  static duplicate(): Macro {
    return new Macro().duplicate();
  }
}

type CustomizeMacroOptions = {
  freeWanderer: (macro: StrictMacro) => Macro;
  tentacle: (macro: StrictMacro) => Macro;
  innateWanderer: (macro: StrictMacro) => Macro;
};

function customizeMacro<M extends StrictMacro>(
  macro: M,
  {
    freeWanderer = () => Macro.basicCombat(),
    tentacle = () => Macro.basicCombat(),
    innateWanderer = (macro: StrictMacro) =>
      Macro.externalIf(
        haveEquipped($item`backup camera`) &&
          get("_backUpUses") < 11 &&
          get("lastCopyableMonster") === globalOptions.target &&
          (!targettingMeat() || myFamiliar() === meatFamiliar()),
        Macro.skill($skill`Back-Up to your Last Enemy`).step(macro),
        Macro.basicCombat(),
      ),
  } = {} as Partial<CustomizeMacroOptions>,
) {
  return Macro.if_(
    $monsters`giant rubber spider, time-spinner prank`,
    freeWanderer(macro),
  )
    .externalIf(
      have($effect`Eldritch Attunement`),
      Macro.if_($monster`Eldritch Tentacle`, tentacle(macro)),
    )
    .ifInnateWanderer(innateWanderer(macro))
    .step(macro);
}

function makeCcs<M extends StrictMacro>(macro: M) {
  writeCcs(`[default]\n"${customizeMacro(macro).toString()}"`, "garbo");
  setCcs("garbo");
}

function runCombatBy<T>(initiateCombatAction: () => T) {
  try {
    const result = initiateCombatAction();
    while (inMultiFight()) runCombat();
    if (choiceFollowsFight()) visitUrl("choice.php");
    return result;
  } catch (e) {
    throw `Combat exception! Last macro error: ${get(
      "lastMacroError",
    )}. Exception ${e}.`;
  }
}

/**
 * Attempt to perform a nonstandard combat-starting Action with a Macro
 * @param macro The Macro to attempt to use
 * @param action The combat-starting action to attempt
 * @param tryAuto Whether or not we should try to resolve the combat with an autoattack; autoattack macros can fail against special monsters, and thus we have to submit a macro via CCS regardless.
 * @returns The output of your specified action function (typically void)
 */
export function withMacro<T, M extends StrictMacro>(
  macro: M,
  action: () => T,
  tryAuto = false,
): T {
  if (getAutoAttack() !== 0) setAutoAttack(0);
  if (tryAuto) customizeMacro(macro).setAutoAttack();
  makeCcs(macro);
  try {
    return runCombatBy(action);
  } finally {
    if (tryAuto) setAutoAttack(0);
  }
}

/**
 * Adventure in a location and handle all combats with a given macro.
 *
 * @category Combat
 * @param loc Location to adventure in.
 * @param macro Macro to execute.
 */
export function garboAdventure<M extends StrictMacro>(
  loc: Location,
  macro: M,
): void {
  if (getAutoAttack() !== 0) setAutoAttack(0);
  makeCcs(macro);
  runCombatBy(() => adv1(loc, -1, ""));
}

/**
 * Adventure in a location and handle all combats with a given autoattack and manual macro.
 *
 * @category Combat
 * @param loc Location to adventure in.
 * @param autoMacro Macro to execute via KoL autoattack.
 * @param nextMacro Macro to execute manually after autoattack completes.
 */
export function garboAdventureAuto<M extends StrictMacro>(
  loc: Location,
  autoMacro: M,
  nextMacro = Macro.abort(),
): void {
  autoMacro.setAutoAttack();
  makeCcs(nextMacro);
  runCombatBy(() => adv1(loc, -1, ""));
}

export class GarboStrategy extends CombatStrategy {
  constructor(
    macro: () => Macro,
    postAuto = macro,
    useAutoAttack = () => true,
    options: Partial<CustomizeMacroOptions> = {},
  ) {
    super();
    const macroCustom = () => customizeMacro(macro(), options);
    if (useAutoAttack()) {
      const postAutoCustom = () => customizeMacro(postAuto(), options);
      this.autoattack(macroCustom).macro(postAutoCustom);
    } else {
      this.macro(macroCustom);
    }
  }
}
