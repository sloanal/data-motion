# Data Motion QA Scenarios

## Purpose

This document defines the end-to-end scenarios required to validate Data
Motion's cross-network scheduling model. It focuses on interactions where
promotion, demotion, permissions, approvals, dependencies, and sync state can
conflict.

## Network model

Test all flows against the ordered network hierarchy:

1. Commercial
2. NIPR
3. SIPR
4. JWICS
5. SAP

Use at least three browser windows for most tests:

- Low-side owner on Commercial
- Mid-side editor on NIPR or SIPR
- High-side observer or editor on JWICS

## Non-negotiable invariants

These rules take precedence when features conflict:

1. A lower network must never learn about an unreleased higher-network change.
2. Promotion does not require approvals.
3. Demotion requires owner approvals.
4. Promotion creates higher-network synced copies, not shared live objects.
5. Demotion creates an approved snapshot on one selected lower network.
6. Disabling demotion stops all subsequent downward propagation.
7. A higher-network edit with demotion disabled remains local and creates no
   low-side approval request or alert.
8. Approved changes apply atomically to every item in the rigid dependency
   group.
9. Denied changes must not alter dates, dependencies, sync timestamps, or
   receiving copies.
10. Read-only users may inspect an item but may not move it or create
    dependencies.

## Baseline setup

### QA-SETUP-01 — Reset the workspace

1. Change users, dates, permissions, and sharing controls.
2. Select **Reset**.
3. Cancel the confirmation.
4. Confirm that nothing changes.
5. Select **Reset** again and confirm.

Expected:

- All browsers, schedules, permissions, dependencies, approvals, copies, and
  alerts return to their original state.
- Saved local state is replaced by the reset state.

### QA-SETUP-02 — Browser limits and identity

1. Add browser windows until six are visible.
2. Attempt to add a seventh.
3. Change each user's organization and network.
4. Remove one browser and add it again.

Expected:

- No more than six browser windows can exist.
- Every window has independent identity, organization, and network settings.
- Added users receive distinct schedule data.

### QA-SETUP-03 — Network placement

Move one user through every network level.

Expected:

- The network badge and legend remain correct.
- Promotion is unavailable at SAP.
- Demotion is unavailable at Commercial.
- Demotion destinations only include networks below the object's origin.

## Permissions

### QA-PERM-00 — Add collaborators

1. Open an object's access section.
2. Confirm that only the owner and previously added collaborators are listed.
3. Open **Add people**.
4. Select multiple available users and choose **Add selected**.

Expected:

- The picker lists users who have not already been added.
- Multiple users can be selected before confirming.
- Added users appear in the access list with **Viewer** permission.
- Each listed collaborator can then be changed to **Editor** or removed.
- Removed users return to the available-user picker.

### QA-PERM-01 — Read access

1. Add another user with **Viewer** access.
2. Enable promotion or demotion so the user receives a copy.
3. Open the copy.
4. Attempt to drag it or create a dependency.

Expected:

- The user can open the share modal.
- The user cannot move the bar.
- Dependency, approval, promotion, demotion, destination, and collaborator
  controls are disabled.
- Hovering a blocked row or control explains that write access is required.
- The modal is explicitly labeled **View-only access** and its footer action is
  **Done**, not **Apply controls**.
- No approval or divergence state is created.

### QA-PERM-02 — Write access

1. Change the same user to **Editor**.
2. Open the receiving browser.

Expected:

- The bar uses the draggable affordance.
- The dependency control is available.
- Owner approvals remain disabled because editors cannot change that setting.
- Promotion remains disabled because only owners can change its state.
- Hovering either owner-only toggle explains why it cannot be changed.
- Subsequent behavior follows the applicable promotion, demotion, and approval
  rules below.

### QA-PERM-03 — Revoke access

1. Give a user access to a synced copy.
2. Revoke access from the owner browser.

Expected:

- The copy disappears from the receiving browser.
- Other recipients remain unaffected.
- No stale approval or dependency control remains available to the revoked user.

## Promotion

### QA-PROMO-01 — Promotion without approvals

1. Turn owner approvals off.
2. Turn promotion on.
3. Give specific higher-network users read or write access.

Expected:

- Promotion can be enabled while approvals are off.
- Only authorized users on higher networks receive a copy.
- Lower and same-level users do not receive a promoted copy.
- The row is labeled **Synced** and uses synced-copy styling.

### QA-PROMO-02 — Origin change propagates upward

1. Promote an object to two higher-network users.
2. Drag the origin object.

Expected:

- Non-divergent promoted copies move immediately.
- The origin and receiving views show the same schedule dates.
- **Last synced** updates.
- No approval is required solely because promotion is enabled.

### QA-PROMO-03 — Higher-network read-only copy

1. Promote an object with **Viewer** access.
2. Attempt to edit from the receiving browser.

Expected:

- The copy cannot be moved.
- The source remains unchanged.
- No out-of-sync alert or approval request is created.

### QA-PROMO-04 — Higher-network edit with demotion off

1. Promote an object with **Editor** access.
2. Keep demotion off.
3. Drag the promoted copy on the higher network.

Expected:

- The higher-network copy moves locally.
- The low-side source does not move.
- No approval request, pending icon, or alert appears on the low side.
- The high-side row displays an out-of-sync warning.
- The high-side modal states that nothing was sent to lower networks.
- The differences list includes the date variance.

### QA-PROMO-05 — Higher-network dependency edit with demotion off

1. Promote an object with write access.
2. Create a dependency between the promoted copy and a local high-side item.

Expected:

- The dependency exists only in the higher-network view.
- The high-side copy becomes out of sync.
- The differences list includes dependency timing.
- No low-side approval request, dependency, icon, or alert appears.

### QA-PROMO-06 — Independent higher-network copies

1. Promote the same object to two higher-network editors.
2. Have only the first editor move their copy.

Expected:

- Only the first editor's copy diverges.
- The second editor's copy remains synchronized with the source.
- The source remains unchanged.
- The first editor sees the out-of-sync alert; the second does not.

### QA-PROMO-07 — Promote an out-of-sync synced state

1. Promote an origin object from NIPR to a SIPR editor.
2. Change the SIPR copy so it is out of sync with the NIPR origin.
3. From the SIPR copy's access panel, add a JWICS user.
4. As the SIPR copy owner, enable promotion.

Expected:

- The SIPR access list and promotion controls belong to the SIPR copy state, not
  the NIPR origin.
- The JWICS user receives the SIPR dates, including its out-of-sync state.
- The JWICS copy identifies SIPR as its immediate promotion source.
- The NIPR origin remains unchanged and unaware of the SIPR edit.

### QA-PROMO-08 — Multi-hop updates

Continue from QA-PROMO-07 and move the SIPR copy again.

Expected:

- The JWICS copy updates to the new SIPR dates.
- It remains marked as inherited from an out-of-sync promoted state.
- No approval request or alert appears on NIPR.

### QA-PROMO-09 — Conflicting direct and inherited promotion states

1. Continue from QA-PROMO-07.
2. Add the same JWICS user directly to the NIPR origin.
3. Keep promotion enabled on both NIPR and SIPR states.

Expected:

- The JWICS row shows a conflicting-promotion-state alert.
- The modal lists both NIPR origin and SIPR synced-state candidates.
- Each candidate shows its source, network, and last-synced time.
- No candidate is silently allowed to overwrite the other.

### QA-PROMO-10 — Reconcile promotion states

From QA-PROMO-09:

1. Choose the NIPR state.
2. Recreate the conflict and choose the SIPR state.
3. Recreate the conflict and choose **Keep or create my own state**.

Expected:

- Choosing NIPR adopts the origin dates.
- Choosing SIPR adopts the inherited out-of-sync dates.
- Choosing a local state preserves or creates a third JWICS state.
- The alert clears after a choice and returns if either incoming candidate
  changes later.
- A locally edited JWICS state follows normal out-of-sync and network-boundary
  rules.

## Demotion

### QA-DEMOTE-01 — Approval prerequisite

1. Turn owner approvals off.
2. Attempt to enable demotion.
3. Turn owner approvals on.
4. Enable demotion.

Expected:

- Demotion is disabled while approvals are off.
- The UI explains that approvals are required for demotion.
- Demotion becomes available after approvals are enabled.
- Promotion remains independent of the approval toggle.

### QA-DEMOTE-02 — Destination selection

1. Enable demotion on a SIPR object.
2. Inspect destination options.
3. Select Commercial.

Expected:

- The destination field appears only while demotion is on.
- Only Commercial and NIPR are available.
- Authorized Commercial users receive the released copy.
- NIPR and higher networks do not receive that demoted copy.

### QA-DEMOTE-03 — Released-copy confidentiality

Open a demoted copy from the lower-network browser.

Expected:

- The copy is labeled **Released** and **Approved for release**.
- The source network is not displayed in the row, tooltip, banner, or reference
  context.
- The reference ID uses the receiving network prefix.
- No source-network detail leaks through an out-of-sync warning.

### QA-DEMOTE-04 — Source change while demotion is on

1. Enable demotion and create a lower-network copy.
2. Move the source object.

Expected:

- The approved snapshot updates after the valid source change.
- The lower copy moves to the synchronized position.
- **Last synced** updates.

### QA-DEMOTE-05 — Source change after demotion is disabled

1. Create a demoted copy.
2. Disable demotion.
3. Move the higher-network source.

Expected:

- The lower copy remains visible at its last approved position.
- No date, dependency, timestamp, alert, or approval travels downward.
- The higher-network source shows that the lower copy is out of sync.
- The higher-side modal explains that demotion is off.
- The lower-side UI says nothing about the higher-side change.

### QA-DEMOTE-06 — Re-enable demotion

Continue from QA-DEMOTE-05 and enable demotion again.

Expected:

- The lower snapshot refreshes to the current approved source state.
- The higher-side out-of-sync warning clears.
- **Last synced** updates on the receiving copy.

## Editing and rigid dependencies

### QA-EDIT-01 — Drag an unconnected item

Drag an owner-controlled item left and right.

Expected:

- The item follows the pointer.
- It cannot move before the timeline start or beyond the timeline end.
- Clicking without dragging still opens the share modal.

### QA-EDIT-02 — Drag a rigid dependency group

1. Create a dependency between two writable items.
2. Drag either item.

Expected:

- Every connected item moves by the same delta.
- Relative offsets remain fixed.
- Dependency lines remain connected.
- Group boundaries prevent any item from moving outside the timeline.

### QA-EDIT-03 — Transitive dependency group

Create A → B and B → C, then drag C.

Expected:

- A, B, and C move as one rigid group.
- No duplicate dependency is created.

### QA-EDIT-04 — Dependency to a promoted copy

1. Give the high-side user write access to a promoted copy.
2. Create a dependency from a local item to that copy.

Expected:

- The line is drawn in the high-side browser.
- The share modal lists the incoming or outgoing connection.
- With demotion off, the dependency is local and marks the copy out of sync.
- The low-side source remains wholly unaware.

## Approval workflow

### QA-APPROVAL-01 — Editor submits a governed date change

Use a writable governed copy where the change is allowed to route to its owner.

Expected:

- The source date does not change before approval.
- The request appears in the owner's share modal.
- A pending icon and count appear at the end of the governed row.
- The editor sees **Awaiting owner**.

### QA-APPROVAL-02 — Owner approves a date change

Approve the request from QA-APPROVAL-01.

Expected:

- The requested date applies once.
- Connected rigid dependencies move atomically.
- Authorized synchronized copies update according to network rules.
- The pending request and row icon disappear.

### QA-APPROVAL-03 — Owner denies a date change

Submit another request and deny it.

Expected:

- No date or dependency changes.
- No sync timestamp changes.
- No receiving copy changes.
- The pending request and icon disappear.

### QA-APPROVAL-04 — Governed dependency request

Create a dependency that legitimately requires owner approval.

Expected:

- The dependency line does not appear before approval.
- The owner sees **Add dependency** in the approval queue.
- Approve adds it once; deny adds nothing.

### QA-APPROVAL-05 — Multiple editors

Have two editors submit different date changes to the same governed item.

Expected:

- Two requests and a count of two are visible to the owner.
- Each editor sees only their own pending request.
- Resolving one request does not remove the other.

### QA-APPROVAL-06 — Forbidden low-side approval leakage

1. Promote a low-side object to a higher-network editor.
2. Keep demotion off.
3. Edit the high-side copy.

Expected:

- No approval request is created on the low side, even if owner approvals are
  enabled.
- No pending icon or request count appears on the low side.
- Imported legacy requests with this invalid direction are converted into
  high-side divergence state.

## Sync conflicts

### QA-CONFLICT-01 — Low-side source changes after high-side divergence

1. Diverge a promoted copy on the high side.
2. Change the low-side source afterward.

Expected:

- The low-side source changes normally and receives no information about the
  high-side edit.
- The high side receives **The low-side source changed**.
- The alert lists the source change plus existing date and dependency
  differences.
- The high side is asked which version to keep.

### QA-CONFLICT-02 — Use low-side version

Select **Use low-side version** in the conflict alert.

Expected:

- The high-side copy returns to the current source dates.
- High-side-only dependencies associated with the divergent copy are removed.
- The conflict and out-of-sync state clear.

### QA-CONFLICT-03 — Keep high-side changes

Create the conflict again and select **Keep high-side changes**.

Expected:

- The high-side dates and local dependencies remain.
- The copy remains out of sync.
- The source-change conflict prompt clears.
- The differences list records that the high-side version was retained.
- Nothing appears on the low side.

### QA-CONFLICT-04 — Source changes more than once

After keeping the high-side version, change the source again.

Expected:

- A new source-change conflict is raised on the high side.
- Differences are not duplicated.
- The low side remains unaware of high-side divergence.

## Alerts and status indicators

### QA-ALERT-01 — Pending approval icon

Expected:

- Appears only for actionable pending approvals.
- Displays the correct count.
- Never represents an unpropagated high-side edit.

### QA-ALERT-02 — Out-of-sync icon

Expected:

- Appears for a locally diverged promoted copy.
- Appears on the higher source when a retained demoted snapshot is stale.
- Tooltip text lists the applicable differences.
- Does not appear on a lower released copy when demotion is off.

### QA-ALERT-03 — Last synced and change details

1. Open a synced copy.
2. Record **Last synced**.
3. Select **View changes**.

Expected:

- A readable date and time are displayed.
- The CTA expands and collapses the latest synchronized-change summary.
- A local divergent edit does not falsely update the last successful sync time.

## Reference IDs

### QA-REF-01 — Standard object

Open share dialogs across all network levels.

Expected:

- IDs follow `XX-CCC-1234`.
- `XX` identifies the displayed object's applicable network.
- `CCC` is derived from the owner organization.
- The numeric suffix is stable for the same object.

### QA-REF-02 — Demoted copy

Open a released copy on the destination network.

Expected:

- The prefix uses the receiving network, not the hidden source network.
- The rest of the modal does not reveal the source network.

## Persistence and portability

### QA-PERSIST-01 — Automatic local save

Change dates, sharing, approvals, dependencies, identities, and conflict state,
then reload.

Expected:

- All state is restored.
- Pending approvals and divergent copies retain their correct visibility
  boundaries.

### QA-PERSIST-02 — Export and import

1. Export a scenario containing approvals, promoted copies, demoted snapshots,
   dependencies, and a sync conflict.
2. Reset.
3. Import the file.

Expected:

- The full scenario is restored.
- Invalid legacy high-to-low approval requests are normalized into private
  high-side divergence state.
- At most six browsers are imported.
- Invalid JSON produces the Data Motion validation message without changing
  current state.

## Cross-feature regression checklist

Before release, verify each combination:

- Promotion on, approvals off
- Promotion on, approvals on
- Demotion requested with approvals off
- Demotion on, approvals on
- Demotion disabled after a released snapshot exists
- Read access to promoted and demoted copies
- Write access to promoted and demoted copies
- Promoted copy with local high-side dependency
- Demoted copy with governed editor change
- Pending approval plus rigid dependency group
- Diverged high-side copy followed by low-side source change
- Conflict resolution using the source version
- Conflict resolution keeping the high-side version
- Import of legacy pending approvals
- Reset while approvals and conflicts exist

## Release exit criteria

- No test allows data or metadata to cross downward while demotion is off.
- No lower-network view exposes a high-side divergence, request, network, or
  conflict.
- Promotion remains usable without approvals.
- Demotion remains impossible without approvals.
- Every pending state has one clear owner action.
- Every conflict resolution produces deterministic dates and dependencies.
- All state survives reload, export, and import.
- Production build completes without type or bundling errors.
