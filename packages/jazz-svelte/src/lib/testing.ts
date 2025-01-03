import type { AgentSecret } from "cojson";
import { cojsonInternals } from "cojson";
import { PureJSCrypto } from "cojson/crypto";
import {
  Account,
  AnonymousJazzAgent,
  type CoValueClass,
  type CryptoProvider,
  type Peer,
  createAnonymousJazzContext,
} from "jazz-tools";
import { JAZZ_CTX, type JazzContext } from './jazz.svelte.js';

type TestAccountSchema<Acc extends Account> = CoValueClass<Acc> & {
  fromNode: (typeof Account)["fromNode"];
  create: (options: {
    creationProps: { name: string };
    initialAgentSecret?: AgentSecret;
    peersToLoadFrom?: Peer[];
    crypto: CryptoProvider;
  }) => Promise<Acc>;
};

export async function createJazzTestAccount<Acc extends Account>(options?: {
  AccountSchema?: CoValueClass<Acc>;
}): Promise<Acc> {
  const AccountSchema =
    (options?.AccountSchema ?? Account) as unknown as TestAccountSchema<Acc>;
  const account = await AccountSchema.create({
    creationProps: {
      name: "Test Account",
    },
    crypto: await PureJSCrypto.create(),
  });

  return account;
}

export async function createJazzTestGuest() {
  const ctx = await createAnonymousJazzContext({
    crypto: await PureJSCrypto.create(),
    peersToLoadFrom: [],
  });

  return {
    guest: ctx.agent,
  };
}

export function createJazzTestContext<Acc extends Account>({ account }: {
  account: Acc | { guest: AnonymousJazzAgent };
}) {
  const ctx = new Map<typeof JAZZ_CTX, JazzContext<Acc>>();

  if ('guest' in account) {
    ctx.set(JAZZ_CTX, {
      current: {
        guest: account.guest,
        logOut: () => account.guest.node.gracefulShutdown(),
        done: () => account.guest.node.gracefulShutdown()
      }
    });
  } else {
    ctx.set(JAZZ_CTX, {
      current: {
        me: account,
        logOut: () => account._raw.core.node.gracefulShutdown(),
        done: () => account._raw.core.node.gracefulShutdown()
      }
    });
  } 

  return ctx;
}

export function linkAccounts(a: Account, b: Account) {
  const [aPeer, bPeer] = cojsonInternals.connectedPeers("a", "b", {
    peer1role: "server",
    peer2role: "server",
  });

  a._raw.core.node.syncManager.addPeer(aPeer);
  b._raw.core.node.syncManager.addPeer(bPeer);
}
