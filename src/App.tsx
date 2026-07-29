import {
  ArrowDownToLine,
  ArrowUpToLine,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  GitBranch,
  Info,
  Link2,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Upload,
  Users,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

const NETWORKS = ["Commercial", "NIPR", "SIPR", "JWICS", "SAP"] as const;
const READ_ONLY_REASON =
  "View-only access: only the owner or an editor with write access can make this change.";
const OWNER_ONLY_APPROVAL_REASON =
  "Owner-only setting: editors cannot turn owner approvals on or off.";
const OWNER_ONLY_PROMOTION_REASON =
  "Owner-only setting: editors cannot turn promotion on or off.";
const OWNER_ONLY_DEMOTION_REASON =
  "Owner-only setting: only the object-of-origin owner can configure demotion.";
type Network = (typeof NETWORKS)[number];
type Permission = "none" | "read" | "write" | "owner";

type Access = {
  userId: string;
  permission: Permission;
};

type ApprovalRequest = {
  id: string;
  editorUserId: string;
  kind?: "schedule" | "dependency";
  requestedStart?: number;
  dependency?: [string, string];
  dependencyPersonaId?: string;
  submittedAt: string;
};

type DemotedSnapshot = {
  start: number;
  duration: number;
  lastSyncedAt: string;
};

type PromotedCopySnapshot = DemotedSnapshot & {
  outOfSync: boolean;
  differences: string[];
  lastLocalEditAt?: string;
  localDependencies?: [string, string][];
  access?: Access[];
  promotion?: boolean;
  promotedFromUserId?: string;
  reconciledCandidateSignature?: string;
};

type PromotionCandidate = {
  stateId: string;
  holderUserId: string;
  holderName: string;
  network: Network;
  start: number;
  duration: number;
  lastSyncedAt?: string;
  permission: Permission;
  outOfSync: boolean;
  differences: string[];
};

type ScheduleItem = {
  id: string;
  name: string;
  start: number;
  duration: number;
  depth: number;
  color: string;
  approvals: boolean;
  promotion: boolean;
  demotion: boolean;
  destination: Network;
  access: Access[];
  lastSyncedAt?: string;
  pendingApprovals?: ApprovalRequest[];
  demotedSnapshot?: DemotedSnapshot;
  demotionOutOfSync?: boolean;
  promotedCopies?: Record<string, PromotedCopySnapshot>;
};

type Persona = {
  id: string;
  name: string;
  role: string;
  organization: string;
  network: Network;
  accent: string;
  items: ScheduleItem[];
  dependencies: [string, string][];
};

type Modal =
  | { type: "settings"; userId: string }
  | {
    type: "access";
    userId: string;
    itemId: string;
    viewingUserId?: string;
  }
  | null;

const COLORS = [
  "#d6ff63",
  "#71d7ff",
  "#ffaf68",
  "#d6a8ff",
  "#66e3b4",
  "#ff7d86",
];
const ORGS = [
  "Federal Programs Office",
  "National Systems Directorate",
  "Aegis Mission Partners",
  "Civic Signal Technologies",
  "Strategic Capabilities Agency",
  "Frontier Systems Group",
];
const NAMES = [
  "Maya Chen",
  "Eli Brooks",
  "Nia Patel",
  "Owen Silva",
  "June Park",
  "Sam Rivera",
];
const ROLES = [
  "Program lead",
  "Portfolio analyst",
  "Delivery manager",
  "Systems planner",
  "Mission owner",
  "Contractor lead",
];
const PROJECT_SETS = [
  [
    "Horizon Modernization",
    "Identity workstream",
    "Access controls",
    "Data Exchange",
    "Schema alignment",
    "Gateway pilot",
  ],
  [
    "Sentinel Readiness",
    "Sensor integration",
    "Field calibration",
    "Operator Training",
    "Course design",
    "Exercise Alpha",
  ],
  [
    "Orion Migration",
    "Cloud foundation",
    "Boundary review",
    "Application Move",
    "Wave planning",
    "Cutover rehearsal",
  ],
  [
    "Atlas Sustainment",
    "Fleet telemetry",
    "Uplink validation",
    "Parts Forecast",
    "Demand model",
    "Supplier sync",
  ],
  [
    "Beacon Delivery",
    "Site activation",
    "Power assessment",
    "Mission Apps",
    "Workflow mapping",
    "User acceptance",
  ],
  [
    "Keystone Program",
    "Platform hardening",
    "Threat model",
    "Release Train",
    "Build pipeline",
    "Authority review",
  ],
];

function makeItems(index: number): ScheduleItem[] {
  const names = PROJECT_SETS[index % PROJECT_SETS.length];
  const offsets = [
    [4, 45, 0],
    [7, 19, 1],
    [10, 10, 2],
    [38, 40, 0],
    [43, 18, 1],
    [48, 12, 2],
  ];
  return names.map((name, i) => ({
    id: `u${index}-p${i}`,
    name,
    start: Math.min(78, offsets[i][0] + ((index * 7 + i * 2) % 11)),
    duration: Math.max(8, offsets[i][1] - ((index + i) % 7)),
    depth: offsets[i][2],
    color: COLORS[(index + (i < 3 ? 0 : 2)) % COLORS.length],
    approvals: i === 0 || (index + i) % 3 === 0,
    promotion: i === 0 && index < 2,
    demotion: false,
    destination: NETWORKS[Math.min(4, index + 1)] as Network,
    access: [],
    lastSyncedAt: new Date(Date.now() - (index + i + 1) * 7 * 60_000)
      .toISOString(),
  }));
}

function createDefaultPersonas(): Persona[] {
  return NAMES.slice(0, 4).map((name, index) => ({
    id: `user-${index}`,
    name,
    role: ROLES[index],
    organization: ORGS[index],
    network: NETWORKS[Math.min(index, NETWORKS.length - 1)],
    accent: COLORS[index],
    items: makeItems(index),
    dependencies: [[`u${index}-p2`, `u${index}-p4`]],
  }));
}

const NETWORK_IDS: Record<Network, string> = {
  Commercial: "CO",
  NIPR: "NI",
  SIPR: "SI",
  JWICS: "JW",
  SAP: "SA",
};

function referenceId(
  owner: Persona,
  item: ScheduleItem,
  displayNetwork = owner.network,
) {
  const organizationId = owner.organization
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .padEnd(3, "X")
    .toUpperCase();
  const uniqueNumber = Array.from(`${owner.id}:${item.id}`).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) % 9000,
    0,
  ) + 1000;
  return `${NETWORK_IDS[displayNetwork]}-${organizationId}-${uniqueNumber}`;
}

function formatSyncTime(value?: string) {
  if (!value) return "Recently";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPromotionCandidates(
  item: ScheduleItem,
  owner: Persona,
  recipient: Persona,
  personas: Persona[],
): PromotionCandidate[] {
  const recipientLevel = NETWORKS.indexOf(recipient.network);
  const candidates: PromotionCandidate[] = [];
  const originPermission = item.access.find((entry) =>
    entry.userId === recipient.id
  )?.permission;
  if (
    item.promotion &&
    originPermission &&
    originPermission !== "none" &&
    recipientLevel > NETWORKS.indexOf(owner.network)
  ) {
    candidates.push({
      stateId: `origin:${owner.id}`,
      holderUserId: owner.id,
      holderName: `${owner.name} · object of origin`,
      network: owner.network,
      start: item.start,
      duration: item.duration,
      lastSyncedAt: item.lastSyncedAt,
      permission: originPermission,
      outOfSync: false,
      differences: [],
    });
  }

  Object.entries(item.promotedCopies ?? {}).forEach(([holderUserId, copy]) => {
    if (holderUserId === recipient.id || !copy.promotion) return;
    const holder = personas.find((persona) => persona.id === holderUserId);
    const permission = copy.access?.find((entry) =>
      entry.userId === recipient.id
    )?.permission;
    if (
      !holder ||
      !permission ||
      permission === "none" ||
      recipientLevel <= NETWORKS.indexOf(holder.network)
    ) {
      return;
    }
    candidates.push({
      stateId: `copy:${holderUserId}`,
      holderUserId,
      holderName: `${holder.name} · synced state`,
      network: holder.network,
      start: copy.start,
      duration: copy.duration,
      lastSyncedAt: copy.lastSyncedAt,
      permission,
      outOfSync: copy.outOfSync,
      differences: copy.differences,
    });
  });

  return candidates;
}

function promotionCandidateSignature(candidates: PromotionCandidate[]) {
  return candidates
    .map((candidate) =>
      `${candidate.stateId}:${candidate.start}:${candidate.duration}`
    )
    .sort()
    .join("|");
}

function shiftConnectedItems(
  personas: Persona[],
  itemId: string,
  requestedDelta: number,
) {
  const connectedIds = new Set([itemId]);
  const dependencies = personas.flatMap((persona) => persona.dependencies);
  let foundConnection = true;
  while (foundConnection) {
    foundConnection = false;
    dependencies.forEach(([fromId, toId]) => {
      if (connectedIds.has(fromId) && !connectedIds.has(toId)) {
        connectedIds.add(toId);
        foundConnection = true;
      }
      if (connectedIds.has(toId) && !connectedIds.has(fromId)) {
        connectedIds.add(fromId);
        foundConnection = true;
      }
    });
  }

  const connectedItems = personas.flatMap((persona) =>
    persona.items.filter((item) => connectedIds.has(item.id))
  );
  const minimumDelta = Math.max(
    ...connectedItems.map((item) => -item.start),
  );
  const maximumDelta = Math.min(
    ...connectedItems.map((item) => 100 - item.duration - item.start),
  );
  const delta = Math.max(minimumDelta, Math.min(maximumDelta, requestedDelta));
  if (Math.abs(delta) < 0.01) return personas;
  const syncedAt = new Date().toISOString();

  return personas.map((persona) => ({
    ...persona,
    items: persona.items.map((item) =>
      connectedIds.has(item.id)
        ? (() => {
          const nextStart = Math.round((item.start + delta) * 10) / 10;
          const promotedCopies = item.promotedCopies
            ? Object.fromEntries(
              Object.entries(item.promotedCopies).map(([userId, copy]) =>
                copy.outOfSync
                  ? [
                    userId,
                    {
                      ...copy,
                      differences: Array.from(
                        new Set([
                          ...copy.differences,
                          "Source schedule changed after the local edit",
                        ]),
                      ),
                    },
                  ]
                  : [
                    userId,
                    {
                      ...copy,
                      start: nextStart,
                      duration: item.duration,
                      lastSyncedAt: syncedAt,
                    },
                  ]
              ),
            )
            : undefined;
          return {
            ...item,
            start: nextStart,
            lastSyncedAt: syncedAt,
            promotedCopies,
            demotedSnapshot: item.demotion
              ? {
                start: nextStart,
                duration: item.duration,
                lastSyncedAt: syncedAt,
              }
              : item.demotedSnapshot,
            demotionOutOfSync: Boolean(
              item.demotedSnapshot && !item.demotion,
            ),
          };
        })()
        : item
    ),
  }));
}

function isHighSideOnlyRequest(
  request: ApprovalRequest,
  item: ScheduleItem,
  owner: Persona,
  personas: Persona[],
) {
  const editor = personas.find((persona) =>
    persona.id === request.editorUserId
  );
  return Boolean(
    editor &&
      item.promotion &&
      !item.demotion &&
      NETWORKS.indexOf(editor.network) > NETWORKS.indexOf(owner.network),
  );
}

function normalizeApprovalBoundaries(personas: Persona[]) {
  return personas.map((owner) => ({
    ...owner,
    items: owner.items.map((item) => {
      const blockedRequests = (item.pendingApprovals ?? []).filter((request) =>
        isHighSideOnlyRequest(request, item, owner, personas)
      );
      if (blockedRequests.length === 0) return item;
      const promotedCopies = { ...item.promotedCopies };
      blockedRequests.forEach((request) => {
        const requestedStart = request.requestedStart ?? item.start;
        const differenceDays = Math.max(
          1,
          Math.round(Math.abs(requestedStart - item.start) * 1.2),
        );
        promotedCopies[request.editorUserId] = {
          start: requestedStart,
          duration: item.duration,
          lastSyncedAt: item.lastSyncedAt ?? request.submittedAt,
          outOfSync: true,
          differences: [
            `Start date is ${differenceDays} days ${
              requestedStart >= item.start ? "later" : "earlier"
            } than the source`,
            "Local edit has not propagated to lower networks",
          ],
          lastLocalEditAt: request.submittedAt,
        };
      });
      return {
        ...item,
        promotedCopies,
        pendingApprovals: (item.pendingApprovals ?? []).filter((request) =>
          !isHighSideOnlyRequest(request, item, owner, personas)
        ),
      };
    }),
  }));
}

const DEFAULTS = createDefaultPersonas();
const STORAGE_KEY = "relay-sandbox-v1";

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  disabledReason,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={`toggle ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function App() {
  const [personas, setPersonas] = useState<Persona[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeApprovalBoundaries(JSON.parse(saved)) : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [modal, setModal] = useState<Modal>(null);
  const [linking, setLinking] = useState<
    { userId: string; sourceId: string } | null
  >(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPersonas((current) => normalizeApprovalBoundaries(current));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(personas));
      setSavedAt(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [personas]);

  const accessModal = useMemo(() => {
    if (modal?.type !== "access") return null;
    const user = personas.find((p) => p.id === modal.userId);
    const viewingUser = modal.viewingUserId
      ? personas.find((p) => p.id === modal.viewingUserId)
      : undefined;
    return {
      user,
      viewingUser,
      item: user?.items.find((item) => item.id === modal.itemId),
    };
  }, [modal, personas]);

  function updatePersona(id: string, patch: Partial<Persona>) {
    setPersonas((current) =>
      current.map((persona) =>
        persona.id === id ? { ...persona, ...patch } : persona
      )
    );
  }

  function updateItem(
    userId: string,
    itemId: string,
    patch: Partial<ScheduleItem>,
  ) {
    setPersonas((current) =>
      current.map((persona) =>
        persona.id === userId
          ? {
            ...persona,
            items: persona.items.map((item) =>
              item.id === itemId
                ? (() => {
                  const syncedAt = new Date().toISOString();
                  const next = {
                    ...item,
                    ...patch,
                    lastSyncedAt: syncedAt,
                  };
                  return patch.demotion === true
                    ? {
                      ...next,
                      demotedSnapshot: {
                        start: next.start,
                        duration: next.duration,
                        lastSyncedAt: syncedAt,
                      },
                      demotionOutOfSync: false,
                    }
                    : next;
                })()
                : item
            ),
          }
          : persona
      )
    );
  }

  function updatePromotedCopy(
    ownerId: string,
    itemId: string,
    holderUserId: string,
    patch: Partial<PromotedCopySnapshot>,
  ) {
    setPersonas((current) =>
      current.map((persona) => {
        if (persona.id !== ownerId) return persona;
        return {
          ...persona,
          items: persona.items.map((item) => {
            if (item.id !== itemId) return item;
            const existing = item.promotedCopies?.[holderUserId];
            const holderState: PromotedCopySnapshot = {
              start: existing?.start ?? item.start,
              duration: existing?.duration ?? item.duration,
              lastSyncedAt: existing?.lastSyncedAt ??
                item.lastSyncedAt ??
                new Date().toISOString(),
              outOfSync: existing?.outOfSync ?? false,
              differences: existing?.differences ?? [],
              ...existing,
              ...patch,
            };
            const promotedCopies = {
              ...item.promotedCopies,
              [holderUserId]: holderState,
            };
            holderState.access?.forEach((entry) => {
              if (
                entry.permission === "none" ||
                promotedCopies[entry.userId]
              ) {
                return;
              }
              promotedCopies[entry.userId] = {
                start: holderState.start,
                duration: holderState.duration,
                lastSyncedAt: holderState.lastSyncedAt,
                outOfSync: holderState.outOfSync,
                differences: [...holderState.differences],
                promotedFromUserId: holderUserId,
              };
            });
            return { ...item, promotedCopies };
          }),
        };
      })
    );
  }

  function moveItem(
    itemId: string,
    requestedDelta: number,
    ownerId: string,
    editorUserId: string,
    requiresApproval: boolean,
    copyType?: "promoted" | "demoted" | null,
  ) {
    setPersonas((current) => {
      const sourceItem = current
        .find((persona) => persona.id === ownerId)
        ?.items.find((item) => item.id === itemId);
      if (
        ownerId !== editorUserId &&
        copyType === "promoted" &&
        sourceItem &&
        !sourceItem.demotion
      ) {
        const connectedIds = new Set([itemId]);
        const viewerDependencies = current
          .find((persona) => persona.id === editorUserId)
          ?.dependencies ?? [];
        let foundConnection = true;
        while (foundConnection) {
          foundConnection = false;
          viewerDependencies.forEach(([fromId, toId]) => {
            if (connectedIds.has(fromId) && !connectedIds.has(toId)) {
              connectedIds.add(toId);
              foundConnection = true;
            }
            if (connectedIds.has(toId) && !connectedIds.has(fromId)) {
              connectedIds.add(fromId);
              foundConnection = true;
            }
          });
        }
        const editedAt = new Date().toISOString();
        return current.map((persona) => ({
          ...persona,
          items: persona.items.map((item) => {
            if (!connectedIds.has(item.id)) return item;
            if (persona.id === editorUserId) {
              return {
                ...item,
                start: Math.max(
                  0,
                  Math.min(
                    100 - item.duration,
                    Math.round((item.start + requestedDelta) * 10) / 10,
                  ),
                ),
                lastSyncedAt: editedAt,
              };
            }
            if (!item.promotion) return item;
            const existing = item.promotedCopies?.[editorUserId];
            const currentStart = existing?.start ?? item.start;
            const nextStart = Math.max(
              0,
              Math.min(
                100 - item.duration,
                Math.round((currentStart + requestedDelta) * 10) / 10,
              ),
            );
            const differenceDays = Math.max(
              1,
              Math.round(Math.abs(nextStart - item.start) * 1.2),
            );
            const direction = nextStart >= item.start ? "later" : "earlier";
            const differences = [
              `Start date is ${differenceDays} days ${direction} than the source`,
              ...(viewerDependencies.some(([fromId, toId]) =>
                  fromId === item.id || toId === item.id
                )
                ? ["Dependency timing differs from the source schedule"]
                : []),
              "Local edit has not propagated to lower networks",
            ];
            const promotedCopies = {
              ...item.promotedCopies,
              [editorUserId]: {
                ...existing,
                start: nextStart,
                duration: existing?.duration ?? item.duration,
                lastSyncedAt: existing?.lastSyncedAt ??
                  item.lastSyncedAt ??
                  editedAt,
                outOfSync: true,
                differences,
                lastLocalEditAt: editedAt,
              },
            };
            Object.entries(promotedCopies).forEach(([holderId, copy]) => {
              if (
                holderId === editorUserId ||
                copy.promotedFromUserId !== editorUserId ||
                copy.outOfSync
              ) {
                return;
              }
              promotedCopies[holderId] = {
                ...copy,
                start: nextStart,
                duration: existing?.duration ?? item.duration,
                lastSyncedAt: editedAt,
                outOfSync: true,
                differences: Array.from(
                  new Set([
                    ...differences,
                    "Inherited from an out-of-sync promoted state",
                  ]),
                ),
              };
            });
            return {
              ...item,
              promotedCopies,
            };
          }),
        }));
      }
      if (ownerId !== editorUserId && requiresApproval) {
        return current.map((persona) =>
          persona.id === ownerId
            ? {
              ...persona,
              items: persona.items.map((item) => {
                if (item.id !== itemId) return item;
                const requests = item.pendingApprovals ?? [];
                const existing = requests.find((request) =>
                  request.editorUserId === editorUserId
                );
                const requestedStart = Math.max(
                  0,
                  Math.min(
                    100 - item.duration,
                    (existing?.requestedStart ?? item.start) + requestedDelta,
                  ),
                );
                const request: ApprovalRequest = {
                  id: existing?.id ??
                    `approval-${editorUserId}-${itemId}-${Date.now()}`,
                  editorUserId,
                  kind: "schedule",
                  requestedStart: Math.round(requestedStart * 10) / 10,
                  submittedAt: existing?.submittedAt ??
                    new Date().toISOString(),
                };
                return {
                  ...item,
                  pendingApprovals: [
                    ...requests.filter((entry) =>
                      entry.editorUserId !== editorUserId
                    ),
                    request,
                  ],
                };
              }),
            }
            : persona
        );
      }
      return shiftConnectedItems(current, itemId, requestedDelta);
    });
  }

  function resolveApproval(
    ownerId: string,
    itemId: string,
    requestId: string,
    approved: boolean,
  ) {
    setPersonas((current) => {
      const item = current
        .find((persona) => persona.id === ownerId)
        ?.items.find((entry) => entry.id === itemId);
      const request = item?.pendingApprovals?.find((entry) =>
        entry.id === requestId
      );
      if (!item || !request) return current;
      const withoutRequest = current.map((persona) =>
        persona.id === ownerId
          ? {
            ...persona,
            items: persona.items.map((entry) =>
              entry.id === itemId
                ? {
                  ...entry,
                  pendingApprovals: entry.pendingApprovals?.filter(
                    (pending) => pending.id !== requestId,
                  ),
                }
                : entry
            ),
          }
          : persona
      );
      return approved
        ? request.kind === "dependency" && request.dependency &&
            request.dependencyPersonaId
          ? withoutRequest.map((persona) =>
            persona.id === request.dependencyPersonaId
              ? {
                ...persona,
                dependencies: [
                  ...persona.dependencies,
                  request.dependency!,
                ],
              }
              : persona
          )
          : shiftConnectedItems(
            withoutRequest,
            itemId,
            (request.requestedStart ?? item.start) - item.start,
          )
        : withoutRequest;
    });
  }

  function resolveSyncConflict(
    ownerId: string,
    itemId: string,
    viewerId: string,
    resolution: "source" | "local",
  ) {
    setPersonas((current) => {
      const sourceItem = current
        .find((persona) => persona.id === ownerId)
        ?.items.find((item) => item.id === itemId);
      const copy = sourceItem?.promotedCopies?.[viewerId];
      if (!sourceItem || !copy) return current;

      return current.map((persona) => {
        const withoutLocalDependencies = resolution === "source" &&
            persona.id === viewerId
          ? {
            ...persona,
            dependencies: persona.dependencies.filter(([fromId, toId]) =>
              !copy.localDependencies?.some(([localFrom, localTo]) =>
                localFrom === fromId && localTo === toId
              )
            ),
          }
          : persona;
        if (persona.id !== ownerId) return withoutLocalDependencies;
        return {
          ...withoutLocalDependencies,
          items: withoutLocalDependencies.items.map((item) => {
            if (item.id !== itemId || !item.promotedCopies?.[viewerId]) {
              return item;
            }
            if (resolution === "source") {
              const { [viewerId]: _, ...remainingCopies } = item.promotedCopies;
              return { ...item, promotedCopies: remainingCopies };
            }
            return {
              ...item,
              promotedCopies: {
                ...item.promotedCopies,
                [viewerId]: {
                  ...copy,
                  outOfSync: true,
                  differences: [
                    ...copy.differences.filter((difference) =>
                      difference !==
                        "Source schedule changed after the local edit"
                    ),
                    "High-side version retained after the source changed",
                  ],
                },
              },
            };
          }),
        };
      });
    });
  }

  function reconcilePromotionState(
    ownerId: string,
    itemId: string,
    viewerId: string,
    stateId: string | "local",
  ) {
    setPersonas((current) => {
      const owner = current.find((persona) => persona.id === ownerId);
      const viewer = current.find((persona) => persona.id === viewerId);
      const item = owner?.items.find((entry) => entry.id === itemId);
      if (!owner || !viewer || !item) return current;
      const candidates = getPromotionCandidates(item, owner, viewer, current);
      const existing = item.promotedCopies?.[viewerId];
      const selected = candidates.find((candidate) =>
        candidate.stateId === stateId
      );
      if (stateId !== "local" && !selected) return current;
      const base = selected ?? candidates[0];
      if (!base && !existing) return current;

      return current.map((persona) =>
        persona.id === ownerId
          ? {
            ...persona,
            items: persona.items.map((entry) =>
              entry.id === itemId
                ? {
                  ...entry,
                  promotedCopies: {
                    ...entry.promotedCopies,
                    [viewerId]: {
                      start: stateId === "local"
                        ? existing?.start ?? base!.start
                        : selected!.start,
                      duration: stateId === "local"
                        ? existing?.duration ?? base!.duration
                        : selected!.duration,
                      lastSyncedAt: stateId === "local"
                        ? existing?.lastSyncedAt ??
                          base?.lastSyncedAt ??
                          new Date().toISOString()
                        : selected!.lastSyncedAt ??
                          new Date().toISOString(),
                      outOfSync: stateId === "local"
                        ? true
                        : selected!.outOfSync,
                      differences: stateId === "local"
                        ? [
                          ...(existing?.differences ?? []),
                          "Independent local state retained",
                        ]
                        : [...selected!.differences],
                      access: existing?.access,
                      promotion: existing?.promotion,
                      promotedFromUserId: stateId === "local"
                        ? existing?.promotedFromUserId
                        : selected!.holderUserId,
                      reconciledCandidateSignature: promotionCandidateSignature(
                        candidates,
                      ),
                    },
                  },
                }
                : entry
            ),
          }
          : persona
      );
    });
  }

  function syncToDemotedState(ownerId: string, itemId: string) {
    setPersonas((current) => {
      const item = current
        .find((persona) => persona.id === ownerId)
        ?.items.find((entry) => entry.id === itemId);
      if (!item?.demotedSnapshot) return current;
      const shifted = shiftConnectedItems(
        current,
        itemId,
        item.demotedSnapshot.start - item.start,
      );
      return shifted.map((persona) =>
        persona.id === ownerId
          ? {
            ...persona,
            items: persona.items.map((entry) =>
              entry.id === itemId
                ? {
                  ...entry,
                  demotionOutOfSync: false,
                  lastSyncedAt: item.demotedSnapshot!.lastSyncedAt,
                }
                : entry
            ),
          }
          : persona
      );
    });
  }

  function addPersona() {
    if (personas.length >= 6) return;
    const used = new Set(personas.map((p) => p.name));
    const index = NAMES.findIndex((name) => !used.has(name));
    const templateIndex = index < 0 ? personas.length : index;
    const nextIndex = Math.max(0, templateIndex);
    setPersonas((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        name: NAMES[nextIndex],
        role: ROLES[nextIndex],
        organization: ORGS[nextIndex],
        network: NETWORKS[Math.min(nextIndex, 4)],
        accent: COLORS[nextIndex],
        items: makeItems(nextIndex).map((item) => ({
          ...item,
          id: `${item.id}-${Date.now()}`,
        })),
        dependencies: [],
      },
    ]);
  }

  function removePersona(id: string) {
    setPersonas((current) => current.filter((persona) => persona.id !== id));
    setModal(null);
  }

  function handleItemClick(
    viewingUserId: string,
    itemId: string,
    ownerId = viewingUserId,
    canWrite = true,
  ) {
    if (linking?.userId === viewingUserId) {
      if (!canWrite) return;
      if (linking.sourceId === itemId) {
        setLinking(null);
        return;
      }
      setPersonas((current) => {
        const dependency: [string, string] = [linking.sourceId, itemId];
        const viewer = current.find((persona) => persona.id === viewingUserId);
        const exists = viewer?.dependencies.some(([fromId, toId]) =>
          fromId === dependency[0] && toId === dependency[1]
        );
        if (exists) return current;

        const approvalOwner = current.find((persona) =>
          persona.id !== viewingUserId &&
          persona.items.some((item) =>
            (item.id === dependency[0] || item.id === dependency[1]) &&
            item.approvals
          )
        );
        const approvalItem = approvalOwner?.items.find((item) =>
          (item.id === dependency[0] || item.id === dependency[1]) &&
          item.approvals
        );
        const isHighSideLocalEdit = Boolean(
          approvalOwner &&
            approvalItem?.promotion &&
            !approvalItem.demotion &&
            NETWORKS.indexOf(viewer!.network) >
              NETWORKS.indexOf(approvalOwner.network),
        );
        if (approvalOwner && approvalItem && isHighSideLocalEdit) {
          const editedAt = new Date().toISOString();
          return current.map((persona) => {
            const withDependency = persona.id === viewingUserId
              ? {
                ...persona,
                dependencies: [...persona.dependencies, dependency],
              }
              : persona;
            if (persona.id !== approvalOwner.id) return withDependency;
            return {
              ...withDependency,
              items: withDependency.items.map((item) => {
                if (item.id !== approvalItem.id) return item;
                const existing = item.promotedCopies?.[viewingUserId];
                return {
                  ...item,
                  promotedCopies: {
                    ...item.promotedCopies,
                    [viewingUserId]: {
                      start: existing?.start ?? item.start,
                      duration: existing?.duration ?? item.duration,
                      lastSyncedAt: existing?.lastSyncedAt ??
                        item.lastSyncedAt ??
                        editedAt,
                      outOfSync: true,
                      differences: Array.from(
                        new Set([
                          ...(existing?.differences ?? []),
                          "Dependency timing differs from the source schedule",
                          "Local edit has not propagated to lower networks",
                        ]),
                      ),
                      lastLocalEditAt: editedAt,
                      localDependencies: [
                        ...(existing?.localDependencies ?? []),
                        dependency,
                      ],
                    },
                  },
                };
              }),
            };
          });
        }
        if (approvalOwner && approvalItem) {
          return current.map((persona) =>
            persona.id === approvalOwner.id
              ? {
                ...persona,
                items: persona.items.map((item) => {
                  if (item.id !== approvalItem.id) return item;
                  const alreadyPending = item.pendingApprovals?.some(
                    (request) =>
                      request.kind === "dependency" &&
                      request.editorUserId === viewingUserId &&
                      request.dependency?.[0] === dependency[0] &&
                      request.dependency?.[1] === dependency[1],
                  );
                  if (alreadyPending) return item;
                  return {
                    ...item,
                    pendingApprovals: [
                      ...(item.pendingApprovals ?? []),
                      {
                        id:
                          `approval-dependency-${viewingUserId}-${Date.now()}`,
                        editorUserId: viewingUserId,
                        kind: "dependency",
                        dependency,
                        dependencyPersonaId: viewingUserId,
                        submittedAt: new Date().toISOString(),
                      },
                    ],
                  };
                }),
              }
              : persona
          );
        }

        return current.map((persona) =>
          persona.id === viewingUserId
            ? {
              ...persona,
              dependencies: [...persona.dependencies, dependency],
            }
            : persona
        );
      });
      setLinking(null);
      return;
    }
    if (ownerId !== viewingUserId) {
      setModal({
        type: "access",
        userId: ownerId,
        itemId,
        viewingUserId,
      });
      return;
    }
    setModal({ type: "access", userId: viewingUserId, itemId });
  }

  function exportScenario() {
    const blob = new Blob([JSON.stringify({ version: 1, personas }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `data-motion-scenario-${
      new Date().toISOString().slice(0, 10)
    }.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importScenario(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const value = JSON.parse(text);
        if (Array.isArray(value.personas)) {
          setPersonas(normalizeApprovalBoundaries(value.personas.slice(0, 6)));
        }
      } catch {
        window.alert("That file is not a valid Data Motion scenario.");
      }
    });
    event.target.value = "";
  }

  function resetScenario() {
    if (
      !window.confirm(
        "Reset every browser, schedule, permission, and approval to its original state?",
      )
    ) {
      return;
    }
    setPersonas(createDefaultPersonas());
    setModal(null);
    setLinking(null);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <GitBranch size={20} />
          </div>
          <div>
            <strong>DATA MOTION</strong>
            <span>Federated schedule sandbox</span>
          </div>
        </div>
        <div className="topbar-status">
          <span className="status-dot" />
          {savedAt ? `Saved locally · ${savedAt}` : "Local scenario"}
        </div>
        <div className="topbar-actions">
          <button className="icon-button labelled" onClick={resetScenario}>
            <RotateCcw size={16} /> Reset
          </button>
          <button
            className="icon-button labelled"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={16} /> Import
          </button>
          <button className="icon-button labelled" onClick={exportScenario}>
            <Download size={16} /> Export
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={importScenario}
          />
        </div>
      </header>

      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              Scenario workspace · {personas.length}/6 sessions
            </div>
            <h1>
              See how work moves<br />across boundaries.
            </h1>
          </div>
          <div className="intro-side">
            <p>
              Configure independent user sessions, then test schedule access,
              release controls, and cross-network propagation.
            </p>
            <div className="network-legend">
              {NETWORKS.map((network, index) => (
                <span key={network}>
                  <i data-level={index} />
                  {network}
                </span>
              ))}
            </div>
          </div>
        </section>

        {linking && (
          <div className="linking-banner">
            <Link2 size={16} />
            Choose a destination item in the same window.
            <button onClick={() => setLinking(null)}>Cancel</button>
          </div>
        )}

        <section className="browser-grid">
          {personas.map((persona, index) => (
            <BrowserWindow
              key={persona.id}
              persona={persona}
              index={index}
              sharedItems={personas.flatMap((source) =>
                source.id === persona.id ? [] : source.items
                  .flatMap((item) => {
                    const recipientLevel = NETWORKS.indexOf(persona.network);
                    const sourceLevel = NETWORKS.indexOf(source.network);
                    const hasOriginAccess = item.access.some((entry) =>
                      entry.userId === persona.id &&
                      entry.permission !== "none"
                    );
                    const isDemotedCopy = hasOriginAccess &&
                      recipientLevel < sourceLevel &&
                      item.destination === persona.network &&
                      Boolean(item.demotion || item.demotedSnapshot);
                    const promotionCandidates = getPromotionCandidates(
                      item,
                      source,
                      persona,
                      personas,
                    );
                    const isPromotedCopy = promotionCandidates.length > 0;
                    if (!isDemotedCopy && !isPromotedCopy) return [];
                    const promotedSnapshot = item.promotedCopies?.[persona.id];
                    const inheritedPromotionState = promotionCandidates[0];
                    const displayedItem = isDemotedCopy && item.demotedSnapshot
                      ? {
                        ...item,
                        ...item.demotedSnapshot,
                        pendingApprovals: [],
                        demotionOutOfSync: false,
                      }
                      : isPromotedCopy && promotedSnapshot
                      ? {
                        ...item,
                        ...promotedSnapshot,
                        pendingApprovals: [],
                      }
                      : isPromotedCopy && inheritedPromotionState
                      ? {
                        ...item,
                        start: inheritedPromotionState.start,
                        duration: inheritedPromotionState.duration,
                        lastSyncedAt: inheritedPromotionState.lastSyncedAt,
                        pendingApprovals: [],
                      }
                      : item;
                    return [{
                      item: displayedItem,
                      ownerId: source.id,
                      ownerName: source.name,
                      origin: source.network,
                      copyType: (isDemotedCopy ? "demoted" : "promoted") as
                        | "demoted"
                        | "promoted",
                      copyOutOfSync: isPromotedCopy &&
                        Boolean(
                          promotedSnapshot?.outOfSync ??
                            inheritedPromotionState?.outOfSync,
                        ),
                      differences: isPromotedCopy
                        ? promotedSnapshot?.differences ??
                          inheritedPromotionState?.differences ??
                          []
                        : [],
                      promotionConflict: isPromotedCopy &&
                        promotionCandidates.length > 1 &&
                        promotedSnapshot?.reconciledCandidateSignature !==
                          promotionCandidateSignature(promotionCandidates),
                      promotionCandidates,
                      permission: isPromotedCopy
                        ? promotionCandidates.some((candidate) =>
                            candidate.permission === "write"
                          )
                          ? "write" as Permission
                          : "read" as Permission
                        : item.access.find((entry) =>
                          entry.userId === persona.id
                        )?.permission ?? "read",
                    }];
                  })
              )}
              isLinking={linking?.userId === persona.id}
              linkingSource={linking?.sourceId}
              onConfigure={() =>
                setModal({ type: "settings", userId: persona.id })}
              onRemove={() => removePersona(persona.id)}
              onItemClick={(itemId, ownerId, canWrite) =>
                handleItemClick(persona.id, itemId, ownerId, canWrite)}
              onMoveItem={moveItem}
              onStartLink={(sourceId) =>
                setLinking({ userId: persona.id, sourceId })}
            />
          ))}
          {personas.length < 6 && (
            <button className="add-window" onClick={addPersona}>
              <span>
                <Plus size={22} />
              </span>
              <strong>Add browser window</strong>
              <small>Create another user perspective</small>
            </button>
          )}
        </section>
      </main>

      <footer>
        <span>DATA MOTION / PROTOTYPE 0.1</span>
        <span>
          <LockKeyhole size={13} /> Data stays in this browser
        </span>
      </footer>

      {modal?.type === "settings" && (
        <SettingsModal
          persona={personas.find((persona) => persona.id === modal.userId)!}
          onClose={() => setModal(null)}
          onUpdate={(patch) => updatePersona(modal.userId, patch)}
        />
      )}
      {modal?.type === "access" && accessModal?.user && accessModal.item && (
        <AccessModal
          owner={accessModal.user}
          item={accessModal.item}
          personas={personas}
          viewingUser={accessModal.viewingUser}
          onClose={() => setModal(null)}
          onResolveSyncConflict={(resolution) =>
            accessModal.viewingUser &&
            resolveSyncConflict(
              accessModal.user!.id,
              accessModal.item!.id,
              accessModal.viewingUser.id,
              resolution,
            )}
          onReconcilePromotion={(stateId) =>
            accessModal.viewingUser &&
            reconcilePromotionState(
              accessModal.user!.id,
              accessModal.item!.id,
              accessModal.viewingUser.id,
              stateId,
            )}
          onSyncToDemotedState={() =>
            syncToDemotedState(
              accessModal.user!.id,
              accessModal.item!.id,
            )}
          onResolveApproval={(requestId, approved) =>
            resolveApproval(
              accessModal.user!.id,
              accessModal.item!.id,
              requestId,
              approved,
            )}
          onUpdateCopy={(patch) =>
            accessModal.viewingUser &&
            updatePromotedCopy(
              accessModal.user!.id,
              accessModal.item!.id,
              accessModal.viewingUser.id,
              patch,
            )}
          onUpdate={(patch) =>
            updateItem(accessModal.user!.id, accessModal.item!.id, patch)}
        />
      )}
    </div>
  );
}

function BrowserWindow({
  persona,
  index,
  sharedItems,
  isLinking,
  linkingSource,
  onConfigure,
  onRemove,
  onItemClick,
  onMoveItem,
  onStartLink,
}: {
  persona: Persona;
  index: number;
  sharedItems: {
    item: ScheduleItem;
    ownerId: string;
    ownerName: string;
    origin: Network;
    copyType: "promoted" | "demoted";
    copyOutOfSync: boolean;
    differences: string[];
    promotionConflict: boolean;
    promotionCandidates: PromotionCandidate[];
    permission: Permission;
  }[];
  isLinking: boolean;
  linkingSource?: string;
  onConfigure: () => void;
  onRemove: () => void;
  onItemClick: (
    itemId: string,
    ownerId?: string,
    canWrite?: boolean,
  ) => void;
  onMoveItem: (
    itemId: string,
    delta: number,
    ownerId: string,
    editorUserId: string,
    requiresApproval: boolean,
    copyType?: "promoted" | "demoted" | null,
  ) => void;
  onStartLink: (itemId: string) => void;
}) {
  const dragRef = useRef<
    {
      itemId: string;
      lastX: number;
      trackWidth: number;
      moved: boolean;
      ownerId: string;
      requiresApproval: boolean;
      copyType: "promoted" | "demoted" | null;
    } | null
  >(null);
  const suppressClickRef = useRef<string | null>(null);
  const timelineItems = [
    ...persona.items.map((item) => ({
      item,
      isOffNetwork: false,
      canWrite: true,
      ownerId: persona.id,
      ownerName: persona.name,
      origin: persona.network,
      copyType: null,
      copyOutOfSync: false,
      differences: [],
      promotionConflict: false,
      promotionCandidates: [],
      permission: "owner" as Permission,
    })),
    ...sharedItems.map(
      ({
        item,
        ownerId,
        ownerName,
        origin,
        copyType,
        copyOutOfSync,
        differences,
        promotionConflict,
        promotionCandidates,
        permission,
      }) => ({
        item,
        isOffNetwork: true,
        canWrite: permission === "write",
        ownerId,
        ownerName,
        origin,
        copyType,
        copyOutOfSync,
        differences,
        promotionConflict,
        promotionCandidates,
        permission,
      }),
    ),
  ];

  function applyDragPosition(clientX: number) {
    const drag = dragRef.current;
    if (!drag || clientX <= 0) return;
    const pixelDelta = clientX - drag.lastX;
    if (Math.abs(pixelDelta) < 1) return;
    drag.moved = true;
    drag.lastX = clientX;
    onMoveItem(
      drag.itemId,
      (pixelDelta / drag.trackWidth) * 100,
      drag.ownerId,
      persona.id,
      drag.requiresApproval,
      drag.copyType,
    );
  }

  function markDragComplete() {
    const drag = dragRef.current;
    if (drag?.moved) {
      suppressClickRef.current = drag.itemId;
      window.setTimeout(() => {
        if (suppressClickRef.current === drag.itemId) {
          suppressClickRef.current = null;
        }
      }, 0);
    }
    dragRef.current = null;
  }

  function startDrag(
    event: React.MouseEvent<HTMLButtonElement>,
    itemId: string,
    canWrite: boolean,
    ownerId: string,
    requiresApproval: boolean,
    copyType: "promoted" | "demoted" | null,
  ) {
    if (!canWrite) return;
    const trackWidth = event.currentTarget.parentElement?.clientWidth ?? 1;
    dragRef.current = {
      itemId,
      lastX: event.clientX,
      trackWidth,
      moved: false,
      ownerId,
      requiresApproval,
      copyType,
    };

    const continueDrag = (moveEvent: MouseEvent) => {
      if (dragRef.current?.itemId !== itemId) return;
      applyDragPosition(moveEvent.clientX);
    };

    const finishDrag = () => {
      markDragComplete();
      window.removeEventListener("mousemove", continueDrag);
      window.removeEventListener("mouseup", finishDrag);
    };

    window.addEventListener("mousemove", continueDrag);
    window.addEventListener("mouseup", finishDrag, { once: true });
  }

  function openItem(
    itemId: string,
    ownerId: string,
    canWrite: boolean,
  ) {
    if (suppressClickRef.current === itemId) return;
    onItemClick(itemId, ownerId, canWrite);
  }

  return (
    <article
      className={`browser ${isLinking ? "is-linking" : ""}`}
      style={{ "--accent": persona.accent } as React.CSSProperties}
    >
      <div className="browser-chrome">
        <div className="traffic-lights">
          <i />
          <i />
          <i />
        </div>
        <div className="address-bar">
          <ShieldCheck size={12} />{" "}
          data-motion.local/{persona.name.toLowerCase().replace(" ", "-")}
        </div>
        <button className="chrome-more" aria-label="More options">
          <MoreHorizontal size={16} />
        </button>
      </div>
      <div className="browser-header">
        <div className="persona">
          <div className="avatar" style={{ background: persona.accent }}>
            {persona.name.split(" ").map((word) => word[0]).join("")}
          </div>
          <div>
            <strong>{persona.name}</strong>
            <span>{persona.role} · {persona.organization}</span>
          </div>
        </div>
        <div className="window-actions">
          <span
            className={`network-badge level-${
              NETWORKS.indexOf(persona.network)
            }`}
          >
            <LockKeyhole size={10} /> {persona.network}
          </span>
          <button
            onClick={onConfigure}
            aria-label={`Configure ${persona.name}`}
          >
            <Settings2 size={15} />
          </button>
          <button onClick={onRemove} aria-label={`Remove ${persona.name}`}>
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="schedule-toolbar">
        <div>
          <strong>Integrated delivery plan</strong>
          <span>FY26 · Q3–Q4</span>
        </div>
        <div className="schedule-stats">
          <span>{persona.items.length} objects</span>
          {sharedItems.length > 0 && <span>+{sharedItems.length} synced</span>}
          <span>{persona.dependencies.length} links</span>
        </div>
      </div>
      <div className="timeline">
        <div className="months">
          <span>JUL</span>
          <span>AUG</span>
          <span>SEP</span>
          <span>OCT</span>
        </div>
        <div className="today-line">
          <span>15</span>
        </div>
        <svg
          className="dependency-lines"
          viewBox={`0 0 100 ${timelineItems.length * 34}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id={`arrow-${persona.id}`}
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="4"
              markerHeight="4"
              orient="auto"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
          </defs>
          {persona.dependencies.map(([fromId, toId]) => {
            const fromIndex = timelineItems.findIndex(({ item }) =>
              item.id === fromId
            );
            const toIndex = timelineItems.findIndex(({ item }) =>
              item.id === toId
            );
            const from = timelineItems[fromIndex]?.item;
            const to = timelineItems[toIndex]?.item;
            if (!from || !to) return null;
            const startX = Math.min(96, from.start + from.duration);
            const endX = Math.max(2, to.start);
            const startY = fromIndex * 34 + 17;
            const endY = toIndex * 34 + 17;
            const bendX = Math.min(98, Math.max(startX + 4, endX - 4));
            return (
              <path
                key={`${fromId}-${toId}`}
                d={`M ${startX} ${startY} H ${bendX} V ${endY} H ${endX}`}
                markerEnd={`url(#arrow-${persona.id})`}
              />
            );
          })}
        </svg>
        {timelineItems.map((
          {
            item,
            isOffNetwork,
            canWrite,
            ownerId,
            ownerName,
            origin,
            copyType,
            copyOutOfSync,
            differences,
            promotionConflict,
            promotionCandidates,
          },
        ) => (
          <div
            className={`schedule-row ${isOffNetwork ? "off-network-row" : ""}`}
            key={`${ownerName}-${item.id}`}
          >
            <button
              className={`item-label depth-${item.depth} ${
                linkingSource === item.id ? "is-source" : ""
              } ${isOffNetwork ? "is-provenance" : ""}`}
              onClick={() => openItem(item.id, ownerId, canWrite)}
              title={!canWrite
                ? READ_ONLY_REASON
                : isOffNetwork
                ? copyType === "demoted"
                  ? `Synced copy approved for release · Owned by ${ownerName}`
                  : `Synced copy promoted from ${origin} · Owned by ${ownerName}`
                : undefined}
            >
              {isOffNetwork
                ? copyType === "demoted"
                  ? <BadgeCheck size={12} className="provenance-icon release" />
                  : <RefreshCw size={11} className="provenance-icon" />
                : item.depth === 0
                ? <ChevronDown size={13} />
                : item.depth === 1
                ? <ChevronRight size={12} />
                : <span className="branch-glyph">└</span>}
              <span>{item.name}</span>
              {(isOffNetwork || (item.pendingApprovals?.length ?? 0) > 0 ||
                item.demotionOutOfSync || copyOutOfSync ||
                promotionConflict) && (
                <div className="row-statuses">
                  {isOffNetwork && (
                    <small
                      className={`sync-copy-chip ${
                        copyType === "demoted" ? "released" : ""
                      }`}
                    >
                      {copyType === "demoted" ? "Released" : "Synced"}
                    </small>
                  )}
                  {(item.pendingApprovals?.length ?? 0) > 0 && (
                    <span
                      className="pending-approval-icon"
                      title={`${
                        item.pendingApprovals!.length
                      } pending approval`}
                    >
                      <Clock3 size={10} />
                      {item.pendingApprovals!.length}
                    </span>
                  )}
                  {(item.demotionOutOfSync || copyOutOfSync) && (
                    <span
                      className="out-of-sync-icon"
                      title={copyOutOfSync
                        ? `Synced copy is out of sync: ${
                          differences.join("; ")
                        }`
                        : "Lower-network copy is out of sync"}
                    >
                      <TriangleAlert size={10} />
                    </span>
                  )}
                  {promotionConflict && (
                    <span
                      className="promotion-conflict-icon"
                      title={`Conflicting promotion states from ${
                        promotionCandidates.map((candidate) =>
                          candidate.network
                        ).join(" and ")
                      }`}
                    >
                      <TriangleAlert size={10} />
                    </span>
                  )}
                </div>
              )}
            </button>
            <div
              className="track"
              title={!canWrite ? READ_ONLY_REASON : undefined}
            >
              <button
                className={`gantt-bar ${item.depth === 0 ? "parent" : ""} ${
                  canWrite ? "is-draggable" : "is-readonly"
                }`}
                data-item-id={item.id}
                draggable={canWrite}
                style={{
                  left: `${item.start}%`,
                  width: `${item.duration}%`,
                  background: isOffNetwork
                    ? `repeating-linear-gradient(135deg, transparent 0 4px, rgba(16, 19, 16, .35) 4px 7px), ${item.color}`
                    : item.color,
                }}
                onMouseDown={(event) =>
                  startDrag(
                    event,
                    item.id,
                    canWrite,
                    ownerId,
                    item.approvals,
                    copyType,
                  )}
                onDrag={(event) => applyDragPosition(event.clientX)}
                onDragEnd={markDragComplete}
                onClick={() => openItem(item.id, ownerId, canWrite)}
                title={canWrite ? "Drag to reschedule" : READ_ONLY_REASON}
                aria-label={isOffNetwork
                  ? copyType === "demoted"
                    ? `${item.name}, synced copy approved for release`
                    : `${item.name}, synced copy promoted from ${origin}`
                  : `Open sharing controls for ${item.name}`}
              >
                {item.depth < 2 && <span>{Math.round(item.duration / 4)}w
                </span>}
              </button>
              <button
                className={`link-button ${!canWrite ? "is-disabled" : ""}`}
                disabled={!canWrite}
                onClick={() => onStartLink(item.id)}
                title={canWrite ? "Draw dependency" : READ_ONLY_REASON}
              >
                <Link2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="browser-footer">
        <span>
          <span className="live-dot" /> Synced just now
        </span>
        <span>Session 0{index + 1}</span>
      </div>
    </article>
  );
}

function ModalShell({ title, subtitle, onClose, children }: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">{subtitle}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SettingsModal({ persona, onClose, onUpdate }: {
  persona: Persona;
  onClose: () => void;
  onUpdate: (patch: Partial<Persona>) => void;
}) {
  return (
    <ModalShell
      title="Configure user session"
      subtitle="Browser identity"
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="identity-card">
          <div className="avatar large" style={{ background: persona.accent }}>
            {persona.name.split(" ").map((word) => word[0]).join("")}
          </div>
          <div>
            <strong>{persona.name}</strong>
            <span>{persona.role}</span>
          </div>
        </div>
        <label className="field">
          <span>Display name</span>
          <input
            value={persona.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Organization</span>
          <input
            list="organizations"
            value={persona.organization}
            onChange={(event) => onUpdate({ organization: event.target.value })}
          />
          <datalist id="organizations">
            {ORGS.map((org) => <option key={org} value={org} />)}
          </datalist>
        </label>
        <label className="field">
          <span>Network</span>
          <select
            value={persona.network}
            onChange={(event) =>
              onUpdate({ network: event.target.value as Network })}
          >
            {NETWORKS.map((network) => <option key={network}>{network}
            </option>)}
          </select>
        </label>
        <div className="network-scale">
          {NETWORKS.map((network, index) => (
            <div
              key={network}
              className={persona.network === network ? "active" : ""}
            >
              <i data-level={index} />
              <span>{network}</span>
            </div>
          ))}
        </div>
        <div className="info-callout">
          <Info size={15} />{" "}
          Network placement determines valid promotion and demotion
          destinations.
        </div>
      </div>
      <div className="modal-footer">
        <button className="primary-button" onClick={onClose}>
          <Check size={16} /> Done
        </button>
      </div>
    </ModalShell>
  );
}

function AccessModal({
  owner,
  item,
  personas,
  viewingUser,
  onClose,
  onResolveApproval,
  onResolveSyncConflict,
  onReconcilePromotion,
  onSyncToDemotedState,
  onUpdateCopy,
  onUpdate,
}: {
  owner: Persona;
  item: ScheduleItem;
  personas: Persona[];
  viewingUser?: Persona;
  onClose: () => void;
  onResolveApproval: (requestId: string, approved: boolean) => void;
  onResolveSyncConflict: (resolution: "source" | "local") => void;
  onReconcilePromotion: (stateId: string | "local") => void;
  onSyncToDemotedState: () => void;
  onUpdateCopy: (patch: Partial<PromotedCopySnapshot>) => void;
  onUpdate: (patch: Partial<ScheduleItem>) => void;
}) {
  const [showSyncChanges, setShowSyncChanges] = useState(false);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const originLevel = NETWORKS.indexOf(owner.network);
  const isReleasedCopy = Boolean(
    viewingUser &&
      NETWORKS.indexOf(viewingUser.network) < originLevel &&
      item.destination === viewingUser.network &&
      (item.demotion || item.demotedSnapshot),
  );
  const promotionCandidates = viewingUser && !isReleasedCopy
    ? getPromotionCandidates(item, owner, viewingUser, personas)
    : [];
  const promotedCopy = viewingUser && !isReleasedCopy
    ? item.promotedCopies?.[viewingUser.id]
    : undefined;
  const hasPromotionStateConflict = promotionCandidates.length > 1 &&
    promotedCopy?.reconciledCandidateSignature !==
      promotionCandidateSignature(promotionCandidates);
  const differentLowerStates = promotedCopy
    ? promotionCandidates.filter((candidate) =>
      candidate.start !== promotedCopy.start ||
      candidate.duration !== promotedCopy.duration
    )
    : [];
  const isPromotedCopyView = Boolean(
    viewingUser && !isReleasedCopy && promotionCandidates.length > 0,
  );
  const viewerPermission = viewingUser
    ? isPromotedCopyView
      ? promotionCandidates.some((candidate) =>
          candidate.permission === "write"
        )
        ? "write"
        : "read"
      : item.access.find((entry) => entry.userId === viewingUser.id)
        ?.permission ??
        "none"
    : "owner";
  const isReadOnly = Boolean(
    viewingUser && viewerPermission !== "write",
  );
  const canManagePromotion = !viewingUser ||
    (isPromotedCopyView && !isReadOnly);
  const accessOwner = isPromotedCopyView && viewingUser ? viewingUser : owner;
  const activeAccess = isPromotedCopyView
    ? promotedCopy?.access ?? []
    : item.access;
  const others = personas.filter((persona) => persona.id !== accessOwner.id);
  const lowerNetworkOwners = (() => {
    if (!isPromotedCopyView) return [];
    const entries: { persona: Persona; label: string }[] = [];
    const addEntry = (persona: Persona, label: string) => {
      if (
        persona.id === accessOwner.id ||
        NETWORKS.indexOf(persona.network) >=
          NETWORKS.indexOf(accessOwner.network) ||
        entries.some((entry) => entry.persona.id === persona.id)
      ) {
        return;
      }
      entries.push({ persona, label });
    };
    addEntry(owner, "Source Owner");
    promotionCandidates.forEach((candidate) => {
      const holder = personas.find((persona) =>
        persona.id === candidate.holderUserId
      );
      if (holder && holder.id !== owner.id) {
        addEntry(holder, `${holder.network} owner`);
      }
    });
    return entries;
  })();
  const hasSourceConflict = Boolean(
    promotedCopy?.differences.includes(
      "Source schedule changed after the local edit",
    ),
  );
  const displayedSyncTime = isReleasedCopy
    ? item.demotedSnapshot?.lastSyncedAt ?? item.lastSyncedAt
    : promotedCopy?.lastSyncedAt ?? item.lastSyncedAt;
  const visibleApprovals = (item.pendingApprovals ?? []).filter((request) =>
    !isHighSideOnlyRequest(request, item, owner, personas) &&
    (!viewingUser || request.editorUserId === viewingUser.id)
  );
  const destinations = NETWORKS.filter((_, index) => index < originLevel);
  const allItems = personas.flatMap((persona) => persona.items);
  const connections = personas
    .flatMap((persona) => persona.dependencies)
    .filter(([fromId, toId]) => fromId === item.id || toId === item.id)
    .map(([fromId, toId]) => ({
      direction: fromId === item.id ? "outgoing" : "incoming",
      other: allItems.find((entry) =>
        entry.id === (fromId === item.id ? toId : fromId)
      ),
    }))
    .filter((connection) => connection.other);
  const grantedPeople = others.filter((persona) => {
    if (
      lowerNetworkOwners.some((entry) => entry.persona.id === persona.id)
    ) {
      return false;
    }
    const permission = activeAccess.find((entry) => entry.userId === persona.id)
      ?.permission;
    return permission === "read" || permission === "write";
  });
  const availablePeople = others.filter((persona) =>
    !grantedPeople.some((granted) => granted.id === persona.id) &&
    !lowerNetworkOwners.some((entry) => entry.persona.id === persona.id)
  );

  function updateLocalCopy(patch: Partial<PromotedCopySnapshot>) {
    const inherited = promotionCandidates[0];
    onUpdateCopy({
      start: promotedCopy?.start ?? inherited?.start ?? item.start,
      duration: promotedCopy?.duration ?? inherited?.duration ?? item.duration,
      lastSyncedAt: promotedCopy?.lastSyncedAt ??
        inherited?.lastSyncedAt ??
        item.lastSyncedAt ??
        new Date().toISOString(),
      promotedFromUserId: promotedCopy?.promotedFromUserId ??
        inherited?.holderUserId,
      ...patch,
    });
  }

  function setAccess(userId: string, permission: Permission) {
    if (isReadOnly) return;
    const access = [
      ...activeAccess.filter((entry) => entry.userId !== userId),
      {
        userId,
        permission,
      },
    ];
    if (isPromotedCopyView) {
      updateLocalCopy({ access });
    } else {
      onUpdate({ access });
    }
  }

  function toggleSelectedPerson(userId: string) {
    setSelectedPeople((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  }

  function addSelectedPeople() {
    if (isReadOnly || selectedPeople.length === 0) return;
    const access = [
      ...activeAccess.filter((entry) => !selectedPeople.includes(entry.userId)),
      ...selectedPeople.map((userId) => ({
        userId,
        permission: "read" as Permission,
      })),
    ];
    if (isPromotedCopyView) {
      updateLocalCopy({ access });
    } else {
      onUpdate({
        access,
      });
    }
    setSelectedPeople([]);
    setShowPeoplePicker(false);
  }

  function applyControlsAndClose() {
    if (selectedPeople.length > 0) {
      addSelectedPeople();
    }
    onClose();
  }

  function setMovement(kind: "promotion" | "demotion", enabled: boolean) {
    if (isReadOnly) return;
    if (kind === "promotion" && viewingUser && !isPromotedCopyView) return;
    if (kind === "demotion" && viewingUser) return;
    if (kind === "demotion" && !item.approvals && enabled) return;
    if (kind === "promotion" && isPromotedCopyView) {
      updateLocalCopy({ promotion: enabled });
      return;
    }
    const valid = NETWORKS.filter((_, index) =>
      kind === "promotion" ? index > originLevel : index < originLevel
    );
    onUpdate({
      promotion: kind === "promotion" ? enabled : false,
      demotion: kind === "demotion" ? enabled : false,
      destination: valid[0] ?? owner.network,
    });
  }

  return (
    <ModalShell
      title={item.name}
      subtitle={isReleasedCopy && viewingUser
        ? `${
          referenceId(owner, item, viewingUser.network)
        } · Released synced copy · Owned by ${owner.name}`
        : `${
          referenceId(owner, item)
        } · ${owner.network} object · Owned by ${owner.name}`}
      onClose={onClose}
    >
      <div className="modal-body access-body">
        {isReadOnly && (
          <div className="read-only-banner" title={READ_ONLY_REASON}>
            <LockKeyhole size={16} />
            <div>
              <strong>View-only access</strong>
              <span>
                You can inspect this object, but editing, sharing, approvals,
                and dependencies are locked.
              </span>
            </div>
          </div>
        )}
        {viewingUser && (
          <>
            <div className="provenance-banner">
              {isReleasedCopy
                ? <BadgeCheck size={18} />
                : <RefreshCw size={17} />}
              <div className="provenance-copy">
                <strong>
                  {isReleasedCopy
                    ? "Approved for release"
                    : "Promoted synced copy"}
                </strong>
                <span>
                  {isReleasedCopy
                    ? `This synced copy was approved for release into ${viewingUser.network}. Source network details are withheld.`
                    : `Synced from ${owner.network} into this higher environment. Owned by ${owner.name} · ${owner.organization}.`}
                </span>
                <small>
                  Last synced · {formatSyncTime(displayedSyncTime)}
                </small>
              </div>
              <div className="sync-actions">
                <span className="origin-chip">
                  {isReleasedCopy ? "Released copy" : `${owner.network} source`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSyncChanges((current) => !current)}
                >
                  {showSyncChanges ? "Hide changes" : "View changes"}
                </button>
              </div>
            </div>
            {showSyncChanges && (
              <div className="sync-change-summary">
                <RefreshCw size={14} />
                <div>
                  <strong>Latest synchronized change</strong>
                  <span>
                    Schedule dates and rigid dependencies were reconciled across
                    authorized copies on {formatSyncTime(displayedSyncTime)}.
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        {isPromotedCopyView && hasPromotionStateConflict &&
          !promotedCopy?.outOfSync && (
          <div className="promotion-state-conflict">
            <div className="promotion-conflict-heading">
              <TriangleAlert size={17} />
              <div>
                <strong>Conflicting promotion states</strong>
                <span>
                  This copy receives updates through multiple promotion paths.
                  Choose a state to reconcile, or keep an independent state on
                  this network.
                </span>
              </div>
            </div>
            <div className="promotion-state-list">
              {promotionCandidates.map((candidate) => (
                <div className="promotion-state-option" key={candidate.stateId}>
                  <div>
                    <strong>{candidate.network} state</strong>
                    <span>
                      {candidate.holderName} · Last synced{" "}
                      {formatSyncTime(candidate.lastSyncedAt)} · Starts at{" "}
                      {Math.round(candidate.start)}% ·{" "}
                      {Math.round(candidate.duration / 4)}w
                    </span>
                  </div>
                  <button
                    disabled={isReadOnly}
                    title={isReadOnly ? READ_ONLY_REASON : undefined}
                    onClick={() =>
                      onReconcilePromotion(candidate.stateId)}
                  >
                    Sync to this state
                  </button>
                </div>
              ))}
            </div>
            <button
              className="create-local-state"
              disabled={isReadOnly}
              title={isReadOnly ? READ_ONLY_REASON : undefined}
              onClick={() => onReconcilePromotion("local")}
            >
              Keep or create my own state
            </button>
          </div>
        )}
        {promotedCopy?.outOfSync && (
          <div className="out-of-sync-banner copy-divergence">
            <TriangleAlert size={17} />
            <div>
              <strong>
                {hasSourceConflict
                  ? "The low-side source changed"
                  : "This synced copy is out of sync"}
              </strong>
              <span>
                {hasSourceConflict
                  ? "The source changed after your local edit. Choose which version to keep on this network."
                  : "Your higher-network edit remains local because demotion is off. Nothing was sent to lower networks."}
              </span>
              <ul>
                {promotedCopy.differences.map((difference) => (
                  <li key={difference}>{difference}</li>
                ))}
              </ul>
              {differentLowerStates.length > 0 && (
                <>
                  <strong className="version-list-title">
                    Available lower-network versions
                  </strong>
                  <div className="promotion-state-list embedded">
                    {differentLowerStates.map((candidate) => (
                      <div
                        className="promotion-state-option"
                        key={candidate.stateId}
                      >
                        <div>
                          <strong>{candidate.network} state</strong>
                          <span>
                            {candidate.holderName} · Starts at{" "}
                            {Math.round(candidate.start)}% ·{" "}
                            {Math.round(candidate.duration / 4)}w · Updated{" "}
                            {formatSyncTime(candidate.lastSyncedAt)}
                          </span>
                        </div>
                        <button
                          disabled={isReadOnly}
                          title={isReadOnly ? READ_ONLY_REASON : undefined}
                          onClick={() =>
                            onReconcilePromotion(candidate.stateId)}
                        >
                          Sync to this state
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div
                className="conflict-actions"
                title={isReadOnly ? READ_ONLY_REASON : undefined}
              >
                <button
                  className="keep-local"
                  disabled={isReadOnly}
                  title={isReadOnly ? READ_ONLY_REASON : undefined}
                  onClick={() => onReconcilePromotion("local")}
                >
                  <Check size={11} /> Keep my current state
                </button>
              </div>
            </div>
          </div>
        )}
        {item.demotionOutOfSync && !isReleasedCopy && (
          <div className="out-of-sync-banner">
            <TriangleAlert size={17} />
            <div>
              <strong>Lower-network copy is out of sync</strong>
              <span>
                Demotion is off, so recent changes were not released to lower
                networks. Enable demotion to synchronize the approved copy.
              </span>
              {item.demotedSnapshot && (
                <>
                  <strong className="version-list-title">
                    Available lower-network version
                  </strong>
                  <div className="promotion-state-list embedded">
                    <div className="promotion-state-option">
                      <div>
                        <strong>{item.destination} released state</strong>
                        <span>
                          Approved copy · Starts at{" "}
                          {Math.round(item.demotedSnapshot.start)}% ·{" "}
                          {Math.round(item.demotedSnapshot.duration / 4)}w ·
                          Updated{" "}
                          {formatSyncTime(item.demotedSnapshot.lastSyncedAt)}
                        </span>
                      </div>
                      <button
                        disabled={Boolean(viewingUser)}
                        title={viewingUser
                          ? OWNER_ONLY_DEMOTION_REASON
                          : undefined}
                        onClick={onSyncToDemotedState}
                      >
                        Sync to this state
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {(item.approvals || visibleApprovals.length > 0) && (
          <section className="control-section approval-queue">
            <div className="section-heading">
              <div>
                <Clock3 size={17} />
                <div>
                  <strong>Change approvals</strong>
                  <span>
                    {viewingUser
                      ? "Changes wait for the owner before syncing."
                      : "Review changes submitted by editors."}
                  </span>
                </div>
              </div>
              <span className="count-chip">{visibleApprovals.length}</span>
            </div>
            <div className="approval-list">
              {visibleApprovals.length === 0
                ? (
                  <span className="empty-connections">
                    No changes awaiting approval
                  </span>
                )
                : visibleApprovals.map((request) => {
                  const editor = personas.find((persona) =>
                    persona.id === request.editorUserId
                  );
                  const delta = (request.requestedStart ?? item.start) -
                    item.start;
                  const days = Math.max(1, Math.round(Math.abs(delta) * 1.2));
                  return (
                    <div className="approval-row" key={request.id}>
                      <div
                        className="mini-avatar"
                        style={{ background: editor?.accent }}
                      >
                        {editor?.name[0] ?? "E"}
                      </div>
                      <div className="approval-detail">
                        <strong>{editor?.name ?? "Editor"}</strong>
                        <span>
                          {request.kind === "dependency"
                            ? "Add dependency"
                            : `Move ${days} days ${
                              delta >= 0 ? "later" : "earlier"
                            }`} · Sent {formatSyncTime(request.submittedAt)}
                        </span>
                      </div>
                      {viewingUser
                        ? (
                          <span className="awaiting-chip">
                            <Clock3 size={9} /> Awaiting owner
                          </span>
                        )
                        : (
                          <div className="approval-actions">
                            <button
                              className="deny"
                              onClick={() =>
                                onResolveApproval(request.id, false)}
                            >
                              <X size={12} /> Deny
                            </button>
                            <button
                              className="approve"
                              onClick={() =>
                                onResolveApproval(request.id, true)}
                            >
                              <Check size={12} /> Approve
                            </button>
                          </div>
                        )}
                    </div>
                  );
                })}
            </div>
          </section>
        )}
        <section
          className={`control-section ${isReadOnly ? "permission-locked" : ""}`}
          title={isReadOnly ? READ_ONLY_REASON : undefined}
        >
          <div className="section-heading">
            <div>
              <Users size={17} />
              <div>
                <strong>Access</strong>
                <span>Choose who can see or change this object.</span>
              </div>
            </div>
            <button
              className="add-people-button"
              disabled={isReadOnly || availablePeople.length === 0}
              title={isReadOnly
                ? READ_ONLY_REASON
                : availablePeople.length === 0
                ? "All available users have been added."
                : "Add collaborators"}
              onClick={() => setShowPeoplePicker((current) => !current)}
            >
              <Plus size={12} /> Add people <ChevronDown size={11} />
            </button>
          </div>
          {showPeoplePicker && !isReadOnly && (
            <div className="people-picker">
              <div className="people-picker-heading">
                <strong>Select collaborators</strong>
                <span>{selectedPeople.length} selected</span>
              </div>
              <div className="people-picker-list">
                {availablePeople.map((persona) => (
                  <label className="people-picker-option" key={persona.id}>
                    <input
                      type="checkbox"
                      checked={selectedPeople.includes(persona.id)}
                      onChange={() =>
                        toggleSelectedPerson(persona.id)}
                    />
                    <div
                      className="mini-avatar"
                      style={{ background: persona.accent }}
                    >
                      {persona.name[0]}
                    </div>
                    <div className="access-person">
                      <strong>
                        {persona.name}
                        {viewingUser?.id === persona.id ? " (you)" : ""}
                      </strong>
                      <span>{persona.organization} · {persona.network}</span>
                    </div>
                    {selectedPeople.includes(persona.id) && <Check size={13} />}
                  </label>
                ))}
              </div>
              <div className="people-picker-footer">
                <button onClick={() => setShowPeoplePicker(false)}>
                  Cancel
                </button>
                <button
                  className="add-selected"
                  disabled={selectedPeople.length === 0}
                  onClick={addSelectedPeople}
                >
                  Add selected ({selectedPeople.length})
                </button>
              </div>
            </div>
          )}
          <div className="access-list">
            <div className="access-row owner-row">
              <div
                className="mini-avatar"
                style={{ background: accessOwner.accent }}
              >
                {accessOwner.name[0]}
              </div>
              <div className="access-person">
                <strong>
                  {accessOwner.name}
                  {(!viewingUser || viewingUser.id === accessOwner.id)
                    ? " (you)"
                    : ""}
                </strong>
                <span>{accessOwner.organization}</span>
              </div>
              <span className="owner-chip">
                {isPromotedCopyView
                  ? `${accessOwner.network} copy owner`
                  : "Source owner"}
              </span>
            </div>
            {lowerNetworkOwners.map(({ persona, label }) => (
              <div className="access-row lineage-owner-row" key={persona.id}>
                <div
                  className="mini-avatar"
                  style={{ background: persona.accent }}
                >
                  {persona.name[0]}
                </div>
                <div className="access-person">
                  <strong>{persona.name}</strong>
                  <span>{persona.organization} · {persona.network}</span>
                </div>
                <span className="lineage-chip">{label}</span>
              </div>
            ))}
            {grantedPeople.length === 0 &&
              lowerNetworkOwners.length === 0 && (
              <span className="empty-collaborators">
                No collaborators added yet.
              </span>
            )}
            {grantedPeople.map((persona) => {
              const permission = activeAccess.find((entry) =>
                entry.userId === persona.id
              )?.permission ?? "read";
              return (
                <div className="access-row" key={persona.id}>
                  <div
                    className="mini-avatar"
                    style={{ background: persona.accent }}
                  >
                    {persona.name[0]}
                  </div>
                  <div className="access-person">
                    <strong>
                      {persona.name}
                      {viewingUser?.id === persona.id ? " (you)" : ""}
                    </strong>
                    <span>{persona.organization} · {persona.network}</span>
                  </div>
                  <select
                    disabled={isReadOnly}
                    title={isReadOnly ? READ_ONLY_REASON : undefined}
                    value={permission}
                    onChange={(event) =>
                      setAccess(persona.id, event.target.value as Permission)}
                  >
                    <option value="none">Remove access</option>
                    <option value="read">Viewer</option>
                    <option value="write">Editor</option>
                  </select>
                </div>
              );
            })}
          </div>
        </section>

        <section
          className={`control-section dependency-section ${
            isReadOnly ? "permission-locked" : ""
          }`}
          title={isReadOnly
            ? "View-only access: dependencies can be inspected but not created or changed."
            : undefined}
        >
          <div className="section-heading">
            <div>
              <GitBranch size={17} />
              <div>
                <strong>Dependencies</strong>
                <span>Connections to and from this object.</span>
              </div>
            </div>
            <span className="count-chip">{connections.length}</span>
          </div>
          <div className="connection-list">
            {connections.length === 0
              ? (
                <span className="empty-connections">
                  No dependency connections
                </span>
              )
              : connections.map((connection) => (
                <div
                  className="connection-row"
                  key={`${connection.direction}-${connection.other!.id}`}
                >
                  <span className={`direction-icon ${connection.direction}`}>
                    {connection.direction === "outgoing" ? "→" : "←"}
                  </span>
                  <div>
                    <strong>{connection.other!.name}</strong>
                    <span>
                      {connection.direction === "outgoing"
                        ? "This object blocks"
                        : "Blocks this object"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </section>

        <section
          className={`control-section policy ${
            viewingUser ? "permission-locked" : ""
          }`}
          title={viewingUser
            ? isReadOnly ? READ_ONLY_REASON : OWNER_ONLY_APPROVAL_REASON
            : undefined}
        >
          <div className="section-heading">
            <div>
              <ShieldCheck size={17} />
              <div>
                <strong>Owner approvals</strong>
                <span>
                  Route editor changes to the owner before publishing.
                </span>
              </div>
            </div>
            <Toggle
              label="Owner approvals"
              disabled={Boolean(viewingUser)}
              disabledReason={isReadOnly
                ? READ_ONLY_REASON
                : OWNER_ONLY_APPROVAL_REASON}
              checked={item.approvals}
              onChange={(approvals) =>
                !viewingUser &&
                onUpdate({
                  approvals,
                  promotion: item.promotion,
                  demotion: approvals ? item.demotion : false,
                })}
            />
          </div>
        </section>

        <section
          className={`control-section policy ${
            !canManagePromotion ? "permission-locked" : ""
          }`}
          title={!canManagePromotion
            ? isReadOnly ? READ_ONLY_REASON : OWNER_ONLY_PROMOTION_REASON
            : undefined}
        >
          <div className="section-heading">
            <div>
              <ArrowUpToLine size={17} />
              <div>
                <strong>Promotion</strong>
                <span>Propagate origin changes to a higher network.</span>
              </div>
            </div>
            <Toggle
              label="Promotion"
              disabled={!canManagePromotion ||
                NETWORKS.indexOf(accessOwner.network) === 4}
              disabledReason={!canManagePromotion
                ? isReadOnly ? READ_ONLY_REASON : OWNER_ONLY_PROMOTION_REASON
                : undefined}
              checked={isPromotedCopyView
                ? promotedCopy?.promotion ?? false
                : item.promotion}
              onChange={(next) => setMovement("promotion", next)}
            />
          </div>
        </section>

        <section
          className={`control-section policy ${
            !item.approvals || viewingUser ? "disabled-section" : ""
          }`}
          title={viewingUser
            ? isReadOnly ? READ_ONLY_REASON : OWNER_ONLY_DEMOTION_REASON
            : undefined}
        >
          <div className="section-heading">
            <div>
              <ArrowDownToLine size={17} />
              <div>
                <strong>Demotion</strong>
                <span>Propagate this object to a lower network.</span>
              </div>
            </div>
            <Toggle
              label="Demotion"
              disabled={Boolean(viewingUser) || !item.approvals ||
                originLevel === 0}
              disabledReason={viewingUser
                ? isReadOnly ? READ_ONLY_REASON : OWNER_ONLY_DEMOTION_REASON
                : undefined}
              checked={item.demotion}
              onChange={(next) => setMovement("demotion", next)}
            />
          </div>
        </section>

        {item.demotion && (
          <label
            className={`field destination-field ${
              isReadOnly ? "permission-locked" : ""
            }`}
            title={isReadOnly ? READ_ONLY_REASON : undefined}
          >
            <span>Destination network</span>
            <select
              disabled={isReadOnly}
              value={item.destination}
              onChange={(event) =>
                onUpdate({ destination: event.target.value as Network })}
            >
              {destinations.map((network) => (
                <option key={network}>{network}</option>
              ))}
            </select>
            <small>
              Recipients with access will see its off-network provenance.
            </small>
          </label>
        )}
        {!item.approvals && (
          <div className="info-callout">
            <LockKeyhole size={15} />{" "}
            Turn on owner approvals to enable demotion.
          </div>
        )}
      </div>
      <div className="modal-footer">
        <span>
          {isReadOnly
            ? (
              <>
                <LockKeyhole size={14} /> View-only access
              </>
            )
            : (
              <>
                <Save size={14} /> Changes save automatically
              </>
            )}
        </span>
        <button className="primary-button" onClick={applyControlsAndClose}>
          <Check size={16} /> {isReadOnly ? "Done" : "Apply controls"}
        </button>
      </div>
    </ModalShell>
  );
}

export default App;
