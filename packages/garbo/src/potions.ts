import {
  adv1,
  autosellPrice,
  availableAmount,
  canAdventure,
  canEquip,
  cliExecute,
  Effect,
  effectModifier,
  equip,
  getMonsters,
  haveEffect,
  historicalAge,
  historicalPrice,
  inebrietyLimit,
  Item,
  itemAmount,
  itemDropsArray,
  itemType,
  Location,
  mallPrice,
  monkeyPaw,
  myInebriety,
  myTurncount,
  numericModifier,
  print,
  retrievePrice,
  setLocation,
  use,
} from "kolmafia";
import {
  $effect,
  $effects,
  $familiar,
  $item,
  $items,
  $location,
  $slot,
  clamp,
  ClosedCircuitPayphone,
  CursedMonkeyPaw,
  get,
  getActiveEffects,
  getActiveSongs,
  getModifier,
  have,
  isSong,
  maxBy,
  Mood,
  sum,
  sumNumbers,
  withChoice,
} from "libram";
import { acquire } from "./acquire";
import {
  aprilFoolsRufus,
  baseMeat,
  bestShadowRift,
  HIGHLIGHT,
  pillkeeperOpportunityCost,
  targetMeat,
  targetMeatDifferential,
  targettingMeat,
  turnsToNC,
  withLocation,
} from "./lib";
import { copyTargetCount } from "./target";
import { usingPurse } from "./outfit";
import { estimatedGarboTurns } from "./turns";
import { globalOptions } from "./config";
import { castAugustScepterBuffs } from "./resources";

export type PotionTier = "target" | "overlap" | "barf" | "ascending";
const banned = $items`Uncle Greenspan's Bathroom Finance Guide`;
export const failedWishes: Effect[] = [];

const mutuallyExclusiveList: Effect[][] = [
  $effects`Blue Tongue, Green Tongue, Orange Tongue, Purple Tongue, Red Tongue, Black Tongue`,
  $effects`Cupcake of Choice, The Cupcake of Wrath, Shiny Happy Cupcake, Your Cupcake Senses Are Tingling, Tiny Bubbles in the Cupcake`,
  $effects`Broken Heart, Fiery Heart, Cold Hearted, Sweet Heart, Withered Heart, Lustful Heart`,
  $effects`Coldform, Hotform, Sleazeform, Spookyform, Stenchform`,
];
export const mutuallyExclusive = new Map<Effect, Effect[]>();
for (const effectGroup of mutuallyExclusiveList) {
  for (const effect of effectGroup) {
    mutuallyExclusive.set(effect, [
      ...(mutuallyExclusive.get(effect) ?? []),
      ...effectGroup.filter((other) => other !== effect),
    ]);
  }
}

const INVALID_CHARS_REGEX = /[.',]/g;

const wishableEffects = Effect.all().filter(
  (e) => !e.attributes.includes("nohookah"),
);
const wishableEffectData = wishableEffects.map((e) => {
  const name = e.name.toLowerCase();
  const splitName = name.split(INVALID_CHARS_REGEX);
  return { e, name, splitName };
});

const invalidWishStrings = wishableEffectData
  .filter(({ name }) => name.match(INVALID_CHARS_REGEX))
  .filter(({ name, splitName }) =>
    splitName.every((s) =>
      wishableEffectData.some(
        (n) => n.name !== name && n.splitName.some((x) => x.includes(s)),
      ),
    ),
  )
  .map(({ name }) => name);

const availableItems = [
  ...new Set(
    Location.all()
      .filter((l) => canAdventure(l))
      .flatMap((l) =>
        getMonsters(l)
          .filter((m) => m.copyable)
          .flatMap((m) => itemDropsArray(m).filter(({ rate }) => rate > 1)),
      )
      .map(({ drop }) => drop),
  ),
].map((i) => i.name);

const validPawWishes: Map<Effect, string> = new Map(
  wishableEffectData
    .filter(
      ({ e, name }) =>
        !invalidWishStrings.includes(name) &&
        (globalOptions.prefs.yachtzeechain
          ? e !== $effect`Eau d' Clochard`
          : true), // hardcoded heuristics
    )
    .map(({ e, name, splitName }) => {
      if (!name.match(INVALID_CHARS_REGEX)) return [e, name];

      return [
        e,
        splitName.filter(
          (s) =>
            !availableItems.includes(s) &&
            !wishableEffectData.some(
              (n) => n.name !== name && n.splitName.some((x) => x.includes(s)),
            ),
        )[0],
      ];
    }),
);

function retrieveUntradeablePrice(it: Item) {
  return (
    retrievePrice(it, availableAmount(it) + 1) -
    autosellPrice(it) * availableAmount(it)
  );
}

export interface PotionOptions {
  providesDoubleDuration?: boolean;
  canDouble?: boolean;
  effect?: Effect;
  duration?: number;
  price?: (historical: boolean) => number;
  use?: (quantity: number) => boolean;
  acquire?: (
    qty: number,
    item: Item,
    maxPrice?: number | undefined,
    throwOnFail?: boolean,
    maxAggregateCost?: number | undefined,
    tryRetrievingUntradeable?: boolean,
  ) => number;
  effectValues?: Partial<{
    meatDrop: number;
    itemDrop: number;
    famWeight: number;
  }>;
}

export const VALUABLE_MODIFIERS = [
  "Meat Drop",
  "Familiar Weight",
  "Smithsness",
  "Item Drop",
] as const;

export class Potion {
  potion: Item;
  providesDoubleDuration?: boolean;
  canDouble: boolean;
  overrideEffect?: Effect;
  overrideDuration?: number;
  priceOverride?: (historical: boolean) => number;
  useOverride?: (quantity: number) => boolean;
  acquire: (
    qty: number,
    item: Item,
    maxPrice?: number | undefined,
    throwOnFail?: boolean,
    maxAggregateCost?: number | undefined,
    tryRetrievingUntradeable?: boolean,
  ) => number;
  effectValues?: Partial<{
    meatDrop: number;
    smithsness: number;
    famWeight: number;
  }>;

  constructor(potion: Item, options: PotionOptions = {}) {
    this.potion = potion;
    this.providesDoubleDuration = options.providesDoubleDuration;
    this.canDouble = options.canDouble ?? true;
    this.overrideDuration = options.duration;
    this.overrideEffect = options.effect;
    this.priceOverride = options.price;
    this.useOverride = options.use;
    this.acquire = options.acquire ?? acquire;
    this.effectValues = options.effectValues;
  }

  doubleDuration(): Potion {
    if (this.canDouble) {
      return new Potion(this.potion, {
        providesDoubleDuration: true,
        canDouble: this.canDouble,
        duration: this.overrideDuration,
        effect: this.overrideEffect,
        price: this.priceOverride,
        use: this.useOverride,
        acquire: this.acquire,
      });
    }
    return this;
  }

  effect(): Effect {
    return this.overrideEffect ?? effectModifier(this.potion, "Effect");
  }

  effectDuration(): number {
    return (
      (this.overrideDuration ?? getModifier("Effect Duration", this.potion)) *
      (this.providesDoubleDuration ? 2 : 1)
    );
  }

  smithsness(): number {
    return (
      this.effectValues?.smithsness ?? getModifier("Smithsness", this.effect())
    );
  }

  meatDrop(): number {
    return (
      this.effectValues?.meatDrop ??
      getModifier("Meat Drop", this.effect()) +
        2 * (usingPurse() ? this.smithsness() : 0)
    );
  }

  familiarWeight(): number {
    return (
      this.effectValues?.famWeight ??
      getModifier("Familiar Weight", this.effect())
    );
  }

  bonusMeat(): number {
    const familiarMultiplier = have($familiar`Robortender`)
      ? 2
      : have($familiar`Hobo Monkey`)
        ? 1.25
        : 1;

    // Assume base weight of 100 pounds. This is off but close enough.
    const assumedBaseWeight = 100;
    // Marginal value of familiar weight in % meat drop.
    const marginalValue =
      2 * familiarMultiplier +
      Math.sqrt(220 * familiarMultiplier) / (2 * Math.sqrt(assumedBaseWeight));

    return this.familiarWeight() * marginalValue + this.meatDrop();
  }

  static bonusMeat(item: Item): number {
    return new Potion(item).bonusMeat();
  }

  gross(targets: number, maxTurns?: number): number {
    const bonusMeat = this.bonusMeat();
    const duration = Math.max(this.effectDuration(), maxTurns ?? 0);
    // Number of meat targets this will actually be in effect for.
    const targetsApplied = Math.max(
      Math.min(duration, targets - haveEffect(this.effect())),
      0,
    );

    return (
      (bonusMeat / 100) *
      (baseMeat() * duration + targetMeatDifferential() * targetsApplied)
    );
  }

  static gross(item: Item, targets: number): number {
    return new Potion(item).gross(targets);
  }

  price(historical: boolean): number {
    if (this.priceOverride) return this.priceOverride(historical);
    // If asked for historical, and age < 14 days, use historical.
    // If potion is not tradeable, use retrievePrice instead
    return this.potion.tradeable
      ? historical && historicalAge(this.potion) < 14
        ? historicalPrice(this.potion)
        : mallPrice(this.potion)
      : retrieveUntradeablePrice(this.potion);
  }

  net(targets: number, historical = false): number {
    return this.gross(targets) - this.price(historical);
  }

  static net(item: Item, targets: number, historical = false): number {
    return new Potion(item).net(targets, historical);
  }

  doublingValue(targets: number, historical = false): number {
    return Math.min(
      Math.max(this.doubleDuration().net(targets, historical), 0) -
        Math.max(this.net(targets, historical), 0),
      this.price(true),
    );
  }

  static doublingValue(
    item: Item,
    targets: number,
    historical = false,
  ): number {
    return new Potion(item).doublingValue(targets, historical);
  }

  /**
   * Compute how many times to use this potion to cover the range of turns
   * @param turns the number of turns to cover
   * @param allowOverage whether or not to allow the potion to extend past this number of turns
   * @returns the number of uses required by this potion to cover thatrange
   */
  usesToCover(turns: number, allowOverage: boolean): number {
    if (allowOverage) {
      return Math.ceil(turns / this.effectDuration());
    } else {
      return Math.floor(turns / this.effectDuration());
    }
  }

  static usesToCover(item: Item, turns: number, allowOverage: boolean): number {
    return new Potion(item).usesToCover(turns, allowOverage);
  }

  /**
   * Compute how many fewer or more turns we are from the desired turn count based on the input usage
   * @param turns the number of turns to cover
   * @param uses the number of uses of hte potion
   * @returns negative number of the number of turns short, positive number of the number of extra turns
   */
  overage(turns: number, uses: number): number {
    return this.effectDuration() * uses - turns;
  }

  static overage(item: Item, turns: number, uses: number): number {
    return new Potion(item).overage(turns, uses);
  }

  /**
   * Compute up to 4 possible value thresholds for this potion based on the number of meat targets to fight at the start of the day
   * - using it to only cover meat targets
   * - using it to cover both barf and meat targets (this is max 1 use)
   * - using it to only cover barf
   * - using it to cover turns in barf and those that would be lost at the end of the day
   * @param targets The number of meat targets expected to be fought in a block at the start of the day
   * @returns
   */
  value(
    targets: number,
    turns?: number,
    limit?: number,
  ): { name: PotionTier; quantity: number; value: number }[] {
    const startingTurns = haveEffect(this.effect());
    const ascending = globalOptions.ascend;
    const totalTurns = turns ?? estimatedGarboTurns();
    const values: {
      name: PotionTier;
      quantity: number;
      value: number;
    }[] = [];
    const limitFunction = limit
      ? (quantity: number) =>
          clamp(limit - sum(values, ({ quantity }) => quantity), 0, quantity)
      : (quantity: number) => quantity;

    // compute the value of covering meat targets
    const targetTurns = Math.max(0, targets - startingTurns);
    const targetQuantity = this.usesToCover(targetTurns, false);
    const targetValue = targetQuantity ? this.gross(targets) : 0;

    values.push({
      name: "target",
      quantity: limitFunction(targetQuantity),
      value: targetValue,
    });

    // compute the number of meat targets missed before, and their value (along with barf unless nobarf)
    const overlapTargets = -this.overage(targetTurns, targetQuantity);

    if (overlapTargets > 0) {
      values.push({
        name: "overlap",
        quantity: limitFunction(1),
        value: this.gross(
          overlapTargets,
          globalOptions.nobarf ? overlapTargets : undefined,
        ),
      });
    }

    const targetCoverage =
      targetQuantity + (overlapTargets > 0 ? 1 : 0) * this.effectDuration();

    if (!globalOptions.nobarf) {
      // unless nobarf, compute the value of barf turns
      // if ascending, break those turns that are not fully covered by a potion into their own value
      const remainingTurns = Math.max(
        0,
        totalTurns - targetCoverage - startingTurns,
      );

      const barfQuantity = this.usesToCover(remainingTurns, !ascending);
      values.push({
        name: "barf",
        quantity: limitFunction(barfQuantity),
        value: this.gross(0),
      });

      if (ascending && this.overage(remainingTurns, barfQuantity) < 0) {
        const ascendingTurns = Math.max(
          0,
          remainingTurns - barfQuantity * this.effectDuration(),
        );
        values.push({
          name: "ascending",
          quantity: limitFunction(1),
          value: this.gross(0, ascendingTurns),
        });
      }
    }

    return values.filter((tier) => tier.quantity > 0);
  }

  private _use(quantity: number): boolean {
    if (this.useOverride) {
      return this.useOverride(quantity);
    } else if (itemType(this.potion) === "potion") {
      return use(quantity, this.potion);
    } else {
      // must provide an override for non potions, otherwise they won't use
      return false;
    }
  }

  use(quantity: number): boolean {
    const effectTurns = haveEffect(this.effect());
    const result = this._use(quantity);
    // If we tried wishing but failed, no longer try this wish in the future
    if (
      this.potion === $item`pocket wish` &&
      haveEffect(this.effect()) <= effectTurns
    ) {
      failedWishes.push(this.effect());
    }
    return result;
  }
}

function useAsValuable(
  potion: Potion,
  targets: number,
  targetsOnly: boolean,
): number {
  const value = potion.value(targets);
  const price = potion.price(false);
  const amountsAcquired = value.map((value) =>
    (!targetsOnly || value.name === "target") && value.value - price > 0
      ? potion.acquire(
          value.quantity,
          potion.potion,
          value.value,
          false,
          undefined,
          true,
        )
      : 0,
  );

  const total = sumNumbers(amountsAcquired);
  if (total > 0) {
    const effect = potion.effect();
    if (isSong(effect) && !have(effect)) {
      for (const song of getActiveSongs()) {
        const slot = Mood.defaultOptions.songSlots.find((slot) =>
          slot.includes(song),
        );
        if (!slot || slot.includes(effect)) {
          cliExecute(`shrug ${song}`);
        }
      }
    }
    print(`Using ${total} ${potion.potion.plural}`);
    potion.use(total);
  }
  return total;
}

export const rufusPotion = new Potion($item`closed-circuit pay phone`, {
  providesDoubleDuration: false,
  canDouble: false,
  effect: $effect`Shadow Waters`,
  duration: 30,
  price: (historical: boolean) => {
    if (!have($item`closed-circuit pay phone`)) return Infinity;

    const target = ClosedCircuitPayphone.rufusTarget();
    const haveItemQuest =
      get("rufusQuestType") === "items" && target instanceof Item;
    const haveArtifact =
      get("rufusQuestType") === "artifact" &&
      target instanceof Item &&
      have(target);

    // We will only buff up if we can complete the item quest
    if (
      !(
        !target ||
        haveItemQuest ||
        haveArtifact ||
        have($item`Rufus's shadow lodestone`)
      )
    ) {
      return Infinity;
    }

    // If we are overdrunk, we will need to be able to grab the NC (with a wineglass)
    if (
      myInebriety() > inebrietyLimit() &&
      (!have($item`Drunkula's wineglass`) ||
        !canEquip($item`Drunkula's wineglass`))
    ) {
      return Infinity;
    }

    // We consider the average price of the shadow items to not get gated behind an expensive one
    const shadowItems = $items`shadow brick, shadow ice, shadow sinew, shadow glass, shadow stick, shadow skin, shadow flame, shadow fluid, shadow sausage, shadow bread, shadow venom, shadow nectar`;
    const averagePrice =
      sum(shadowItems, (it) =>
        historical && historicalAge(it) < 14
          ? historicalPrice(it)
          : mallPrice(it),
      ) / shadowItems.length;

    return 3 * averagePrice;
  },
  acquire: (qty: number) => {
    if (myInebriety() > inebrietyLimit()) {
      equip($slot`weapon`, $item.none);
      equip($slot`off-hand`, $item`Drunkula's wineglass`);
    }
    for (let iteration = 0; iteration < qty; iteration++) {
      // Grab a lodestone if we don't have one
      if (!have($item`Rufus's shadow lodestone`)) {
        // If we currently have no quest, acquire one
        ClosedCircuitPayphone.chooseQuest(() => 3);
        aprilFoolsRufus();

        // If we need to acquire items, do so; then complete the quest
        const target = ClosedCircuitPayphone.rufusTarget() as Item;
        if (get("rufusQuestType") === "items") {
          if (acquire(3, target, 2 * mallPrice(target), false, 100000)) {
            withChoice(1498, 1, () => use($item`closed-circuit pay phone`));
          } else break;
        } else if (get("rufusQuestType") === "artifact") {
          if (have(target)) {
            withChoice(1498, 1, () => use($item`closed-circuit pay phone`));
          } else break;
        }
      }

      // Grab the buff from the NC
      const curTurncount = myTurncount();
      if (have($item`Rufus's shadow lodestone`)) {
        withChoice(1500, 2, () => adv1(bestShadowRift(), -1, ""));
      }
      if (myTurncount() > curTurncount) {
        throw new Error("Failed to acquire Shadow Waters and spent a turn!");
      }
    }
    setLocation($location.none); // Reset location to not affect mafia's item drop calculations
    return 0;
  },
  use: () => {
    return false;
  },
});

export const wishPotions = wishableEffects.map(
  (effect) =>
    new Potion($item`pocket wish`, {
      effect,
      canDouble: false,
      duration: 20,
      use: (quantity: number) => {
        for (let i = 0; i < quantity; i++) {
          const madeValidWish = cliExecute(`genie effect ${effect}`);
          if (!madeValidWish) return false;
        }
        return true;
      },
    }),
);

export const pawPotions = Array.from(validPawWishes.keys())
  .filter((effect) => numericModifier(effect, "Meat Drop") >= 100)
  .map(
    (effect) =>
      new Potion($item`cursed monkey's paw`, {
        effect,
        canDouble: false,
        price: () =>
          !CursedMonkeyPaw.have() ||
          CursedMonkeyPaw.wishes() === 0 ||
          failedWishes.includes(effect)
            ? 2 ** 100 // Something large but non-infinite for sorting reasons
            : 0,
        duration: 30,
        acquire: () => (CursedMonkeyPaw.wishes() ? 1 : 0),
        use: () => {
          if (
            !CursedMonkeyPaw.have() ||
            CursedMonkeyPaw.wishes() === 0 ||
            failedWishes.includes(effect)
          ) {
            return false;
          }

          if (!CursedMonkeyPaw.isWishable(effect)) return false;

          if (!monkeyPaw(effect)) {
            failedWishes.push(effect);
            return false;
          }
          return true;
        },
      }),
  );

export const farmingPotions = [
  ...Item.all()
    .filter(
      (item) =>
        item.tradeable && !banned.includes(item) && itemType(item) === "potion",
    )
    .map((item) => new Potion(item))
    .filter((potion) => potion.bonusMeat() > 0),
  ...wishPotions,
  new Potion($item`papier-mâché toothpicks`),
  ...(have($item`closed-circuit pay phone`) ? [rufusPotion] : []),
];

export function doublingPotions(targets: number): Potion[] {
  return farmingPotions
    .filter(
      (potion) =>
        potion.doubleDuration().gross(targets) / potion.price(true) > 0.5,
    )
    .map((potion) => {
      return { potion: potion, value: potion.doublingValue(targets) };
    })
    .sort((a, b) => b.value - a.value)
    .map((pair) => pair.potion);
}

export function usePawWishes(
  singleUseValuation: (potion: Potion) => number,
): void {
  while (CursedMonkeyPaw.wishes() > 0) {
    // Sort the paw potions by the profits of a single wish, then use the best one
    const madeValidWish = pawPotions
      .sort((a, b) => singleUseValuation(b) - singleUseValuation(a))
      .some((potion) => potion.use(1));
    if (!madeValidWish) return;
  }
}

let completedPotionSetup = false;
export function potionSetupCompleted(): boolean {
  return completedPotionSetup;
}
/**
 * Determines if potions are worth using by comparing against meat-equilibrium. Considers using pillkeeper to double them. Accounts for non-wanderer targets. Does not account for PYEC/LTC, or running out of turns with the ascend flag.
 * @param targetsOnly Are we valuing the potions only for meat targets (noBarf)?
 */
export function potionSetup(targetsOnly: boolean): void {
  castAugustScepterBuffs();
  // TODO: Count PYEC.
  // TODO: Count free fights (25 meat each for most).
  withLocation($location.none, () => {
    const targets = targettingMeat() ? copyTargetCount() : 0;

    if (
      have($item`Eight Days a Week Pill Keeper`) &&
      !get("_freePillKeeperUsed")
    ) {
      const possibleDoublingPotions = doublingPotions(targets);
      const bestPotion =
        possibleDoublingPotions.length > 0
          ? possibleDoublingPotions[0]
          : undefined;
      if (
        bestPotion &&
        bestPotion.doubleDuration().net(targets) > pillkeeperOpportunityCost()
      ) {
        print(
          `Determined that ${bestPotion.potion} was the best potion to double`,
          HIGHLIGHT,
        );
        cliExecute("pillkeeper extend");
        bestPotion.acquire(
          1,
          bestPotion.potion,
          bestPotion.doubleDuration().gross(targets),
        );
        bestPotion.use(1);
      }
    }

    // Only test potions which are reasonably close to being profitable using historical price.
    const testPotions = farmingPotions.filter(
      (potion) => potion.gross(targets) / potion.price(true) > 0.5,
    );
    const nonWishTestPotions = testPotions.filter(
      (potion) => potion.potion !== $item`pocket wish`,
    );
    nonWishTestPotions.sort((a, b) => b.net(targets) - a.net(targets));

    const excludedEffects = new Set<Effect>();
    for (const effect of getActiveEffects()) {
      for (const excluded of mutuallyExclusive.get(effect) ?? []) {
        excludedEffects.add(excluded);
      }
    }

    for (const potion of nonWishTestPotions) {
      const effect = potion.effect();
      if (
        !excludedEffects.has(effect) &&
        useAsValuable(potion, targets, targetsOnly) > 0
      ) {
        for (const excluded of mutuallyExclusive.get(effect) ?? []) {
          excludedEffects.add(excluded);
        }
      }
    }

    usePawWishes((potion) => {
      const value = potion.value(targets);
      return value.length > 0
        ? maxBy(value, ({ quantity, value }) => (quantity > 0 ? value : 0))
            .value
        : 0;
    });

    const wishTestPotions = testPotions.filter(
      (potion) => potion.potion === $item`pocket wish`,
    );
    wishTestPotions.sort((a, b) => b.net(targets) - a.net(targets));

    for (const potion of wishTestPotions) {
      const effect = potion.effect();
      if (
        !excludedEffects.has(effect) &&
        !failedWishes.includes(effect) &&
        useAsValuable(potion, targets, targetsOnly) > 0
      ) {
        for (const excluded of mutuallyExclusive.get(effect) ?? []) {
          excludedEffects.add(excluded);
        }
      }
    }

    variableMeatPotionsSetup(0, targets);
    completedPotionSetup = true;
  });
}

/**
 * Uses a Greenspan iff profitable; does not account for PYEC/LTC, or running out of adventures with the ascend flag.
 * @param targets Do we want to account for targets when calculating the value of bathroom finance?
 */
export function bathroomFinance(targets: number): void {
  if (have($effect`Buy!  Sell!  Buy!  Sell!`)) return;

  // Average meat % for targets is sum of arithmetic series, 2 * sum(1 -> targets)
  const averageTargetGross = (targetMeat() * 2 * (targets + 1)) / 2 / 100;
  const targetGross = averageTargetGross * targets;
  const tourists = 100 - targets;

  // Average meat % for tourists is sum of arithmetic series, 2 * sum(targets + 1 -> 100)
  const averageTouristGross = (baseMeat() * 2 * (100 + targets + 1)) / 2 / 100;
  const touristGross = averageTouristGross * tourists;

  const greenspan = $item`Uncle Greenspan's Bathroom Finance Guide`;
  if (touristGross + targetGross > mallPrice(greenspan)) {
    acquire(1, greenspan, touristGross + targetGross, false);
    if (itemAmount(greenspan) > 0) {
      print(`Using ${greenspan}!`, HIGHLIGHT);
      use(greenspan);
    }
  }
}

function triangleNumber(b: number, a = 0) {
  return 0.5 * (b * (b + 1) - a * (a + 1));
}

class VariableMeatPotion {
  potion: Item;
  effect: Effect;
  duration: number;
  softcap: number; // Number of turns to cap out variable bonus
  meatBonusPerTurn: number; // meat% bonus per turn
  cappedMeatBonus: number;

  constructor(
    potion: Item,
    softcap: number,
    meatBonusPerTurn: number,
    duration?: number,
    effect?: Effect,
  ) {
    this.potion = potion;
    this.effect = effect ?? effectModifier(potion, "Effect");
    this.duration = duration ?? numericModifier(potion, "Effect Duration");
    this.softcap = softcap;
    this.meatBonusPerTurn = meatBonusPerTurn;
    this.cappedMeatBonus = softcap * meatBonusPerTurn;
  }

  use(quantity: number): boolean {
    acquire(
      quantity,
      this.potion,
      (1.2 * retrievePrice(this.potion, quantity)) / quantity,
      false,
      2000000,
    );
    if (availableAmount(this.potion) < quantity) return false;
    return use(quantity, this.potion);
  }

  price(historical: boolean): number {
    // If asked for historical, and age < 14 days, use historical.
    // If potion is not tradeable, use retrievePrice instead
    return this.potion.tradeable
      ? historical && historicalAge(this.potion) < 14
        ? historicalPrice(this.potion)
        : mallPrice(this.potion)
      : retrieveUntradeablePrice(this.potion);
  }

  getOptimalNumberToUse(yachtzees: number, targets: number): number {
    const barfTurns = Math.max(0, estimatedGarboTurns() - yachtzees - targets);

    const potionAmountsToConsider: number[] = [];
    const considerSoftcap = [0, this.softcap];
    const considerTargets = targets > 0 ? [0, targets] : [0];
    for (const fn of [Math.floor, Math.ceil]) {
      for (const sc of considerSoftcap) {
        for (const em of considerTargets) {
          const considerBarfTurns =
            em === targets && barfTurns > 0 ? [0, barfTurns] : [0];
          for (const bt of considerBarfTurns) {
            const potionAmount = fn((yachtzees + em + bt + sc) / this.duration);
            if (!potionAmountsToConsider.includes(potionAmount)) {
              potionAmountsToConsider.push(potionAmount);
            }
          }
        }
      }
    }

    const profitsFromPotions = potionAmountsToConsider.map((quantity) => ({
      quantity,
      value: this.valueNPotions(quantity, yachtzees, targets, barfTurns),
    }));
    const bestOption = maxBy(profitsFromPotions, "value");

    if (bestOption.value > 0) {
      print(
        `Expected to profit ${bestOption.value.toFixed(2)} from ${
          bestOption.quantity
        } ${this.potion.plural}`,
        "blue",
      );
      const ascendingOverlap =
        globalOptions.ascend || globalOptions.nobarf
          ? 0
          : this.softcap / this.duration;
      const potionsToUse =
        bestOption.quantity +
        ascendingOverlap -
        Math.floor(haveEffect(this.effect) / this.duration);

      return Math.max(potionsToUse, 0);
    }
    return 0;
  }

  valueNPotions(
    n: number,
    yachtzees: number,
    targets: number,
    barfTurns: number,
  ): number {
    const yachtzeeValue = 2000;
    const targetValue = targetMeat();
    const barfValue = (baseMeat() * turnsToNC) / 30;

    const totalCosts = retrievePrice(this.potion, n);
    const totalDuration = n * this.duration;
    let cappedDuration = Math.max(0, totalDuration - this.softcap + 1);
    let decayDuration = Math.min(totalDuration, this.softcap - 1);
    let totalValue = 0;
    const turnTypes = [
      [yachtzees, yachtzeeValue],
      [targets, targetValue],
      [barfTurns, barfValue],
    ];

    for (const [turns, value] of turnTypes) {
      const cappedTurns = Math.min(cappedDuration, turns);
      const decayTurns = Math.min(decayDuration, turns - cappedTurns);
      totalValue +=
        (value *
          (cappedTurns * this.cappedMeatBonus +
            triangleNumber(decayDuration, decayDuration - decayTurns) *
              this.meatBonusPerTurn)) /
        100;
      cappedDuration -= cappedTurns;
      decayDuration -= decayTurns;
      if (decayDuration === 0) break;
    }

    return totalValue - totalCosts;
  }
}

export function variableMeatPotionsSetup(
  yachtzees: number,
  targets: number,
): void {
  const potions = [
    new VariableMeatPotion($item`love song of sugary cuteness`, 20, 2),
    new VariableMeatPotion($item`pulled yellow taffy`, 50, 2),
    ...(globalOptions.prefs.candydish
      ? [new VariableMeatPotion($item`porcelain candy dish`, 500, 1)]
      : []),
  ];

  const excludedEffects = new Set<Effect>();
  for (const effect of getActiveEffects()) {
    for (const excluded of mutuallyExclusive.get(effect) ?? []) {
      excludedEffects.add(excluded);
    }
  }

  for (const potion of potions) {
    const effect = effectModifier(potion.potion, "Effect");
    const n = excludedEffects.has(effect)
      ? 0
      : potion.getOptimalNumberToUse(yachtzees, targets);
    if (n > 0) {
      potion.use(n);
      for (const excluded of mutuallyExclusive.get(effect) ?? []) {
        excludedEffects.add(excluded);
      }
    }
  }
}
