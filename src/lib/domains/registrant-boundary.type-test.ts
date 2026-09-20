/**
 * A compile-time plant. Nothing here runs.
 *
 * `npm run type-check` is the gate, and each `@ts-expect-error` below fails the
 * build the moment its line stops being an error. That is the assertion: the
 * day somebody widens `PurchaseDomainParams` back to accept a caller-supplied
 * contact, or unbrands `ResolvedRegistrantContact`, CI says so rather than a
 * comment quietly going out of date.
 *
 * The defect being held shut is the one that made the previous guard useless:
 *
 *     purchaseDomain({
 *       contact: { first_name: "Domain", last_name: "Owner", city: "New York", ... }
 *     })
 *
 * which compiled, reached the registrar, and satisfied `assertCompleteRegistrant`
 * because the caller had already supplied every field it checks for.
 */
import type { PurchaseDomainParams } from "./manager";
import type { ResolvedRegistrantContact } from "./registrant";

const handAssembled = {
  first_name: "Domain",
  last_name: "Owner",
  org_name: "Acme Plumbing",
  address1: "123 Main Street",
  city: "New York",
  state: "NY",
  postal_code: "10001",
  country: "US",
  phone: "+1.2125551234",
  email: "nobody@example.com",
};

// A registrant contact may only come from `resolveRegistrantContact`. A plain
// object of the right shape is not one, however complete it looks.
// @ts-expect-error a hand-assembled contact is not a resolved registrant
const notARegistrant: ResolvedRegistrantContact = handAssembled;
void notARegistrant;

// And there is nowhere to put one anyway: `purchaseDomain` resolves the
// registrant itself from the user, so the parameter no longer exists.
const params: PurchaseDomainParams = {
  storeId: null,
  userId: "usr_1",
  domainName: "example",
  tld: "com",
  isFree: true,
  // @ts-expect-error purchaseDomain resolves the registrant itself
  contact: handAssembled,
};
void params;
