import { DemoAuth } from "jazz-tools";
import { useEffect, useMemo, useState } from "react";
import { useAuthSecretStorage, useJazzContext } from "../hooks.js";
import { useIsAuthenticated } from "./useIsAuthenticated.js";

/**
 * `useDemoAuth` is a hook that provides a `JazzAuth` object for demo authentication.
 *
 *
 * ```ts
 * const { state, logIn, signUp, existingUsers } = useDemoAuth();
 * ```
 *
 * @category Auth Providers
 */
export function useDemoAuth() {
  const context = useJazzContext();
  const authSecretStorage = useAuthSecretStorage();

  const authMethod = useMemo(() => {
    return new DemoAuth(context.authenticate, authSecretStorage);
  }, []);

  const isAuthenticated = useIsAuthenticated();
  const [existingUsers, setExistingUsers] = useState<string[]>([]);

  useEffect(() => {
    authMethod.getExistingUsers().then(setExistingUsers);
  }, [authMethod]);

  function handleSignUp(username: string) {
    authMethod.signUp(username).then(() => {
      setExistingUsers(existingUsers.concat([username]));
    });
  }

  return {
    state: isAuthenticated ? "signedIn" : "anonymous",
    logIn: authMethod.logIn,
    signUp: handleSignUp,
    existingUsers,
  } as const;
}
