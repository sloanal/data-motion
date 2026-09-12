import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpToLine,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  GitBranch,
  History,
  Info,
  Link2,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Shield,
  ShieldCheck,
  TriangleAlert,
  Upload,
  Users,
  Waypoints,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { CHANGELOG } from "./changelog";

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

type DemotionApprovalRequest = {
  id: string;
  kind: "enable" | "schedule" | "dependency";
  submittedByUserId: string;
  submittedAt: string;
  requestedStart?: number;
  dependency?: [string, string];
  dependencyPersonaId?: string;
  clearsDemotionOutOfSync?: boolean;
};

type DemotedSnapshot = {
  start: number;
  duration: number;
  lastSyncedAt: string;
};

type PromotedCopySnapshot = DemotedSnapshot & {
  copyKind?: "promoted" | "demoted";
  outOfSync: boolean;
  differences: string[];
  lastLocalEditAt?: string;
  localDependencies?: [string, string][];
  access?: Access[];
  promotion?: boolean;
  promotedFromUserId?: string;
  reconciledCandidateSignature?: string;
};

type DistributionPolicy = {
  promotion: boolean;
  demotion: boolean;
  destination: Network;
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

type ScheduleItem = DistributionPolicy & {
  id: string;
  name: string;
  start: number;
  duration: number;
  depth: number;
  color: string;
  approvals: boolean;
  access: Access[];
  lastSyncedAt?: string;
  pendingApprovals?: ApprovalRequest[];
  pendingDemotionApprovals?: DemotionApprovalRequest[];
  demotionAuthorityUserId?: string;
  demotionRequested?: boolean;
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
  personaKind?: "standard" | "demotion-authority";
  isOpen?: boolean;
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

type AppView = "sandbox" | "rules" | "changelog";

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
const AUTHORITY_PROFILES: {
  id: string;
  name: string;
  network: Exclude<Network, "Commercial">;
  accent: string;
}[] = [
  {
    id: "authority-nipr",
    name: "Dana Mercer",
    network: "NIPR",
    accent: "#8bc7f2",
  },
  {
    id: "authority-sipr",
    name: "Marcus Hale",
    network: "SIPR",
    accent: "#e9c764",
  },
  {
    id: "authority-jwics",
    name: "Tessa Ward",
    network: "JWICS",
    accent: "#e8957e",
  },
  {
    id: "authority-sap",
    name: "Adrian Knox",
    network: "SAP",
    accent: "#d2a0ee",
  },
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

function createAuthorityPersonas(): Persona[] {
  return AUTHORITY_PROFILES.map((profile) => ({
    id: profile.id,
    name: profile.name,
    role: "Demotion Approval Authority",
    organization: "Network Release Authority",
    network: profile.network,
    accent: profile.accent,
    items: [],
    dependencies: [],
    personaKind: "demotion-authority",
    isOpen: false,
  }));
}

function createDefaultPersonas(): Persona[] {
  const standardPersonas: Persona[] = NAMES.slice(0, 4).map((name, index) => ({
    id: `user-${index}`,
    name,
    role: ROLES[index],
    organization: ORGS[index],
    network: NETWORKS[Math.min(index, NETWORKS.length - 1)],
    accent: COLORS[index],
    items: makeItems(index),
    dependencies: [[`u${index}-p2`, `u${index}-p4`]],
  }));
  const authorityPersonas = createAuthorityPersonas();
  return [...standardPersonas, ...authorityPersonas];
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

function promotionCandidatesConflict(candidates: PromotionCandidate[]) {
  return new Set(
    candidates.map((candidate) => `${candidate.start}:${candidate.duration}`),
  ).size > 1;
}

function promotedCopyDiffersFromSources(
  copy: PromotedCopySnapshot,
  candidates: PromotionCandidate[],
) {
  return candidates.some((candidate) =>
    candidate.start !== copy.start || candidate.duration !== copy.duration
  ) ||
    copy.differences.some((difference) =>
      difference.toLowerCase().includes("dependency")
    );
}

function propagatePromotedCopyState(
  copies: Record<string, PromotedCopySnapshot>,
  holderUserId: string,
) {
  const next = { ...copies };
  const queue = [holderUserId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    if (visited.has(parentId)) continue;
    visited.add(parentId);
    const parent = next[parentId];
    if (!parent) continue;

    Object.entries(next).forEach(([childId, child]) => {
      if (
        child.promotedFromUserId !== parentId ||
        child.outOfSync ||
        visited.has(childId)
      ) {
        return;
      }
      next[childId] = {
        ...child,
        start: parent.start,
        duration: parent.duration,
        lastSyncedAt: parent.lastLocalEditAt ?? parent.lastSyncedAt,
        outOfSync: false,
        differences: [],
      };
      queue.push(childId);
    });
  }

  return next;
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
          let promotedCopies = item.promotedCopies
            ? { ...item.promotedCopies }
            : undefined;
          const updatedDirectCopies: string[] = [];
          if (promotedCopies) {
            Object.entries(promotedCopies).forEach(([userId, copy]) => {
              const isDirectCopy = !copy.promotedFromUserId ||
                copy.promotedFromUserId === persona.id;
              if (!isDirectCopy) return;
              if (copy.outOfSync) {
                promotedCopies![userId] = {
                  ...copy,
                  differences: Array.from(
                    new Set([
                      ...copy.differences,
                      "Source schedule changed after the local edit",
                    ]),
                  ),
                };
                return;
              }
              promotedCopies![userId] = {
                ...copy,
                start: nextStart,
                duration: item.duration,
                lastSyncedAt: syncedAt,
                outOfSync: false,
                differences: [],
              };
              updatedDirectCopies.push(userId);
            });
            updatedDirectCopies.forEach((userId) => {
              promotedCopies = propagatePromotedCopyState(
                promotedCopies!,
                userId,
              );
            });
          }
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

function isCrossNetworkApprovalRequest(
  request: ApprovalRequest,
  owner: Persona,
  personas: Persona[],
) {
  const editor = personas.find((persona) =>
    persona.id === request.editorUserId
  );
  return Boolean(
    editor &&
      editor.network !== owner.network,
  );
}

function normalizeApprovalBoundaries(personas: Persona[]) {
  return personas.map((owner) => ({
    ...owner,
    items: owner.items.map((item) => {
      const blockedRequests = (item.pendingApprovals ?? []).filter((request) =>
        isCrossNetworkApprovalRequest(request, owner, personas)
      );
      if (blockedRequests.length === 0) return item;
      const promotedCopies = { ...item.promotedCopies };
      blockedRequests.forEach((request) => {
        const editor = personas.find((persona) =>
          persona.id === request.editorUserId
        );
        const requestedStart = request.requestedStart ?? item.start;
        const differenceDays = Math.max(
          1,
          Math.round(Math.abs(requestedStart - item.start) * 1.2),
        );
        promotedCopies[request.editorUserId] = {
          copyKind: editor &&
              NETWORKS.indexOf(editor.network) <
                NETWORKS.indexOf(owner.network)
            ? "demoted"
            : "promoted",
          start: requestedStart,
          duration: item.duration,
          lastSyncedAt: item.lastSyncedAt ?? request.submittedAt,
          outOfSync: true,
          differences: [
            `Start date is ${differenceDays} days ${
              requestedStart >= item.start ? "later" : "earlier"
            } than the source`,
            "Local edit has not propagated to other networks",
          ],
          lastLocalEditAt: request.submittedAt,
          promotedFromUserId: owner.id,
        };
      });
      return {
        ...item,
        promotedCopies,
        pendingApprovals: (item.pendingApprovals ?? []).filter((request) =>
          !isCrossNetworkApprovalRequest(request, owner, personas)
        ),
      };
    }),
  }));
}

function normalizePersistedState(personas: Persona[]) {
  const withAuthorities = [
    ...personas,
    ...createAuthorityPersonas().filter((authority) =>
      !personas.some((persona) => persona.id === authority.id)
    ),
  ];
  return normalizeApprovalBoundaries(withAuthorities).map((owner) => ({
    ...owner,
    items: owner.items.map((item) => {
      const ownerLevel = NETWORKS.indexOf(owner.network);
      const validDemotionDestinations = NETWORKS.filter((_, index) =>
        index < ownerLevel
      );
      const assignedAuthority = withAuthorities.find((persona) =>
        persona.id === item.demotionAuthorityUserId &&
        persona.personaKind === "demotion-authority" &&
        persona.network === owner.network
      );
      const hasLegacyEnableRequest = Boolean(
        assignedAuthority &&
          item.pendingDemotionApprovals?.some((request) =>
            request.kind === "enable"
          ),
      );
      const demotionEnabled = ownerLevel > 0 &&
        Boolean(
          item.approvals &&
            assignedAuthority &&
            (item.demotion || hasLegacyEnableRequest),
        );
      const normalizedItem: ScheduleItem = {
        ...item,
        promotion: ownerLevel < NETWORKS.length - 1 &&
          Boolean(item.promotion),
        demotion: demotionEnabled,
        demotionAuthorityUserId: assignedAuthority?.id,
        demotionRequested: false,
        pendingDemotionApprovals: assignedAuthority
          ? item.pendingDemotionApprovals?.filter((request) =>
            request.kind !== "enable"
          )
          : [],
        demotedSnapshot: demotionEnabled
          ? item.demotedSnapshot ?? {
            start: item.start,
            duration: item.duration,
            lastSyncedAt: new Date().toISOString(),
          }
          : item.demotedSnapshot,
        destination: validDemotionDestinations.includes(item.destination)
          ? item.destination
          : validDemotionDestinations.at(-1) ?? owner.network,
      };
      if (!normalizedItem.promotedCopies) return normalizedItem;
      return {
        ...normalizedItem,
        promotedCopies: Object.fromEntries(
          Object.entries(normalizedItem.promotedCopies).map((
            [userId, copy],
          ) => [
            userId,
            copy.promotedFromUserId &&
              copy.outOfSync &&
              !copy.lastLocalEditAt &&
              copy.differences.includes(
                "Inherited from an out-of-sync promoted state",
              )
              ? { ...copy, outOfSync: false, differences: [] }
              : copy,
          ]),
        ),
      };
    }),
  }));
}

const DEFAULTS = createDefaultPersonas();
const STORAGE_KEY = "relay-sandbox-v1";
const SCENARIO_SCHEMA_VERSION = 3;

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
      return saved ? normalizePersistedState(JSON.parse(saved)) : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [modal, setModal] = useState<Modal>(null);
  const [linking, setLinking] = useState<
    { userId: string; sourceId: string } | null
  >(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>(() =>
    window.location.hash === "#changelog"
      ? "changelog"
      : window.location.hash === "#rules"
      ? "rules"
      : "sandbox"
  );
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const openPersonas = personas.filter((persona) => persona.isOpen !== false);
  const closedPersonas = personas.filter((persona) => persona.isOpen === false);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveView(
        window.location.hash === "#changelog"
          ? "changelog"
          : window.location.hash === "#rules"
          ? "rules"
          : "sandbox",
      );
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    document.title = activeView === "changelog"
      ? "Changelog · Data Motion"
      : activeView === "rules"
      ? "System Rules · Data Motion"
      : "Data Motion";
  }, [activeView]);

  useEffect(() => {
    setPersonas((current) => normalizePersistedState(current));
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
              copyKind: existing?.copyKind ?? "promoted",
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
            const promotedCopies: Record<string, PromotedCopySnapshot> = {
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
                copyKind: "promoted",
                start: holderState.start,
                duration: holderState.duration,
                lastSyncedAt: holderState.lastSyncedAt,
                outOfSync: false,
                differences: [],
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
    copyType?: "promoted" | "demoted" | "shared" | "authority" | null,
  ) {
    setPersonas((current) => {
      const sourceOwner = current.find((persona) => persona.id === ownerId);
      const editor = current.find((persona) => persona.id === editorUserId);
      const sourceItem = sourceOwner
        ?.items.find((item) => item.id === itemId);
      const isCrossNetworkEdit = Boolean(
        sourceOwner &&
          editor &&
          sourceOwner.network !== editor.network,
      );
      if (
        ownerId !== editorUserId &&
        isCrossNetworkEdit &&
        copyType === "demoted" &&
        sourceItem
      ) {
        const editedAt = new Date().toISOString();
        return current.map((persona) =>
          persona.id === ownerId
            ? {
              ...persona,
              items: persona.items.map((item) => {
                if (item.id !== itemId) return item;
                const existing = item.promotedCopies?.[editorUserId];
                const base = existing?.copyKind === "demoted"
                  ? existing
                  : item.demotedSnapshot;
                if (!base) return item;
                const nextStart = Math.max(
                  0,
                  Math.min(
                    100 - base.duration,
                    Math.round((base.start + requestedDelta) * 10) / 10,
                  ),
                );
                const differenceDays = Math.max(
                  1,
                  Math.round(Math.abs(nextStart - base.start) * 1.2),
                );
                return {
                  ...item,
                  promotedCopies: {
                    ...item.promotedCopies,
                    [editorUserId]: {
                      ...existing,
                      copyKind: "demoted",
                      start: nextStart,
                      duration: base.duration,
                      lastSyncedAt: base.lastSyncedAt,
                      outOfSync: true,
                      differences: [
                        `Local released-copy date differs by ${differenceDays} days`,
                        "Local edit has not propagated to other networks",
                      ],
                      lastLocalEditAt: editedAt,
                      promotedFromUserId: ownerId,
                    },
                  },
                };
              }),
            }
            : persona
        );
      }
      if (
        ownerId !== editorUserId &&
        isCrossNetworkEdit &&
        copyType === "promoted" &&
        sourceItem
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
            const promotedCopies: Record<string, PromotedCopySnapshot> = {
              ...item.promotedCopies,
              [editorUserId]: {
                ...existing,
                copyKind: "promoted",
                start: nextStart,
                duration: existing?.duration ?? item.duration,
                lastSyncedAt: existing?.lastSyncedAt ??
                  item.lastSyncedAt ??
                  editedAt,
                outOfSync: true,
                differences,
                lastLocalEditAt: editedAt,
                promotedFromUserId: existing?.promotedFromUserId ?? ownerId,
              },
            };
            return {
              ...item,
              promotedCopies: propagatePromotedCopyState(
                promotedCopies,
                editorUserId,
              ),
            };
          }),
        }));
      }
      if (
        ownerId !== editorUserId &&
        !isCrossNetworkEdit &&
        requiresApproval
      ) {
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
      if (
        sourceItem?.demotion &&
        sourceItem.demotionAuthorityUserId &&
        !isCrossNetworkEdit
      ) {
        return current.map((persona) =>
          persona.id === ownerId
            ? {
              ...persona,
              items: persona.items.map((item) => {
                if (item.id !== itemId) return item;
                const requests = item.pendingDemotionApprovals ?? [];
                const existing = requests.find((request) =>
                  request.kind === "schedule" &&
                  request.submittedByUserId === editorUserId
                );
                const requestedStart = Math.max(
                  0,
                  Math.min(
                    100 - item.duration,
                    (existing?.requestedStart ?? item.start) + requestedDelta,
                  ),
                );
                return {
                  ...item,
                  pendingDemotionApprovals: [
                    ...requests.filter((request) =>
                      request.id !== existing?.id
                    ),
                    {
                      id: existing?.id ??
                        `demotion-schedule-${editorUserId}-${itemId}-${Date.now()}`,
                      kind: "schedule",
                      submittedByUserId: editorUserId,
                      submittedAt: existing?.submittedAt ??
                        new Date().toISOString(),
                      requestedStart: Math.round(requestedStart * 10) / 10,
                    },
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
      if (!approved) return withoutRequest;
      if (item.demotion && item.demotionAuthorityUserId) {
        return withoutRequest.map((persona) =>
          persona.id === ownerId
            ? {
              ...persona,
              items: persona.items.map((entry) =>
                entry.id === itemId
                  ? {
                    ...entry,
                    pendingDemotionApprovals: [
                      ...(entry.pendingDemotionApprovals ?? []),
                      {
                        id: `demotion-${
                          request.kind ?? "schedule"
                        }-${request.id}`,
                        kind: request.kind === "dependency"
                          ? "dependency"
                          : "schedule",
                        submittedByUserId: ownerId,
                        submittedAt: new Date().toISOString(),
                        requestedStart: request.requestedStart,
                        dependency: request.dependency,
                        dependencyPersonaId: request.dependencyPersonaId,
                      },
                    ],
                  }
                  : entry
              ),
            }
            : persona
        );
      }
      return request.kind === "dependency" && request.dependency &&
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
        );
    });
  }

  function setDemotionAuthority(
    ownerId: string,
    itemId: string,
    authorityUserId: string,
  ) {
    setPersonas((current) =>
      current.map((persona) =>
        persona.id === ownerId
          ? {
            ...persona,
            items: persona.items.map((item) =>
              item.id === itemId
                ? { ...item, demotionAuthorityUserId: authorityUserId }
                : item
            ),
          }
          : persona
      )
    );
  }

  function enableDemotion(
    ownerId: string,
    itemId: string,
    authorityUserId: string,
  ) {
    setPersonas((current) => {
      const syncedAt = new Date().toISOString();
      return current.map((persona) =>
        persona.id === ownerId
          ? {
            ...persona,
            items: persona.items.map((item) =>
              item.id === itemId
                ? {
                  ...item,
                  demotionAuthorityUserId: authorityUserId,
                  demotion: true,
                  demotionRequested: false,
                  pendingDemotionApprovals: item.pendingDemotionApprovals
                    ?.filter(
                      (request) => request.kind !== "enable",
                    ),
                  demotedSnapshot: {
                    start: item.start,
                    duration: item.duration,
                    lastSyncedAt: syncedAt,
                  },
                }
                : item
            ),
          }
          : persona
      );
    });
  }

  function resolveDemotionApproval(
    ownerId: string,
    itemId: string,
    requestId: string,
    approved: boolean,
  ) {
    setPersonas((current) => {
      const item = current
        .find((persona) => persona.id === ownerId)
        ?.items.find((entry) => entry.id === itemId);
      const request = item?.pendingDemotionApprovals?.find((entry) =>
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
                  demotionRequested: request.kind === "enable"
                    ? false
                    : entry.demotionRequested,
                  pendingDemotionApprovals: entry.pendingDemotionApprovals
                    ?.filter(
                      (pending) => pending.id !== requestId,
                    ),
                }
                : entry
            ),
          }
          : persona
      );
      if (!approved) return withoutRequest;
      if (request.kind === "enable") {
        const syncedAt = new Date().toISOString();
        return withoutRequest.map((persona) =>
          persona.id === ownerId
            ? {
              ...persona,
              items: persona.items.map((entry) =>
                entry.id === itemId
                  ? {
                    ...entry,
                    demotion: true,
                    demotionRequested: false,
                    demotedSnapshot: {
                      start: entry.start,
                      duration: entry.duration,
                      lastSyncedAt: syncedAt,
                    },
                  }
                  : entry
              ),
            }
            : persona
        );
      }
      if (
        request.kind === "dependency" &&
        request.dependency &&
        request.dependencyPersonaId
      ) {
        return withoutRequest.map((persona) =>
          persona.id === request.dependencyPersonaId
            ? {
              ...persona,
              dependencies: [...persona.dependencies, request.dependency!],
            }
            : persona
        );
      }
      const shifted = shiftConnectedItems(
        withoutRequest,
        itemId,
        (request.requestedStart ?? item.start) - item.start,
      );
      return request.clearsDemotionOutOfSync
        ? shifted.map((persona) =>
          persona.id === ownerId
            ? {
              ...persona,
              items: persona.items.map((entry) =>
                entry.id === itemId
                  ? { ...entry, demotionOutOfSync: false }
                  : entry
              ),
            }
            : persona
        )
        : shifted;
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
            items: persona.items.map((entry) => {
              if (entry.id !== itemId) return entry;
              const nextState: PromotedCopySnapshot = {
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
                  : selected!.lastSyncedAt ?? new Date().toISOString(),
                outOfSync: stateId === "local",
                differences: stateId === "local"
                  ? [
                    ...(existing?.differences ?? []),
                    "Independent local state retained",
                  ]
                  : [],
                access: existing?.access,
                promotion: existing?.promotion,
                promotedFromUserId: stateId === "local"
                  ? existing?.promotedFromUserId
                  : selected!.holderUserId,
                reconciledCandidateSignature: promotionCandidateSignature(
                  candidates,
                ),
              };
              return {
                ...entry,
                promotedCopies: propagatePromotedCopyState(
                  {
                    ...entry.promotedCopies,
                    [viewerId]: nextState,
                  },
                  viewerId,
                ),
              };
            }),
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
      if (item.demotionAuthorityUserId) {
        return current.map((persona) =>
          persona.id === ownerId
            ? {
              ...persona,
              items: persona.items.map((entry) =>
                entry.id === itemId
                  ? {
                    ...entry,
                    pendingDemotionApprovals: [
                      ...(entry.pendingDemotionApprovals ?? []),
                      {
                        id: `demotion-reconcile-${itemId}-${Date.now()}`,
                        kind: "schedule",
                        submittedByUserId: ownerId,
                        submittedAt: new Date().toISOString(),
                        requestedStart: item.demotedSnapshot!.start,
                        clearsDemotionOutOfSync: true,
                      },
                    ],
                  }
                  : entry
              ),
            }
            : persona
        );
      }
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

  function resetLocalDemotedCopy(
    ownerId: string,
    itemId: string,
    viewerId: string,
  ) {
    setPersonas((current) =>
      current.map((persona) =>
        persona.id === ownerId
          ? {
            ...persona,
            items: persona.items.map((item) => {
              if (
                item.id !== itemId ||
                item.promotedCopies?.[viewerId]?.copyKind !== "demoted"
              ) {
                return item;
              }
              const { [viewerId]: _, ...remainingCopies } = item.promotedCopies;
              return { ...item, promotedCopies: remainingCopies };
            }),
          }
          : persona
      )
    );
  }

  function addPersona(userId?: string) {
    if (openPersonas.length >= 6) return;
    if (userId) {
      setPersonas((current) =>
        current.map((persona) =>
          persona.id === userId ? { ...persona, isOpen: true } : persona
        )
      );
      setShowSessionPicker(false);
      return;
    }
    const used = new Set(personas.map((p) => p.name));
    const index = NAMES.findIndex((name) => !used.has(name));
    if (index < 0) return;
    const nextIndex = index;
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
        personaKind: "standard",
        isOpen: true,
      },
    ]);
    setShowSessionPicker(false);
  }

  function removePersona(id: string) {
    setPersonas((current) =>
      current.map((persona) =>
        persona.id === id ? { ...persona, isOpen: false } : persona
      )
    );
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

        const sharedOwner = current.find((persona) =>
          persona.id !== viewingUserId &&
          persona.items.some((item) =>
            item.id === dependency[0] || item.id === dependency[1]
          )
        );
        const sharedItem = sharedOwner?.items.find((item) =>
          item.id === dependency[0] || item.id === dependency[1]
        );
        const isCrossNetworkLocalEdit = Boolean(
          viewer &&
            sharedOwner &&
            sharedItem &&
            viewer.network !== sharedOwner.network,
        );
        if (sharedOwner && sharedItem && isCrossNetworkLocalEdit) {
          const editedAt = new Date().toISOString();
          return current.map((persona) => {
            const withDependency = persona.id === viewingUserId
              ? {
                ...persona,
                dependencies: [...persona.dependencies, dependency],
              }
              : persona;
            if (persona.id !== sharedOwner.id) return withDependency;
            return {
              ...withDependency,
              items: withDependency.items.map((item) => {
                if (item.id !== sharedItem.id) return item;
                const existing = item.promotedCopies?.[viewingUserId];
                const isDemotedState = NETWORKS.indexOf(viewer!.network) <
                    NETWORKS.indexOf(sharedOwner.network) &&
                  Boolean(item.demotion || item.demotedSnapshot);
                const base = existing ??
                  (isDemotedState ? item.demotedSnapshot : undefined);
                return {
                  ...item,
                  promotedCopies: {
                    ...item.promotedCopies,
                    [viewingUserId]: {
                      ...existing,
                      copyKind: isDemotedState ? "demoted" : "promoted",
                      start: base?.start ?? item.start,
                      duration: base?.duration ?? item.duration,
                      lastSyncedAt: base?.lastSyncedAt ??
                        item.lastSyncedAt ??
                        editedAt,
                      outOfSync: true,
                      differences: Array.from(
                        new Set([
                          ...(existing?.differences ?? []),
                          "Dependency timing differs from the source schedule",
                          "Local edit has not propagated to other networks",
                        ]),
                      ),
                      lastLocalEditAt: editedAt,
                      localDependencies: [
                        ...(existing?.localDependencies ?? []),
                        dependency,
                      ],
                      promotedFromUserId: sharedOwner.id,
                    },
                  },
                };
              }),
            };
          });
        }
        const approvalOwner = sharedItem?.approvals ? sharedOwner : undefined;
        const approvalItem = sharedItem?.approvals ? sharedItem : undefined;
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

        const governedLocalItem = viewer?.items.find((item) =>
          (item.id === dependency[0] || item.id === dependency[1]) &&
          item.demotion &&
          item.demotionAuthorityUserId
        );
        if (governedLocalItem && viewer) {
          return current.map((persona) =>
            persona.id === viewer.id
              ? {
                ...persona,
                items: persona.items.map((item) =>
                  item.id === governedLocalItem.id
                    ? {
                      ...item,
                      pendingDemotionApprovals: [
                        ...(item.pendingDemotionApprovals ?? []),
                        {
                          id:
                            `demotion-dependency-${viewingUserId}-${Date.now()}`,
                          kind: "dependency",
                          submittedByUserId: viewingUserId,
                          submittedAt: new Date().toISOString(),
                          dependency,
                          dependencyPersonaId: viewingUserId,
                        },
                      ],
                    }
                    : item
                ),
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
    const blob = new Blob([
      JSON.stringify(
        { version: SCENARIO_SCHEMA_VERSION, personas },
        null,
        2,
      ),
    ], {
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
          setPersonas(normalizePersistedState(value.personas.slice(0, 6)));
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

  function navigateTo(view: AppView) {
    setActiveView(view);
    setModal(null);
    setLinking(null);
    window.history.pushState(
      null,
      "",
      view === "sandbox"
        ? `${window.location.pathname}${window.location.search}`
        : `${window.location.pathname}#${
          view === "changelog" ? "changelog" : "rules"
        }`,
    );
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
          {activeView === "sandbox"
            ? (
              <>
                <span className="status-dot" />
                {savedAt ? `Saved locally · ${savedAt}` : "Local scenario"}
              </>
            )
            : activeView === "rules"
            ? "Behavioral rulebook"
            : "Product release history"}
        </div>
        <div className="topbar-actions">
          {activeView !== "sandbox" && (
            <button
              className="icon-button labelled"
              onClick={() => navigateTo("sandbox")}
            >
              <ArrowLeft size={16} /> Sandbox
            </button>
          )}
          <button
            className={`icon-button labelled ${
              activeView === "rules" ? "is-active" : ""
            }`}
            onClick={() => navigateTo("rules")}
          >
            <BookOpen size={16} /> Rules
          </button>
          <button
            className={`icon-button labelled ${
              activeView === "changelog" ? "is-active" : ""
            }`}
            onClick={() => navigateTo("changelog")}
          >
            <History size={16} /> Changelog
          </button>
          {activeView === "sandbox" && (
            <>
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
            </>
          )}
        </div>
      </header>

      {activeView === "sandbox"
        ? (
          <main>
            <section className="intro">
              <div>
                <div className="eyebrow">
                  Scenario workspace · {openPersonas.length}/6 sessions
                </div>
                <h1>
                  See how work moves<br />across boundaries.
                </h1>
              </div>
              <div className="intro-side">
                <p>
                  Configure independent user sessions, then test schedule
                  access, release controls, and cross-network propagation.
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
              {openPersonas.map((persona, index) => (
                <BrowserWindow
                  key={persona.id}
                  persona={persona}
                  index={index}
                  sharedItems={personas.flatMap((source) =>
                    source.id === persona.id ? [] : source.items
                      .flatMap((item) => {
                        const recipientLevel = NETWORKS.indexOf(
                          persona.network,
                        );
                        const sourceLevel = NETWORKS.indexOf(source.network);
                        const hasOriginAccess = item.access.some((entry) =>
                          entry.userId === persona.id &&
                          entry.permission !== "none"
                        );
                        const isDemotedCopy = hasOriginAccess &&
                          recipientLevel < sourceLevel &&
                          item.destination === persona.network &&
                          Boolean(item.demotion || item.demotedSnapshot);
                        const isSameNetworkShare = hasOriginAccess &&
                          recipientLevel === sourceLevel;
                        const isAuthorityAssignment =
                          item.demotionAuthorityUserId === persona.id;
                        const promotionCandidates = getPromotionCandidates(
                          item,
                          source,
                          persona,
                          personas,
                        );
                        const isPromotedCopy = promotionCandidates.length > 0;
                        if (
                          !isDemotedCopy &&
                          !isPromotedCopy &&
                          !isSameNetworkShare &&
                          !isAuthorityAssignment
                        ) {
                          return [];
                        }
                        const promotedSnapshot = item.promotedCopies
                          ?.[persona.id];
                        const localDemotedSnapshot = isDemotedCopy &&
                            promotedSnapshot?.copyKind === "demoted"
                          ? promotedSnapshot
                          : undefined;
                        const inheritedPromotionState = promotionCandidates[0];
                        const copyHasMeaningfulDifference = promotedSnapshot
                          ? promotedCopyDiffersFromSources(
                            promotedSnapshot,
                            promotionCandidates,
                          )
                          : false;
                        const displayedItem =
                          isDemotedCopy && localDemotedSnapshot
                            ? {
                              ...item,
                              ...localDemotedSnapshot,
                              pendingApprovals: [],
                              demotionOutOfSync: false,
                            }
                            : isDemotedCopy && item.demotedSnapshot
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
                              lastSyncedAt:
                                inheritedPromotionState.lastSyncedAt,
                              pendingApprovals: [],
                            }
                            : item;
                        return [{
                          item: displayedItem,
                          ownerId: source.id,
                          ownerName: source.name,
                          origin: source.network,
                          copyType: (isDemotedCopy
                            ? "demoted"
                            : isPromotedCopy
                            ? "promoted"
                            : isAuthorityAssignment
                            ? "authority"
                            : "shared") as
                              | "demoted"
                              | "promoted"
                              | "authority"
                              | "shared",
                          copyOutOfSync: isDemotedCopy && localDemotedSnapshot
                            ? Boolean(
                              localDemotedSnapshot.outOfSync &&
                                item.demotedSnapshot &&
                                (localDemotedSnapshot.start !==
                                    item.demotedSnapshot.start ||
                                  localDemotedSnapshot.duration !==
                                    item.demotedSnapshot.duration),
                            )
                            : isPromotedCopy &&
                              Boolean(
                                promotedSnapshot?.outOfSync ??
                                  inheritedPromotionState?.outOfSync,
                              ) &&
                              (promotedSnapshot
                                ? copyHasMeaningfulDifference
                                : Boolean(inheritedPromotionState?.outOfSync)),
                          differences: isDemotedCopy && localDemotedSnapshot
                            ? localDemotedSnapshot.differences
                            : isPromotedCopy
                            ? promotedSnapshot?.differences ??
                              inheritedPromotionState?.differences ??
                              []
                            : [],
                          promotionConflict: isPromotedCopy &&
                            promotionCandidates.length > 1 &&
                            promotionCandidatesConflict(promotionCandidates) &&
                            promotedSnapshot?.reconciledCandidateSignature !==
                              promotionCandidateSignature(promotionCandidates),
                          promotionCandidates,
                          permission: isAuthorityAssignment
                            ? "read" as Permission
                            : isPromotedCopy
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
              {openPersonas.length < 6 && (
                <div className="add-window">
                  <button
                    className="add-window-trigger"
                    onClick={() => setShowSessionPicker((current) => !current)}
                  >
                    <span>
                      <Plus size={22} />
                    </span>
                    <strong>Add browser window</strong>
                    <small>Open a user or approval-authority session</small>
                  </button>
                  {showSessionPicker && (
                    <div className="session-picker">
                      {closedPersonas.map((persona) => (
                        <button
                          key={persona.id}
                          onClick={() => addPersona(persona.id)}
                        >
                          <div
                            className="mini-avatar"
                            style={{ background: persona.accent }}
                          >
                            {persona.name[0]}
                          </div>
                          <div>
                            <strong>{persona.name}</strong>
                            <span>
                              {persona.role} · {persona.network}
                            </span>
                          </div>
                          {persona.personaKind === "demotion-authority" && (
                            <ShieldCheck size={13} />
                          )}
                        </button>
                      ))}
                      {NAMES.some((name) =>
                        !personas.some((persona) => persona.name === name)
                      ) && (
                        <button
                          className="new-persona-option"
                          onClick={() => addPersona()}
                        >
                          <Plus size={14} /> Create next standard user
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          </main>
        )
        : activeView === "rules"
        ? (
          <RulesPage
            onBack={() => navigateTo("sandbox")}
            onChangelog={() => navigateTo("changelog")}
          />
        )
        : <ChangelogPage onBack={() => navigateTo("sandbox")} />}

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
          onResetLocalDemotedCopy={() =>
            accessModal.viewingUser &&
            resetLocalDemotedCopy(
              accessModal.user!.id,
              accessModal.item!.id,
              accessModal.viewingUser.id,
            )}
          onResolveApproval={(requestId, approved) =>
            resolveApproval(
              accessModal.user!.id,
              accessModal.item!.id,
              requestId,
              approved,
            )}
          onSetDemotionAuthority={(authorityUserId) =>
            setDemotionAuthority(
              accessModal.user!.id,
              accessModal.item!.id,
              authorityUserId,
            )}
          onEnableDemotion={(authorityUserId) =>
            enableDemotion(
              accessModal.user!.id,
              accessModal.item!.id,
              authorityUserId,
            )}
          onResolveDemotionApproval={(requestId, approved) =>
            resolveDemotionApproval(
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

function RulesPage({
  onBack,
  onChangelog,
}: {
  onBack: () => void;
  onChangelog: () => void;
}) {
  const rules: {
    number: string;
    icon: React.ReactNode;
    title: string;
    statement: string;
    details: string[];
  }[] = [
    {
      number: "01",
      icon: <Users size={18} />,
      title: "Same network means one shared state",
      statement:
        "Collaborators on the same network are looking at the same authoritative schedule.",
      details: [
        "Viewers inspect; Editors can change dates and dependencies.",
        "If local approvals are on, Editor changes wait for the state owner.",
        "Without approvals, Editor changes are immediate for everyone on that network.",
      ],
    },
    {
      number: "02",
      icon: <ArrowUpToLine size={18} />,
      title: "Promotion creates an up-network synced copy",
      statement:
        "A promoted copy follows its immediate source until someone explicitly edits that copy.",
      details: [
        "Promotion does not require approvals.",
        "A copy can be promoted onward while preserving its immediate source lineage.",
        "Matching incoming states do not create warnings.",
      ],
    },
    {
      number: "03",
      icon: <ArrowDownToLine size={18} />,
      title: "Demotion releases an approved snapshot",
      statement:
        "Down-network distribution is deliberate, destination-specific, and protected by local review.",
      details: [
        "Demotion requires local owner approvals and a same-network Demotion Approval Authority.",
        "Assignment shares the item with the authority; later source changes wait for their decision.",
        "The receiving network sees Approved for release, never the source network.",
        "Promotion and demotion can operate at the same time.",
      ],
    },
    {
      number: "04",
      icon: <GitBranch size={18} />,
      title: "Cross-network edits create divergence",
      statement:
        "Editing a synced copy changes only that network state. It never silently changes another network.",
      details: [
        "Cross-network edits do not create approval requests.",
        "The edited copy becomes out of sync with its immediate source.",
        "Other synced descendants keep following it until they explicitly diverge.",
      ],
    },
    {
      number: "05",
      icon: <Shield size={18} />,
      title: "Approvals are local governance",
      statement:
        "Approval requests exist only between Editors and the owner of the same network state.",
      details: [
        "Owners approve or deny date and dependency proposals.",
        "Changes to a demoted source require a second release-authority decision.",
        "Remote versions are reconciled, not approved or denied.",
      ],
    },
    {
      number: "06",
      icon: <Waypoints size={18} />,
      title: "Multiple sources require an explicit choice",
      statement:
        "When different lower-network states reach one recipient, no version silently wins.",
      details: [
        "The recipient sees each active source owner and network state.",
        "Alerts appear only when the actual schedule states differ.",
        "The state owner can sync to a source or retain an independent local state.",
      ],
    },
  ];

  return (
    <main className="rules-page">
      <section className="rules-hero">
        <div>
          <button className="changelog-back" onClick={onBack}>
            <ArrowLeft size={14} /> Back to sandbox
          </button>
          <div className="eyebrow">System rulebook · Version 1</div>
          <h1>
            One object.<br />Many governed states.
          </h1>
          <p className="rules-hero-copy">
            Data Motion treats every network as its own decision boundary.
            Sharing connects states; it does not erase their ownership.
          </p>
        </div>
        <div className="rules-thesis">
          <Waypoints size={24} />
          <span>The shortest version</span>
          <strong>
            Same-network changes are collaborative. Cross-network changes are
            synchronized or intentionally divergent.
          </strong>
          <div>
            <i /> No invisible propagation
            <i /> No surprise approvals
            <i /> No silent conflict winner
          </div>
        </div>
      </section>

      <section className="network-rule">
        <div className="rules-section-heading">
          <h2>The network is an ordered boundary</h2>
          <p>
            Information can move in either direction, but the meaning and
            controls change with direction.
          </p>
        </div>
        <div className="network-rule-rail">
          {NETWORKS.map((network, index) => (
            <div className="network-rule-node" key={network}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{network}</strong>
              {index < NETWORKS.length - 1 && <ArrowRight size={14} />}
            </div>
          ))}
        </div>
        <div className="direction-rule-grid">
          <div>
            <ArrowUpToLine size={18} />
            <strong>Up-network · Promotion</strong>
            <span>Live synced lineage, no approval prerequisite</span>
          </div>
          <div>
            <ArrowDownToLine size={18} />
            <strong>Down-network · Demotion</strong>
            <span>Approved release snapshot, explicit destination</span>
          </div>
        </div>
      </section>

      <section className="behavior-rules">
        <div className="rules-section-heading">
          <h2>Six decisions govern every flow</h2>
          <p>
            Read these rules in order when features appear to conflict.
          </p>
        </div>
        <div className="behavior-rule-list">
          {rules.map((rule) => (
            <article className="behavior-rule" key={rule.number}>
              <span className="behavior-rule-number">{rule.number}</span>
              <div className="behavior-rule-icon">{rule.icon}</div>
              <div className="behavior-rule-copy">
                <h3>{rule.title}</h3>
                <p>{rule.statement}</p>
              </div>
              <ul>
                {rule.details.map((detail) => (
                  <li key={detail}>
                    <Check size={11} /> {detail}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="state-lifecycle">
        <div className="rules-section-heading">
          <h2>How a state moves through the system</h2>
          <p>
            A copy remains synchronized until a person makes a local decision.
          </p>
        </div>
        <div className="lifecycle-track">
          {[
            ["Originate", "An owner controls the authoritative network state."],
            [
              "Distribute",
              "Access plus promotion or demotion creates a receiving state.",
            ],
            [
              "Diverge",
              "A cross-network Editor makes an intentional local change.",
            ],
            [
              "Reconcile",
              "The state owner chooses a remote version or keeps local work.",
            ],
          ].map(([title, description], index) => (
            <div className="lifecycle-step" key={title}>
              <span>{index + 1}</span>
              <strong>{title}</strong>
              <p>{description}</p>
              {index < 3 && <ArrowRight size={15} />}
            </div>
          ))}
        </div>
      </section>

      <section className="hard-boundaries">
        <div>
          <Shield size={25} />
          <h2>Hard boundaries</h2>
          <p>
            These constraints protect network intent even when a scenario is
            complicated.
          </p>
        </div>
        <ol>
          {[
            "Nothing flows down-network unless demotion is enabled.",
            "Every demotion release is decided by its assigned authority.",
            "Cross-network edits never become approval requests.",
            "Matching states never create conflict noise.",
            "Viewers cannot mutate dates, sharing, or governance.",
            "Rigid dependencies move together inside their active state.",
            "Only the applicable state owner can reconcile versions.",
          ].map((boundary, index) => (
            <li key={boundary}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {boundary}
            </li>
          ))}
        </ol>
      </section>

      <section className="qa-invitation">
        <div className="qa-invitation-mark">
          <BookOpen size={24} />
        </div>
        <div>
          <h2>Ask the executable specification</h2>
          <p>
            The complete QA scenario document covers combinations, edge cases,
            expected alerts, and release criteria. Open it directly, or load it
            into your favorite LLM to ask behavioral questions in plain
            language.
          </p>
          <code>
            “Using QA_SCENARIOS.md, explain who sees a change, whether approval
            is required, and which state moves in this scenario…”
          </code>
        </div>
        <div className="qa-invitation-actions">
          <a
            href="https://github.com/sloanal/data-motion/blob/main/QA_SCENARIOS.md"
            target="_blank"
            rel="noreferrer"
          >
            Open QA_SCENARIOS.md <ExternalLink size={13} />
          </a>
          <button onClick={onChangelog}>
            View changelog <ArrowRight size={13} />
          </button>
        </div>
      </section>
    </main>
  );
}

function ChangelogPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="changelog-page">
      <section className="changelog-hero">
        <div>
          <button className="changelog-back" onClick={onBack}>
            <ArrowLeft size={14} /> Back to sandbox
          </button>
          <div className="eyebrow">
            Product updates · {CHANGELOG.length} releases
          </div>
          <h1>
            What’s new in<br />Data Motion.
          </h1>
        </div>
        <div className="changelog-intro">
          <History size={22} />
          <p>
            Follow new capabilities, behavior changes, and fixes across the
            schedule synchronization sandbox.
          </p>
          <span>Latest release · v{CHANGELOG[0].version}</span>
        </div>
      </section>

      <section className="release-list" aria-label="Release history">
        {CHANGELOG.map((release, index) => (
          <article className="release-card" key={release.version}>
            <div className="release-marker">
              <i className={index === 0 ? "latest" : ""} />
              {index < CHANGELOG.length - 1 && <span />}
            </div>
            <div className="release-meta">
              <span>v{release.version}</span>
              <time dateTime={release.date}>
                {new Date(`${release.date}T12:00:00`).toLocaleDateString([], {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              {index === 0 && <strong>Latest</strong>}
            </div>
            <div className="release-content">
              <div className="release-heading">
                <div>
                  <h2>{release.title}</h2>
                  <p>{release.summary}</p>
                </div>
                <div className="release-categories">
                  {release.categories.map((category) => (
                    <span key={category}>{category}</span>
                  ))}
                </div>
              </div>
              <ul>
                {release.changes.map((change) => (
                  <li key={change}>
                    <Check size={12} />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>
    </main>
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
    copyType: "promoted" | "demoted" | "shared" | "authority";
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
    copyType?: "promoted" | "demoted" | "shared" | "authority" | null,
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
      copyType: "promoted" | "demoted" | "shared" | "authority" | null;
    } | null
  >(null);
  const suppressClickRef = useRef<string | null>(null);
  const timelineItems = [
    ...persona.items.map((item) => ({
      item,
      isOffNetwork: false,
      isSharedItem: false,
      isAuthorityItem: false,
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
        isOffNetwork: copyType === "promoted" || copyType === "demoted",
        isSharedItem: copyType === "shared",
        isAuthorityItem: copyType === "authority",
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
  const authorityPendingCount = sharedItems.reduce(
    (total, shared) =>
      total + (shared.item.pendingDemotionApprovals?.length ?? 0),
    0,
  );

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
    copyType: "promoted" | "demoted" | "shared" | "authority" | null,
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
          <strong>
            {persona.personaKind === "demotion-authority"
              ? "Demotion release queue"
              : "Integrated delivery plan"}
          </strong>
          <span>
            {persona.personaKind === "demotion-authority"
              ? `${persona.network} · Assigned governed items`
              : "FY26 · Q3–Q4"}
          </span>
        </div>
        <div className="schedule-stats">
          {persona.personaKind === "demotion-authority"
            ? (
              <>
                <span>{sharedItems.length} governed</span>
                <span>{authorityPendingCount} pending</span>
              </>
            )
            : (
              <>
                <span>{persona.items.length} objects</span>
                {sharedItems.length > 0 && (
                  <span>+{sharedItems.length} shared</span>
                )}
                <span>{persona.dependencies.length} links</span>
              </>
            )}
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
            isSharedItem,
            isAuthorityItem,
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
            className={`schedule-row ${isOffNetwork ? "off-network-row" : ""} ${
              isSharedItem ? "same-network-row" : ""
            } ${isAuthorityItem ? "authority-row" : ""}`}
            key={`${ownerName}-${item.id}`}
          >
            <button
              className={`item-label depth-${item.depth} ${
                linkingSource === item.id ? "is-source" : ""
              } ${isOffNetwork ? "is-provenance" : ""} ${
                isSharedItem ? "is-shared" : ""
              } ${isAuthorityItem ? "is-authority" : ""}`}
              onClick={() => openItem(item.id, ownerId, canWrite)}
              title={!canWrite
                ? READ_ONLY_REASON
                : isOffNetwork
                ? copyType === "demoted"
                  ? `Synced copy approved for release · Owned by ${ownerName}`
                  : `Synced copy promoted from ${origin} · Owned by ${ownerName}`
                : isSharedItem
                ? `Shared by ${ownerName} on ${origin}`
                : isAuthorityItem
                ? `Demotion approvals for ${ownerName}`
                : undefined}
            >
              {isAuthorityItem
                ? <ShieldCheck size={11} className="authority-item-icon" />
                : isSharedItem
                ? <Users size={11} className="shared-item-icon" />
                : isOffNetwork
                ? copyType === "demoted"
                  ? <BadgeCheck size={12} className="provenance-icon release" />
                  : <RefreshCw size={11} className="provenance-icon" />
                : item.depth === 0
                ? <ChevronDown size={13} />
                : item.depth === 1
                ? <ChevronRight size={12} />
                : <span className="branch-glyph">└</span>}
              <span>{item.name}</span>
              {(isOffNetwork || isSharedItem || isAuthorityItem ||
                (item.pendingApprovals?.length ?? 0) > 0 ||
                (item.pendingDemotionApprovals?.length ?? 0) > 0 ||
                (item.demotionOutOfSync && !isSharedItem) || copyOutOfSync ||
                promotionConflict) && (
                <div className="row-statuses">
                  {isSharedItem && (
                    <small className="sync-copy-chip shared">Shared</small>
                  )}
                  {isAuthorityItem && (
                    <small className="sync-copy-chip authority">
                      Authority
                    </small>
                  )}
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
                  {(item.pendingDemotionApprovals?.length ?? 0) > 0 && (
                    <span
                      className="pending-approval-icon authority"
                      title={`${
                        item.pendingDemotionApprovals!.length
                      } demotion approval${
                        isAuthorityItem
                          ? " waiting for your decision"
                          : " pending"
                      }`}
                    >
                      <Clock3 size={10} />
                      {item.pendingDemotionApprovals!.length}
                    </span>
                  )}
                  {((item.demotionOutOfSync && !isSharedItem) ||
                    copyOutOfSync) && (
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
  const isAuthority = persona.personaKind === "demotion-authority";
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
            disabled={isAuthority}
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
            disabled={isAuthority}
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
          <Info size={15} /> {isAuthority
            ? "Approval authorities are fixed to their designated network and role."
            : "Network placement determines valid promotion and demotion destinations."}
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
  onResetLocalDemotedCopy,
  onSetDemotionAuthority,
  onEnableDemotion,
  onResolveDemotionApproval,
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
  onResetLocalDemotedCopy: () => void;
  onSetDemotionAuthority: (authorityUserId: string) => void;
  onEnableDemotion: (authorityUserId: string) => void;
  onResolveDemotionApproval: (
    requestId: string,
    approved: boolean,
  ) => void;
  onUpdateCopy: (patch: Partial<PromotedCopySnapshot>) => void;
  onUpdate: (patch: Partial<ScheduleItem>) => void;
}) {
  const [showSyncChanges, setShowSyncChanges] = useState(false);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [demotionIntent, setDemotionIntent] = useState(
    Boolean(item.demotion || item.demotionRequested),
  );
  const [selectedDemotionAuthority, setSelectedDemotionAuthority] = useState(
    item.demotionAuthorityUserId ?? "",
  );
  const originLevel = NETWORKS.indexOf(owner.network);
  const eligibleDemotionAuthorities = personas.filter((persona) =>
    persona.personaKind === "demotion-authority" &&
    persona.network === owner.network
  );
  const assignedDemotionAuthority = personas.find((persona) =>
    persona.id === item.demotionAuthorityUserId
  );
  const displayedDemotionAuthority = personas.find((persona) =>
    persona.id === selectedDemotionAuthority
  );
  const isDemotionAuthority = Boolean(
    viewingUser &&
      viewingUser.id === item.demotionAuthorityUserId &&
      viewingUser.personaKind === "demotion-authority",
  );
  const needsDemotionAuthority = Boolean(
    !viewingUser && demotionIntent && !selectedDemotionAuthority,
  );
  const isCrossNetworkView = Boolean(
    viewingUser && viewingUser.network !== owner.network,
  );
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
  const localDemotedCopy = viewingUser &&
      isReleasedCopy &&
      item.promotedCopies?.[viewingUser.id]?.copyKind === "demoted"
    ? item.promotedCopies[viewingUser.id]
    : undefined;
  const hasPromotionStateConflict = promotionCandidates.length > 1 &&
    promotionCandidatesConflict(promotionCandidates) &&
    promotedCopy?.reconciledCandidateSignature !==
      promotionCandidateSignature(promotionCandidates);
  const showPromotedCopyOutOfSync = Boolean(
    promotedCopy?.outOfSync &&
      promotedCopyDiffersFromSources(promotedCopy, promotionCandidates),
  );
  const differentLowerStates = promotedCopy
    ? promotionCandidates.length > 1
      ? promotionCandidates
      : promotionCandidates.filter((candidate) =>
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
  const demotionDisabledReason = viewingUser
    ? isReadOnly ? READ_ONLY_REASON : OWNER_ONLY_DEMOTION_REASON
    : !item.approvals
    ? "Enable Owner approvals before requesting demotion."
    : originLevel === 0
    ? "Commercial is the lowest network, so this item cannot be demoted."
    : undefined;
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
    const hasActiveEdge = (parentId: string, childId: string) => {
      if (parentId === owner.id) {
        return item.promotion &&
          item.access.some((entry) =>
            entry.userId === childId && entry.permission !== "none"
          );
      }
      const parentCopy = item.promotedCopies?.[parentId];
      return Boolean(
        parentCopy?.promotion &&
          parentCopy.access?.some((entry) =>
            entry.userId === childId && entry.permission !== "none"
          ),
      );
    };
    const addLineage = (holderUserId: string) => {
      const visited = new Set<string>();
      let currentId: string | undefined = holderUserId;
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const current = personas.find((persona) => persona.id === currentId);
        if (current) {
          addEntry(
            current,
            current.id === owner.id
              ? "Source Owner"
              : `${current.network} owner`,
          );
        }
        if (currentId === owner.id) break;
        const parentId: string | undefined = item.promotedCopies?.[currentId]
          ?.promotedFromUserId;
        if (!parentId || !hasActiveEdge(parentId, currentId)) break;
        currentId = parentId;
      }
    };
    promotionCandidates.forEach((candidate) => {
      addLineage(candidate.holderUserId);
    });
    return entries;
  })();
  const hasSourceConflict = Boolean(
    promotedCopy?.differences.includes(
      "Source schedule changed after the local edit",
    ),
  );
  const displayedSyncTime = isReleasedCopy
    ? localDemotedCopy?.lastSyncedAt ??
      item.demotedSnapshot?.lastSyncedAt ??
      item.lastSyncedAt
    : promotedCopy?.lastSyncedAt ?? item.lastSyncedAt;
  const visibleApprovals = (item.pendingApprovals ?? []).filter((request) =>
    !isCrossNetworkApprovalRequest(request, owner, personas) &&
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
      promotion: promotedCopy?.promotion ?? true,
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
    if (
      selectedDemotionAuthority &&
      selectedDemotionAuthority !== item.demotionAuthorityUserId
    ) {
      onSetDemotionAuthority(selectedDemotionAuthority);
    }
    if (
      demotionIntent &&
      selectedDemotionAuthority &&
      !item.demotion
    ) {
      onEnableDemotion(selectedDemotionAuthority);
    }
    onClose();
  }

  function chooseDemotionAuthority(authorityUserId: string) {
    setSelectedDemotionAuthority(authorityUserId);
  }

  function setMovement(kind: "promotion" | "demotion", enabled: boolean) {
    if (isReadOnly) return;
    if (kind === "promotion" && viewingUser && !isPromotedCopyView) return;
    if (kind === "demotion") {
      if (viewingUser || (!item.approvals && enabled)) return;
      setDemotionIntent(enabled);
      if (enabled) {
        const valid = NETWORKS.filter((_, index) => index < originLevel);
        onUpdate({
          destination: valid.includes(item.destination)
            ? item.destination
            : valid.at(-1) ?? owner.network,
        });
      } else {
        onUpdate({
          demotion: false,
          demotionRequested: false,
          pendingDemotionApprovals: [],
        });
      }
      return;
    }
    if (kind === "promotion" && isPromotedCopyView) {
      updateLocalCopy({ promotion: enabled });
      return;
    }
    onUpdate({
      promotion: enabled,
      demotion: item.demotion,
      destination: item.destination,
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
        {isReadOnly && !isDemotionAuthority && (
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
        {isDemotionAuthority && (
          <div className="authority-view-banner">
            <ShieldCheck size={17} />
            <div>
              <strong>Demotion approval authority view</strong>
              <span>
                You can inspect this governed item and decide whether queued
                changes are approved for down-network release.
              </span>
            </div>
          </div>
        )}
        {viewingUser && (isReleasedCopy || isPromotedCopyView) && (
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
        {localDemotedCopy?.outOfSync && item.demotedSnapshot &&
          (localDemotedCopy.start !== item.demotedSnapshot.start ||
            localDemotedCopy.duration !== item.demotedSnapshot.duration) &&
          (
            <div className="out-of-sync-banner copy-divergence">
              <TriangleAlert size={17} />
              <div>
                <strong>This released copy has local changes</strong>
                <span>
                  Your edits remain on this network. They were not promoted or
                  sent to the source network.
                </span>
                <ul>
                  {localDemotedCopy.differences.map((difference) => (
                    <li key={difference}>{difference}</li>
                  ))}
                </ul>
                <div
                  className="conflict-actions"
                  title={isReadOnly ? READ_ONLY_REASON : undefined}
                >
                  <button
                    disabled={isReadOnly}
                    title={isReadOnly ? READ_ONLY_REASON : undefined}
                    onClick={onResetLocalDemotedCopy}
                  >
                    <RefreshCw size={11} /> Sync to approved release
                  </button>
                  <span className="keep-state-note">
                    Current local state is retained
                  </span>
                </div>
              </div>
            </div>
          )}
        {isPromotedCopyView && hasPromotionStateConflict &&
          !showPromotedCopyOutOfSync && (
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
        {showPromotedCopyOutOfSync && promotedCopy && (
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
        {item.demotionOutOfSync && !isReleasedCopy &&
          (!viewingUser ||
            NETWORKS.indexOf(viewingUser.network) !== originLevel) &&
          (
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
        {(isDemotionAuthority ||
          (!viewingUser &&
            (item.pendingDemotionApprovals?.length ?? 0) > 0)) && (
          <section className="control-section demotion-approval-queue">
            <div className="section-heading">
              <div>
                <ShieldCheck size={17} />
                <div>
                  <strong>Demotion release approvals</strong>
                  <span>
                    {isDemotionAuthority
                      ? "Approve or deny changes before they flow down-network."
                      : "Changes are waiting for the assigned release authority."}
                  </span>
                </div>
              </div>
              <span className="count-chip">
                {item.pendingDemotionApprovals?.length ?? 0}
              </span>
            </div>
            <div className="approval-list">
              {(item.pendingDemotionApprovals?.length ?? 0) === 0
                ? (
                  <span className="empty-connections">
                    No demotion changes awaiting approval
                  </span>
                )
                : item.pendingDemotionApprovals!.map((request) => {
                  const submitter = personas.find((persona) =>
                    persona.id === request.submittedByUserId
                  );
                  const requestedDelta = request.requestedStart === undefined
                    ? 0
                    : request.requestedStart - item.start;
                  const days = Math.max(
                    1,
                    Math.round(Math.abs(requestedDelta) * 1.2),
                  );
                  const requestLabel = request.kind === "enable"
                    ? "Enable demotion and release the first snapshot"
                    : request.kind === "dependency"
                    ? "Release a dependency change"
                    : `Release a date change ${days} days ${
                      requestedDelta >= 0 ? "later" : "earlier"
                    }`;
                  return (
                    <div className="approval-row" key={request.id}>
                      <div
                        className="mini-avatar"
                        style={{ background: submitter?.accent }}
                      >
                        {submitter?.name[0] ?? "U"}
                      </div>
                      <div className="approval-detail">
                        <strong>{requestLabel}</strong>
                        <span>
                          {submitter?.name ?? "Source owner"} · Sent{" "}
                          {formatSyncTime(request.submittedAt)}
                        </span>
                      </div>
                      {isDemotionAuthority
                        ? (
                          <div className="approval-actions">
                            <button
                              className="deny"
                              onClick={() =>
                                onResolveDemotionApproval(request.id, false)}
                            >
                              <X size={12} /> Deny
                            </button>
                            <button
                              className="approve"
                              onClick={() =>
                                onResolveDemotionApproval(request.id, true)}
                            >
                              <Check size={12} /> Approve
                            </button>
                          </div>
                        )
                        : (
                          <span className="awaiting-chip">
                            <Clock3 size={9} /> Awaiting authority
                          </span>
                        )}
                    </div>
                  );
                })}
            </div>
          </section>
        )}
        {!isDemotionAuthority &&
          ((item.approvals && !isCrossNetworkView) ||
            visibleApprovals.length > 0) &&
          (
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
                      <span>
                        {persona.personaKind === "demotion-authority"
                          ? `${persona.role} · ${persona.network}`
                          : `${persona.organization} · ${persona.network}`}
                      </span>
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
                    <span>
                      {persona.personaKind === "demotion-authority"
                        ? `${persona.role} · ${persona.network}`
                        : `${persona.organization} · ${persona.network}`}
                    </span>
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
          {(demotionIntent || item.demotion || item.demotionRequested) && (
            <div className="demotion-authority-slot">
              <div className="demotion-authority-heading">
                <ShieldCheck size={15} />
                <div>
                  <strong>Demotion approval authority</strong>
                  <span>
                    Required before this object can release changes
                    down-network.
                  </span>
                </div>
                {item.demotionRequested && assignedDemotionAuthority && (
                  <span className="awaiting-chip">
                    <Clock3 size={9} /> Awaiting authority
                  </span>
                )}
                {item.demotionRequested && !assignedDemotionAuthority && (
                  <span className="authority-required-chip">
                    Authority required
                  </span>
                )}
              </div>
              {displayedDemotionAuthority && (
                <div className="access-row authority-assignment-row">
                  <div
                    className="mini-avatar"
                    style={{ background: displayedDemotionAuthority.accent }}
                  >
                    {displayedDemotionAuthority.name[0]}
                  </div>
                  <div className="access-person">
                    <strong>
                      {displayedDemotionAuthority.name}
                      {isDemotionAuthority ? " (you)" : ""}
                    </strong>
                    <span>
                      {displayedDemotionAuthority.organization} ·{" "}
                      {displayedDemotionAuthority.network}
                    </span>
                  </div>
                  <span className="authority-chip">
                    Demotion approval authority
                  </span>
                </div>
              )}
              {!viewingUser && (
                <label className="authority-picker-field">
                  <span>Assign authority</span>
                  <select
                    value={selectedDemotionAuthority}
                    onChange={(event) =>
                      chooseDemotionAuthority(event.target.value)}
                  >
                    <option value="">Select an authority…</option>
                    {eligibleDemotionAuthorities.map((authority) => (
                      <option key={authority.id} value={authority.id}>
                        {authority.name} - {authority.network}{" "}
                        - Demotion Authority
                      </option>
                    ))}
                  </select>
                  <small>
                    Only same-network users with the Demotion Approval Authority
                    role are eligible.
                  </small>
                </label>
              )}
            </div>
          )}
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

        {!isCrossNetworkView && (
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
                    Review same-network editor changes before they update this
                    state.
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
                    demotionRequested: approvals
                      ? item.demotionRequested
                      : false,
                    pendingDemotionApprovals: approvals
                      ? item.pendingDemotionApprovals
                      : [],
                  })}
              />
            </div>
          </section>
        )}

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
          title={demotionDisabledReason}
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
              disabledReason={demotionDisabledReason}
              checked={item.demotion}
              onChange={(next) => setMovement("demotion", next)}
            />
          </div>
        </section>

        {(item.demotion || item.demotionRequested || demotionIntent) && (
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
        {!viewingUser && item.promotion && item.demotion && (
          <div className="dual-sharing-callout">
            <GitBranch size={16} />
            <div>
              <strong>Bidirectional distribution is active</strong>
              <span>
                Live synced copies can move up-network while the approved
                snapshot is released to {item.destination}.
              </span>
            </div>
          </div>
        )}
        {!item.approvals && !viewingUser && (
          <div className="info-callout">
            <LockKeyhole size={15} />{" "}
            Turn on owner approvals to enable demotion.
          </div>
        )}
      </div>
      <div className="modal-footer">
        <span>
          {isDemotionAuthority
            ? (
              <>
                <ShieldCheck size={14} /> Approval authority view
              </>
            )
            : isReadOnly
            ? (
              <>
                <LockKeyhole size={14} /> View-only access
              </>
            )
            : (
              <>
                {needsDemotionAuthority
                  ? <ShieldCheck size={14} />
                  : <Save size={14} />}
                {needsDemotionAuthority
                  ? "Assign an authority to continue"
                  : "Changes save automatically"}
              </>
            )}
        </span>
        <div
          className="modal-apply-wrapper"
          title={needsDemotionAuthority
            ? "Assign a same-network Demotion Approval Authority before saving."
            : undefined}
        >
          <button
            className="primary-button"
            disabled={needsDemotionAuthority}
            onClick={applyControlsAndClose}
          >
            <Check size={16} />{" "}
            {isReadOnly || isDemotionAuthority ? "Done" : "Apply controls"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export default App;
