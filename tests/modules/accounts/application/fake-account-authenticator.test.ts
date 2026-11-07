import { describeAccountAuthenticatorContract } from "../../../support/contracts/account-authenticator-contract";
import { createFakeAccountAuthenticatorWorld } from "../../../support/fakes/fake-account-authenticator";

describeAccountAuthenticatorContract("in-memory fake", () => createFakeAccountAuthenticatorWorld());
