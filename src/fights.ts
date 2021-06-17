import {
  abort,
  adv1,
  availableAmount,
  chatPrivate,
  cliExecute,
  eat,
  equip,
  faxbot,
  getCampground,
  getClanLounge,
  getCounters,
  handlingChoice,
  itemAmount,
  mallPrice,
  myAdventures,
  myAscensions,
  myClass,
  myHp,
  myMaxhp,
  myMaxmp,
  myMp,
  mySpleenUse,
  outfit,
  putCloset,
  restoreHp,
  restoreMp,
  retrieveItem,
  runChoice,
  runCombat,
  setAutoAttack,
  spleenLimit,
  use,
  useFamiliar,
  useSkill,
  visitUrl,
  wait,
} from "kolmafia";
import {
  $class,
  $effect,
  $familiar,
  $item,
  $items,
  $location,
  $monster,
  $monsters,
  $skill,
  $slot,
  adventureMacro,
  adventureMacroAuto,
  ChateauMantegna,
  get,
  have,
  maximizeCached,
  set,
  SourceTerminal,
  TunnelOfLove,
  Witchess,
} from "libram";
import { Macro, withMacro } from "./combat";
import { freeFightFamiliar, meatFamiliar } from "./familiar";
import { clamp, ensureEffect, mapMonster, questStep, setChoice } from "./lib";
import { freeFightMood, meatMood } from "./mood";
import { freeFightOutfit, meatOutfit, Requirement } from "./outfit";
import { withStash } from "./stash";

function checkFax(): boolean {
  cliExecute("fax receive");
  if (get("photocopyMonster") === $monster`Knob Goblin Embezzler`) return true;
  cliExecute("fax send");
  return false;
}

function faxEmbezzler(): void {
  if (!get("_photocopyUsed")) {
    if (checkFax()) return;
    chatPrivate("cheesefax", "Knob Goblin Embezzler");
    for (let i = 0; i < 3; i++) {
      wait(10);
      if (checkFax()) return;
    }
    abort("Failed to acquire photocopied Knob Goblin Embezzler.");
  }
}

export function dailyFights() {
  meatMood(true).execute(myAdventures() * 1.04 + 50);
  safeRestore();
  if (have($item`Clan VIP Lounge key`)) {
    const embezzler = $monster`Knob Goblin embezzler`;
    if (
      (!have($item`photocopied monster`) || get("photocopyMonster") !== embezzler) &&
      !get("_photocopyUsed")
    ) {
      faxEmbezzler();
    }

    if (getClanLounge()["Clan pool table"] !== undefined) {
      while (get("_poolGames") < 3) cliExecute("pool aggressive");
    }
    if (!get<boolean>("_garbo_professorLecturesUsed", false) || get("spookyPuttyCopiesMade") < 5) {
      withStash($items`Spooky Putty sheet`, () => {
        if (
          have($familiar`Pocket Professor`) &&
          !get<boolean>("_garbo_professorLecturesUsed", false)
        ) {
          ensureEffect($effect`Peppermint Twisted`);
          if (mySpleenUse() < spleenLimit()) ensureEffect($effect`Eau d' Clochard`);
          if (mySpleenUse() < spleenLimit() && have($item`body spradium`)) {
            ensureEffect($effect`Boxing Day Glow`);
          }

          // First round of prof copies with meat drop gear on.
          if (!get("_photocopyUsed")) {
            freeFightMood().execute(30);
            withStash($items`Platinum Yendorian Express Card`, () => {
              if (have($item`Platinum Yendorian Express Card`)) {
                use($item`Platinum Yendorian Express Card`);
              }
            });
            if (have($item`license to chill`) && !get("_licenseToChillUsed"))
              use($item`license to chill`);

            if (SourceTerminal.have()) SourceTerminal.educate([$skill`Extract`, $skill`Digitize`]);

            if (!get("_cameraUsed") && !have($item`shaking 4-d camera`)) {
              retrieveItem($item`4-d camera`);
            }
            useFamiliar($familiar`Pocket Professor`);
            meatOutfit(true);
            withMacro(
              Macro.if_(
                "!hasskill Lecture on Relativity",
                Macro.trySkill("Digitize").externalIf(
                  !get("_cameraUsed") && !have($item`shaking 4-d camera`),
                  Macro.tryItem("4-d camera")
                )
              )
                .trySkill("Lecture on Relativity")
                .meatKill(),
              () => use($item`photocopied monster`)
            );
          }

          if (
            getCounters("Digitize Monster", 0, 100).trim() === "" &&
            get("_mushroomGardenFights") === 0
          ) {
            if (have($item`packet of mushroom spores`)) use($item`packet of mushroom spores`);
            // adventure in mushroom garden to start digitize timer.
            freeFightOutfit();
            useFamiliar(meatFamiliar());
            adventureMacro($location`Your Mushroom Garden`, Macro.meatKill());
          }

          // Second round of prof copies with familiar weight on.
          freeFightMood().execute(20);
          useFamiliar($familiar`Pocket Professor`);
          maximizeCached(["Familiar Weight"], { forceEquip: $items`Pocket Professor memory chip` });
          withMacro(
            Macro.if_("!hasskill Lecture on Relativity", Macro.trySkill("Meteor Shower"))
              .trySkill("Lecture on Relativity")
              .tryItem($item`Spooky Putty sheet`)
              .meatKill(),
            () => use($item`shaking 4-d camera`)
          );
          set("_garbo_professorLecturesUsed", true);
        } else if (!get("_photocopyUsed")) {
          withMacro(Macro.tryItem($item`Spooky Putty sheet`).meatKill(), () => {
            use($item`photocopied monster`);
          });
          set("_garbo_professorLecturesUsed", true);
        }

        let puttyCount = 1;
        while (availableAmount($item`Spooky Putty monster`) > 0 && puttyCount <= 5) {
          useFamiliar(meatFamiliar());
          meatOutfit(true);
          withMacro(
            Macro.externalIf(
              get("spookyPuttyCopiesMade") < 5 && puttyCount < 5,
              Macro.item($item`Spooky Putty sheet`)
            ).meatKill(),
            () => use($item`Spooky Putty monster`)
          );
          puttyCount++;
        }
        set("spookyPuttyCopiesMade", 5);
      });
    }
  }
}

type FreeFightOptions = {
  cost?: () => number;
  familiar?: () => Familiar | null;
  requirements?: () => Requirement[];
};

class FreeFight {
  available: () => number | boolean;
  run: () => void;
  options: FreeFightOptions;

  constructor(available: () => number | boolean, run: () => void, options: FreeFightOptions = {}) {
    this.available = available;
    this.run = run;
    this.options = options;
  }

  runAll() {
    if (!this.available()) return;
    // FIXME: make a better decision here.
    if ((this.options.cost ? this.options.cost() : 0) > 2000) return;
    while (this.available()) {
      useFamiliar(
        this.options.familiar ? this.options.familiar() ?? freeFightFamiliar() : freeFightFamiliar()
      );
      freeFightMood().execute();
      freeFightOutfit(this.options.requirements ? this.options.requirements() : []);
      safeRestore();
      withMacro(Macro.meatKill(), this.run);

      // Slot in our Professor Thesis if it's become available
      if (thesisReady()) deliverThesis();
    }
  }
}

const pygmyMacro = Macro.if_(
  "monstername pygmy bowler",
  Macro.trySkill("Snokebomb").item($item`Louder than Bomb`)
)
  .if_(
    "monstername pygmy orderlies",
    Macro.trySkill("Feel Hatred").item($item`divine champagne popper`)
  )
  .if_("monstername pygmy janitor", Macro.item($item`tennis ball`))
  .abort();

const freeFightSources = [
  // Get a Fish Head from our robortender if available
  new FreeFight(
    () =>
      have($item`Cargo Cultist Shorts`) &&
      have($familiar`Robortender`) &&
      !get("_cargoPocketEmptied") &&
      String(get("cargoPocketsEmptied", "")).indexOf("428") === -1,
    () => cliExecute("cargo monster Mob Penguin Thug"),
    {
      familiar: () => $familiar`Robortender`,
    }
  ),

  new FreeFight(
    () => TunnelOfLove.have() && !TunnelOfLove.isUsed(),
    () => {
      TunnelOfLove.fightAll(
        "LOV Epaulettes",
        "Open Heart Surgery",
        "LOV Extraterrestrial Chocolate"
      );

      visitUrl("choice.php");
      if (handlingChoice()) throw "Did not get all the way through LOV.";
    }
  ),

  new FreeFight(
    () =>
      ChateauMantegna.have() &&
      !ChateauMantegna.paintingFought() &&
      (ChateauMantegna.paintingMonster()?.attributes?.includes("FREE") ?? false),
    () => ChateauMantegna.fightPainting()
  ),

  new FreeFight(
    () => get("questL02Larva") !== "unstarted" && !get("_eldritchTentacleFought"),
    () => {
      const haveEldritchEssence = have($item`eldritch essence`);
      visitUrl("place.php?whichplace=forestvillage&action=fv_scientist", false);
      if (!handlingChoice()) throw "No choice?";
      runChoice(haveEldritchEssence ? 2 : 1);
    }
  ),

  new FreeFight(
    () => have($skill`Evoke Eldritch Horror`) && !get("_eldritchHorrorEvoked"),
    () => useSkill($skill`Evoke Eldritch Horror`)
  ),

  new FreeFight(
    () => clamp(3 - get("_lynyrdSnareUses"), 0, 3),
    () => use($item`lynyrd snare`),
    {
      cost: () => mallPrice($item`lynyrd snare`),
    }
  ),

  new FreeFight(
    () => have($item`[glitch season reward name]`) && !get("_glitchMonsterFights"),
    () => {
      visitUrl("inv_eat.php?pwd&whichitem=10207");
      runCombat();
    }
  ),

  // 6	10	0	0	Infernal Seals	variety of items; must be Seal Clubber for 5, must also have Claw of the Infernal Seal in inventory for 10.
  new FreeFight(
    () => {
      const maxSeals = have($item`Claw of the Infernal Seal`) ? 10 : 5;
      const maxSealsAvailable =
        get("lastGuildStoreOpen") === myAscensions()
          ? maxSeals
          : Math.min(maxSeals, availableAmount($item`seal-blubber candle`));
      return myClass() === $class`Seal Clubber`
        ? Math.max(maxSealsAvailable - get("_sealsSummoned"), 0)
        : 0;
    },
    () => {
      const figurine =
        get("lastGuildStoreOpen") === myAscensions()
          ? $item`figurine of a wretched-looking seal`
          : $item`figurine of an ancient seal`;
      retrieveItem(1, figurine);
      retrieveItem(1, $item`seal-blubber candle`);
      use(figurine);
    },
    {
      requirements: () => [new Requirement(["Club"], {})],
    }
  ),

  new FreeFight(
    () => clamp(10 - get("_brickoFights"), 0, 10),
    () => use($item`BRICKO ooze`),
    {
      cost: () => mallPrice($item`BRICKO eye brick`) + 2 * mallPrice($item`BRICKO brick`),
    }
  ),

  //Initial 9 Pygmy fights
  new FreeFight(
    () =>
      get("questL11Worship") !== "unstarted" ? clamp(9 - get("_drunkPygmyBanishes"), 0, 9) : 0,
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem(clamp(9 - get("_drunkPygmyBanishes"), 0, 9), $item`Bowl of Scorpions`);
      retrieveItem($item`Louder than Bomb`);
      retrieveItem($item`tennis ball`);
      retrieveItem($item`divine champagne popper`);
      adventureMacro($location`The Hidden Bowling Alley`, pygmyMacro);
    }
  ),

  //10th Pygmy fight. If we have an orb, equip it for this fight, to save for later
  new FreeFight(
    () => get("questL11Worship") !== "unstarted" && get("_drunkPygmyBanishes") === 9,
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem($item`Bowl of Scorpions`);
      adventureMacro($location`The Hidden Bowling Alley`, pygmyMacro);
    },
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: $items`miniature crystal ball`.filter((item) => have(item)),
        }),
      ],
    }
  ),

  //11th pygmy fight if we lack a saber
  new FreeFight(
    () =>
      get("questL11Worship") !== "unstarted" &&
      get("_drunkPygmyBanishes") === 10 &&
      !have($item`Fourth of May Cosplay Saber`),
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem($item`Bowl of Scorpions`);
      adventureMacro($location`The Hidden Bowling Alley`, pygmyMacro);
    }
  ),

  //11th+ pygmy fight if we have a saber- saber friends
  new FreeFight(
    () => {
      const rightTime =
        have($item`Fourth of May Cosplay Saber`) && get("_drunkPygmyBanishes") >= 10;
      const saberedMonster = get("_saberForceMonster");
      const wrongPygmySabered =
        saberedMonster &&
        $monsters`pygmy orderlies, pygmy bowler, pygmy janitor`.includes(saberedMonster);
      const drunksCanAppear =
        get("_drunkPygmyBanishes") == 10 ||
        (saberedMonster === $monster`drunk pygmy` && get("_saberForceMonsterCount"));
      const remainingSaberPygmies =
        (saberedMonster === $monster`drunk pygmy` ? get("_saberForceMonsterCount") : 0) +
        2 * clamp(5 - get("_saberForceUses"), 0, 5);
      return (
        get("questL11Worship") !== "unstarted" &&
        rightTime &&
        !wrongPygmySabered &&
        drunksCanAppear &&
        remainingSaberPygmies
      );
    },
    () => {
      if (
        (get("_saberForceMonster") !== $monster`drunk pygmy` ||
          get("_saberForceMonsterCount") === 1) &&
        get("_saberForceUses") < 5
      ) {
        setChoice(1387, 2);
        putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
        putCloset(itemAmount($item`Bowl of Scorpions`), $item`Bowl of Scorpions`);
        adventureMacro($location`The Hidden Bowling Alley`, Macro.skill("Use the Force"));
      } else {
        retrieveItem($item`Bowl of Scorpions`);
        adventureMacro($location`The Hidden Bowling Alley`, pygmyMacro);
      }
    },
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: $items`Fourth of May Cosplay Saber`,
        }),
      ],
    }
  ),

  //Finally, saber or not, if we have a drunk pygmy in our crystal ball, let it out.
  new FreeFight(
    () =>
      get("questL11Worship") !== "unstarted" &&
      get("crystalBallMonster") === $monster`drunk pygmy` &&
      get("_drunkPygmyBanishes") >= 11,
    () => {
      putCloset(itemAmount($item`bowling ball`), $item`bowling ball`);
      retrieveItem(1, $item`Bowl of Scorpions`);
      adventureMacro($location`The Hidden Bowling Alley`, Macro.abort());
    },
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: $items`miniature crystal ball`.filter((item) => have(item)),
        }),
      ],
    }
  ),

  new FreeFight(
    () => get("_sausageFights") === 0 && have($item`Kramco Sausage-o-Matic™`),
    () => adv1($location`Noob Cave`, -1, ""),
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: $items`Kramco Sausage-o-Matic™`,
        }),
      ],
    }
  ),

  new FreeFight(
    () => (get("questL11Ron") === "finished" ? 5 - get("_glarkCableUses") : 0),
    () => {
      retrieveItem(5 - get("_glarkCableUses"), $item`glark cable`);
      adventureMacro($location`The Red Zeppelin`, Macro.item($item`glark cable`));
    }
  ),

  // Mushroom garden
  new FreeFight(
    () =>
      (have($item`packet of mushroom spores`) ||
        getCampground()["packet of mushroom spores"] !== undefined) &&
      get("_mushroomGardenFights") === 0,
    () => {
      if (have($item`packet of mushroom spores`)) use($item`packet of mushroom spores`);
      if (SourceTerminal.have()) {
        SourceTerminal.educate([$skill`Extract`, $skill`Portscan`]);
      }
      adventureMacro($location`Your Mushroom Garden`, Macro.trySkill("Portscan").meatKill());
      if (have($item`Packet of tall grass seeds`)) use($item`Packet of tall grass seeds`);
    },
    {
      familiar: () => (have($familiar`Robortender`) ? $familiar`Robortender` : null),
    }
  ),

  // Portscan and mushroom garden
  new FreeFight(
    () =>
      (have($item`packet of mushroom spores`) ||
        getCampground()["packet of mushroom spores"] !== undefined) &&
      getCounters("portscan.edu", 0, 0) === "portscan.edu" &&
      have($skill`Macrometeorite`) &&
      get("_macrometeoriteUses") < 10,
    () => {
      if (have($item`packet of mushroom spores`)) use($item`packet of mushroom spores`);
      if (SourceTerminal.have()) {
        SourceTerminal.educate([$skill`Extract`, $skill`Portscan`]);
      }
      adventureMacro(
        $location`Your Mushroom Garden`,
        Macro.if_("monstername government agent", Macro.skill("Macrometeorite")).if_(
          "monstername piranha plant",
          Macro.trySkill("Portscan").meatKill()
        )
      );
    }
  ),

  new FreeFight(
    () => (have($familiar`God Lobster`) ? clamp(3 - get("_godLobsterFights"), 0, 3) : 0),
    () => {
      setChoice(1310, 3);
      visitUrl("main.php?fightgodlobster=1");
      runCombat();
      visitUrl("choice.php");
      if (handlingChoice()) runChoice(3);
    },
    {
      familiar: () => $familiar`God Lobster`,
    }
  ),

  new FreeFight(
    () => (have($familiar`Machine Elf`) ? clamp(5 - get("_machineTunnelsAdv"), 0, 5) : 0),
    () => {
      setChoice(1119, 6);
      adv1($location`The Deep Machine Tunnels`, -1, "");
    },
    {
      familiar: () => $familiar`Machine Elf`,
    }
  ),

  // 28	5	0	0	Witchess pieces	must have a Witchess Set; can copy for more
  new FreeFight(
    () => (Witchess.have() ? clamp(5 - Witchess.fightsDone(), 0, 5) : 0),
    () => Witchess.fightPiece($monster`Witchess Bishop`)
  ),

  new FreeFight(
    () => get("snojoAvailable") && clamp(10 - get("_snojoFreeFights"), 0, 10),
    () => {
      if (get("snojoSetting", "NONE") === "NONE") {
        visitUrl("place.php?whichplace=snojo&action=snojo_controller");
        runChoice(3);
      }
      adv1($location`The X-32-F Combat Training Snowman`, -1, "");
    }
  ),

  new FreeFight(
    () =>
      get("neverendingPartyAlways") && questStep("_questPartyFair") < 999
        ? clamp(10 - get("_neverendingPartyFreeTurns"), 0, 10)
        : 0,
    () => {
      // FIXME: Check quest if Gerald(ine).
      setChoice(1322, 2); // reject quest.
      setChoice(1324, 5); // pick fight.
      if (get("_questPartyFair") === "unstarted") adv1($location`The Neverending Party`, -1, "");
      adventureMacro($location`The Neverending Party`, Macro.trySkill("Feel Pride").meatKill());
    },
    {
      requirements: () => [
        new Requirement([], {
          forceEquip: have($item`January's Garbage Tote`) ? $items`makeshift garbage shirt` : [],
        }),
      ],
    }
  ),
];

const freeKillSources = [
  new FreeFight(
    () => !get("_gingerbreadMobHitUsed") && have($skill`Gingerbread Mob Hit`),
    () =>
      withMacro(Macro.skill("Sing Along").trySkill("Gingerbread Mob Hit"), () =>
        use($item`drum machine`)
      ),
    {
      familiar: () =>
        have($familiar`Trick-or-Treating Tot`) ? $familiar`Trick-or-Treating Tot` : null,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),

  new FreeFight(
    () => (have($skill`Shattering Punch`) ? clamp(3 - get("_shatteringPunchUsed"), 0, 3) : 0),
    () =>
      withMacro(Macro.skill("Sing Along").trySkill("Shattering Punch"), () =>
        use($item`drum machine`)
      ),
    {
      familiar: () =>
        have($familiar`Trick-or-Treating Tot`) ? $familiar`Trick-or-Treating Tot` : null,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),

  // Use the jokester's gun even if we don't have tot
  new FreeFight(
    () => !get("_firedJokestersGun") && have($item`The Jokester's gun`),
    () =>
      withMacro(Macro.skill("Sing Along").trySkill("Fire the Jokester's Gun"), () =>
        use($item`drum machine`)
      ),
    {
      familiar: () =>
        have($familiar`Trick-or-Treating Tot`) ? $familiar`Trick-or-Treating Tot` : null,
      requirements: () => [
        new Requirement(["100 Item Drop"], { forceEquip: $items`The Jokester's Gun` }),
      ],
    }
  ),

  // 22	3	0	0	Chest X-Ray	combat skill	must have a Lil' Doctor™ bag equipped
  new FreeFight(
    () => (have($item`Lil' Doctor™ bag`) ? clamp(3 - get("_chestXRayUsed"), 0, 3) : 0),
    () =>
      withMacro(Macro.skill("Sing Along").trySkill("Chest X-Ray"), () => use($item`drum machine`)),
    {
      familiar: () =>
        have($familiar`Trick-or-Treating Tot`) ? $familiar`Trick-or-Treating Tot` : null,
      requirements: () => [
        new Requirement(["100 Item Drop"], { forceEquip: $items`Lil' Doctor™ bag` }),
      ],
    }
  ),

  new FreeFight(
    () => (have($item`replica bat-oomerang`) ? clamp(3 - get("_usedReplicaBatoomerang"), 0, 3) : 0),
    () =>
      withMacro(Macro.skill("Sing Along").item("replica bat-oomerang"), () =>
        use($item`drum machine`)
      ),
    {
      familiar: () =>
        have($familiar`Trick-or-Treating Tot`) ? $familiar`Trick-or-Treating Tot` : null,
      requirements: () => [new Requirement(["100 Item Drop"], {})],
    }
  ),
];

export function freeFights() {
  visitUrl("place.php?whichplace=town_wrong");
  for (const freeFightSource of freeFightSources) {
    freeFightSource.runAll();
  }

  if (
    !have($item`li'l ninja costume`) &&
    have($familiar`Trick-or-Treating Tot`) &&
    !get("_firedJokestersGun") &&
    have($item`The Jokester's gun`)
  ) {
    freeFightMood().execute();
    freeFightOutfit([new Requirement([], { forceEquip: $items`The Jokester's gun` })]);
    useFamiliar(freeFightFamiliar());
    freeFightMood().execute();
    freeFightOutfit([new Requirement([], { forceEquip: $items`The Jokester's gun` })]);
    if (questStep("questL08Trapper") >= 2) {
      adventureMacroAuto(
        $location`Lair of the Ninja Snowmen`,
        Macro.skill("Sing Along").skill("Fire the Jokester's Gun")
      );
    } else if (have($skill`Comprehensive Cartography`) && get("_monstersMapped") < 3) {
      try {
        Macro.skill("Sing Along").skill("Fire the Jokester's Gun").setAutoAttack();
        mapMonster($location`The Haiku Dungeon`, $monster`amateur ninja`);
      } finally {
        setAutoAttack(0);
      }
    }
  }

  try {
    for (const freeKillSource of freeKillSources) {
      if (freeKillSource.available()) {
        ensureEffect($effect`Feeling Lost`);
        if (have($skill`Steely-Eyed Squint`) && !get("_steelyEyedSquintUsed")) {
          useSkill($skill`Steely-Eyed Squint`);
        }
      }

      freeKillSource.runAll();
    }
  } finally {
    cliExecute("uneffect Feeling Lost");
  }
}

function thesisReady(): boolean {
  return (
    !get("_thesisDelivered") &&
    have($familiar`Pocket Professor`) &&
    $familiar`Pocket Professor`.experience >= 400
  );
}

function deliverThesis(): void {
  const thesisInNEP =
    get("neverendingPartyAlways") &&
    get("_neverendingPartyFreeTurns") < 10 &&
    questStep("_questPartyFair") < 999;

  //Set up NEP if we haven't yet
  if (thesisInNEP) {
    setChoice(1322, 2); // reject quest.
    setChoice(1324, 5); // pick fight.
    if (get("_questPartyFair") === "unstarted") adv1($location`The Neverending Party`, -1, "");
  }

  useFamiliar($familiar`Pocket Professor`);
  freeFightMood().execute();
  freeFightOutfit([new Requirement(["100 muscle"], {})]);
  safeRestore();

  if (
    have($item`Powerful Glove`) &&
    !have($effect`Triple-Sized`) &&
    get("_powerfulGloveBatteryPowerUsed") <= 95
  ) {
    cliExecute("checkpoint");
    equip($slot`acc1`, $item`Powerful Glove`);
    ensureEffect($effect`Triple-Sized`);
    outfit("checkpoint");
  }
  cliExecute("gain 1800 muscle");
  adventureMacro(
    thesisInNEP
      ? $location`The Neverending Party`
      : $location`Uncle Gator's Country Fun-Time Liquid Waste Sluice`,
    Macro.skill("Deliver your Thesis")
  );
}

export function safeRestore(): void {
  if (myHp() < myMaxhp() * 0.5) {
    restoreHp(myMaxhp() * 0.9);
  }
  if (myMp() < 50 && myMaxmp() > 50) {
    if (
      (have($item`magical sausage`) || have($item`sausage casing`)) &&
      get<number>("_sausagesEaten") < 23
    ) {
      eat($item`magical sausage`);
    }
    restoreMp(50);
  }
}
