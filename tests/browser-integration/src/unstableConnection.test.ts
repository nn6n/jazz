import {
  Account,
  AuthSecretStorage,
  CoMap,
  FileStream,
  Group,
  co,
} from "jazz-tools";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { createAccountContext, startSyncServer } from "./testUtils";

class TestMap extends CoMap {
  value = co.string;
}

class CustomAccount extends Account {
  root = co.ref(TestMap);

  migrate() {
    if (!this.root) {
      this.root = TestMap.create({ value: "initial" }, { owner: this });
    }
  }
}

let syncServer: Awaited<ReturnType<typeof startSyncServer>>;

beforeAll(async () => {
  syncServer = await startSyncServer();
});

describe("Browser sync on unstable connection", () => {
  afterEach(async () => {
    await new AuthSecretStorage().clear();
  });

  test("uploads the data to the sync server even with unstable connection", async () => {
    const { contextManager } = await createAccountContext({
      sync: {
        peer: syncServer.url,
      },
      storage: "indexedDB",
      AccountSchema: CustomAccount,
    });

    const bytes10MB = 1e7;

    const group = Group.create();
    group.addMember("everyone", "reader");

    const promise = FileStream.createFromBlob(
      new Blob(["1".repeat(bytes10MB)], { type: "image/png" }),
      group,
    );

    await syncServer.disconnectAllClients();

    const file = await promise;

    await syncServer.disconnectAllClients();

    const fileStream = await file.waitForSync();

    expect(fileStream).toBeDefined();

    contextManager.done();
    await new AuthSecretStorage().clear();

    await createAccountContext({
      sync: {
        peer: syncServer.url,
      },
      storage: "disabled",
      AccountSchema: CustomAccount,
    });

    const promise2 = FileStream.loadAsBlob(file.id);

    // TODO: If the connection is dropped in the middle of streaming, the load fails
    // await syncServer.disconnectAllClients()

    const fileOnSecondAccount = await promise2;

    expect(fileOnSecondAccount?.size).toBe(bytes10MB);
  });
});
