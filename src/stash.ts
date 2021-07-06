import {
  availableAmount,
  cliExecute,
  getClanId,
  getClanName,
  print,
  putStash,
  retrieveItem,
  takeStash,
  userConfirm,
} from "kolmafia";
import { Clan, get, getFoldGroup, have, set } from "libram";

export function withStash<T>(itemsToTake: Item[], action: () => T) {
  const manager = new StashManager();
  try {
    manager.take(...itemsToTake);
    return action();
  } finally {
    manager.putBackAll();
  }
}

function withClan<T>(clanIdOrName: string | number, action: () => T) {
  const startingClanId = getClanId();
  Clan.join(clanIdOrName);
  try {
    return action();
  } finally {
    Clan.join(startingClanId);
  }
}

export class StashManager {
  clanIdOrName: string | number;
  taken = new Map<Item, number>();

  constructor(clanIdOrName?: string | number) {
    if (clanIdOrName === undefined) {
      clanIdOrName = get("stashClan", undefined);
      if (!clanIdOrName) {
        if (
          userConfirm(
            "You do not presently have a stashClan set. Use the current clan as a stash clan? (Defaults to yes in 15 seconds)",
            15000,
            true
          )
        ) {
          clanIdOrName = getClanId();
          set("stashClan", clanIdOrName);
        } else {
          throw "No stashClan set.";
        }
      }
    }
    this.clanIdOrName = clanIdOrName;
  }

  take(...items: Item[]) {
    withClan(this.clanIdOrName, () => {
      for (const item of items) {
        if (have(item)) continue;
        if (getFoldGroup(item).some(have)) {
          cliExecute(`fold ${item.name}`);
          continue;
        }
        if (getFoldGroup(item).includes(item)) {
          for (const fold of getFoldGroup(item)) {
            try {
              const succeeded = takeStash(1, item);
              if (succeeded) {
                print(`Took ${item.name} from stash in ${getClanName()}.`, "blue");
                cliExecute(`fold ${item.name}`);
                this.taken.set(item, (this.taken.get(item) ?? 0) + 1);
                continue;
              } else {
                print(`Failed to take ${item.name} from stash in ${getClanName()}.`, "red");
              }
            } catch {
              print(`Failed to take ${item.name} from stash in ${getClanName()}.`, "red");
            }
          }
        }
      }
    });
  }

  /**
   * Ensure at least one of each of {items} in inventory.
   * @param items Items to take from the stash.
   */
  ensure(...items: Item[]) {
    this.take(...items.filter((item) => availableAmount(item) === 0));
  }

  putBack(...items: Item[]) {
    withClan(this.clanIdOrName, () => {
      for (const item of items) {
        const count = this.taken.get(item) ?? 0;
        if (count > 0) {
          retrieveItem(count, item);
          if (putStash(count, item)) {
            print(`Returned ${item.name} to stash in ${getClanName()}.`, "blue");
            this.taken.delete(item);
          } else {
            throw `Failed to return ${item.name} to stash.`;
          }
        }
      }
    });
  }

  /**
   * Put all items back in the stash.
   */
  putBackAll() {
    this.putBack(...this.taken.keys());
  }
}
