// The item lists the phone's forms offer: core's values, with the phone's words.
import test from "node:test";
import assert from "node:assert/strict";
import * as core from "../../../../../core/index.js";
import { DEVICE_TYPES, GRAB, KINDS, LINK_TYPES, newKindFor } from "../../lib/entries.ts";

test("the kind picker offers every kind core saves, in the phone's own order", () => {
  assert.deepEqual(KINDS.map((k) => k.value).sort(), [...core.KINDS].sort());
});

test("Link comes first in the picker, as on the PC", () => {
  assert.deepEqual(KINDS.slice(0, 2).map((k) => [k.value, k.label]), [["link", "Link"], ["login", "Login"]]);
});

test("a new item starts as a link, except in a kind's own list and the account lists", () => {
  for (const scope of [{ view: "all" }, { view: "favorites" }, { view: "trash" }, { spaceId: "mock-space" }, { heldFor: "Mock Person" }]) assert.equal(newKindFor(scope), "link");
  for (const view of ["note", "key", "link", "thing", "device", "id", "login"]) assert.equal(newKindFor({ view }), view);
  for (const view of ["totp", "security", "closing", "closed"]) assert.equal(newKindFor({ view }), "login");
});

test("every link type, device type and grab choice core has comes with a label in the phone's list", () => {
  for (const [list, values] of [[LINK_TYPES, core.LINK_TYPES], [DEVICE_TYPES, core.DEVICE_TYPES], [GRAB, core.GRAB]]) {
    for (const value of values) {
      const label = list.find((o) => o.value === value)?.label;
      assert.ok(typeof label === "string" && label, `${JSON.stringify(value)} has no label`);
    }
  }
});
