/// <reference path="../pb_data/types.d.ts" />

// DEVIATION from plan (Rule 1 — Bug): the verbatim-research hook calls
// e.app.save(area) BEFORE e.next(). In PB 0.37.1 onRecordCreateExecute,
// e.next() is what actually persists the home — so creating the area
// first fails with `validation_missing_rel_records` on the `home_id`
// relation (the home row does not yet exist to satisfy the FK).
// Correct order: persist the home via e.next(), THEN create the Whole
// Home area. Both operations run inside the same DB transaction
// (onRecordCreateExecute semantics) so atomicity is preserved — a
// throw from e.app.save(wholeHome) still rolls back the home insert.
onRecordCreateExecute((e) => {
  // Recursion guard — we only fire on homes; nothing here creates another home.
  // But be explicit for future readers.
  if (e.record.collection().name !== "homes") {
    e.next();
    return;
  }

  // Persist the home first so its ID becomes a valid relation target.
  e.next();

  const areas = e.app.findCollectionByNameOrId("areas");
  const wholeHome = new Record(areas, {
    home_id:              e.record.id,
    name:                 "Whole Home",
    scope:                "whole_home",
    sort_order:           0,
    is_whole_home_system: true,
    icon:                 "home",
    color:                "#D4A574",
  });

  // Still inside the transaction: if this throws, the home insert
  // rolls back, so we cannot leave an orphan home without a Whole Home.
  e.app.save(wholeHome);
}, "homes");
