export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: string[];
  categories: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.7.0",
    date: "2026-08-27",
    title: "Demotion release authorities",
    summary:
      "Added a dedicated approval authority for every down-network release path.",
    changes: [
      "Added one Demotion Approval Authority persona on each high-side network.",
      "Blocked first-time demotion until a same-network authority is assigned.",
      "Shared newly governed items with the authority without creating an initial approval request.",
      "Routed every later source schedule and dependency change through the assigned authority.",
      "Added authority-specific item visibility, pending badges, and approval actions.",
      "Added a browser-session picker for opening hidden authority accounts.",
      "Updated scenario schema normalization for authority assignments and pending releases.",
    ],
    categories: ["Demotion", "Approvals", "Governance"],
  },
  {
    version: "0.6.0",
    date: "2026-08-10",
    title: "Flexible sharing across every network direction",
    summary:
      "Expanded sharing to support same-network collaboration and simultaneous up- and down-network distribution.",
    changes: [
      "Added a visual system rulebook covering ownership, sync, approvals, and reconciliation.",
      "Linked the complete QA scenario specification for direct reading or LLM-assisted questions.",
      "Added same-network item sharing with Viewer and Editor approval behavior.",
      "Allowed promotion and demotion to remain enabled at the same time.",
      "Scoped approval requests to same-network Editor changes only.",
      "Changed cross-network edits into local divergence and reconciliation workflows.",
      "Separated immediate-source synchronization from inherited lower-network divergence.",
      "Suppressed multi-source warnings when all received schedule states match.",
      "Added explicit schema normalization for independent promotion and demotion policies.",
    ],
    categories: ["Sharing", "Networks", "Governance"],
  },
  {
    version: "0.5.0",
    date: "2026-08-03",
    title: "Product updates are now visible",
    summary:
      "Added an in-app changelog so users can follow Data Motion's evolution.",
    changes: [
      "Added a dedicated changelog page with dated release notes.",
      "Added persistent navigation between the sandbox and release history.",
      "Added shareable URL state for opening the changelog directly.",
    ],
    categories: ["New", "Documentation"],
  },
  {
    version: "0.4.0",
    date: "2026-07-28",
    title: "Multi-source sharing and reconciliation",
    summary:
      "Expanded synced copies to support recursive promotion paths and competing network states.",
    changes: [
      "Added multi-hop promotion through independently managed synced copies.",
      "Added source-owner and network-owner lineage pills to collaborator lists.",
      "Added explicit lower-network version choices for out-of-sync copies.",
      "Added conflict alerts when a recipient receives multiple promotion states.",
      "Prevented divergent higher-network copies from moving automatically when a lower state changes.",
      "Improved staged collaborator sharing so Apply controls commits pending additions.",
    ],
    categories: ["Sharing", "Sync", "Fixed"],
  },
  {
    version: "0.3.0",
    date: "2026-07-24",
    title: "Roles, ownership, and QA coverage",
    summary:
      "Clarified who can view, edit, share, and govern objects across networks.",
    changes: [
      "Renamed the application to Data Motion.",
      "Added Viewer and Editor collaborator roles.",
      "Enforced view-only restrictions with explanatory hover messages.",
      "Restricted approval and promotion controls to the applicable owner.",
      "Added the collaborator picker and multi-select access workflow.",
      "Added a full scenario reset action.",
      "Added comprehensive cross-feature QA scenarios.",
    ],
    categories: ["Permissions", "Governance", "Quality"],
  },
  {
    version: "0.2.0",
    date: "2026-07-16",
    title: "Governed synchronization workflows",
    summary:
      "Introduced editable schedules, approvals, dependencies, and network-aware synced copies.",
    changes: [
      "Added draggable Gantt bars with rigid dependency movement.",
      "Added dependency creation across writable promoted items.",
      "Added owner approval and denial workflows for governed editor changes.",
      "Added promoted and demoted synced-copy states with provenance.",
      "Added out-of-sync alerts and high-side conflict resolution.",
      "Added last-synced metadata and change summaries.",
    ],
    categories: ["Scheduling", "Approvals", "Networks"],
  },
  {
    version: "0.1.0",
    date: "2026-07-15",
    title: "Initial visualization sandbox",
    summary:
      "Launched the first Data Motion prototype for exploring cross-network schedule sharing.",
    changes: [
      "Added up to six configurable user browser windows.",
      "Added government and contractor organization defaults.",
      "Added nested mini-Gantt schedules with unique data per user.",
      "Added Commercial, NIPR, SIPR, JWICS, and SAP network levels.",
      "Added local persistence plus scenario import and export.",
    ],
    categories: ["Prototype", "Scheduling"],
  },
];
