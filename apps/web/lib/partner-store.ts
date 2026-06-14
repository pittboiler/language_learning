// apps/web/lib/partner-store.ts — the app-side adapter for partnered persistence (the NEW cross-user
// tables from migration 0002). Mirrors lib/store.ts: it talks to the SAME shared Supabase anon client.
// The raw user_state blob stays private and own-row-only — a partner reads ONLY the published
// projection here (DESIGN-partnered-learning.md §1.1). Member identity is mutated only via the
// security-definer RPCs (redeem / set_partnership_status), never a direct table write.
import { supabase, uid, supabaseConfigured } from "./supabase";
import * as partner from "@ll/core/partner";
import type { Partnership, VisibilitySettings, ActivityRecord } from "@ll/core/partner";
import type { FamiliarityProjection } from "@ll/core/partner/familiarity-diff";

/** What one member publishes for the partner to read (already visibility-gated by `publish`, §1.1). */
export interface PublishedState {
  activity: ActivityRecord;
  familiarity?: FamiliarityProjection; // Phase 2
}

export interface PartnerArtifact {
  id: string;
  kind: string;
  createdBy: string;
  status: string;
  payload: unknown;
  createdAt: string;
}

export interface PartnerStore {
  /** The current anonymous user id (for attributing shared artifacts like nudges). */
  me(): Promise<string>;
  invite(packId: string): Promise<{ partnership: Partnership; code: string }>;
  redeem(code: string): Promise<Partnership>;
  myPartnerships(packId: string): Promise<Partnership[]>;
  pause(partnershipId: string): Promise<Partnership>;
  resume(partnershipId: string): Promise<Partnership>;
  end(partnershipId: string): Promise<Partnership>;
  getVisibility(partnershipId: string): Promise<VisibilitySettings>;
  setVisibility(partnershipId: string, settings: VisibilitySettings): Promise<void>;
  /** Publish my visibility-gated projection for the partner. Gating is applied here (defense in depth). */
  publish(partnershipId: string, packId: string, state: PublishedState): Promise<void>;
  /** Read the PARTNER's published projection (RLS lets a member read it; never the raw blob). */
  readPartnerPublished(partnershipId: string): Promise<PublishedState | null>;
  putArtifact(partnershipId: string, packId: string, kind: string, payload: unknown, id?: string): Promise<string>;
  listArtifacts(partnershipId: string, kind: string): Promise<PartnerArtifact[]>;
}

interface PartnershipRow {
  id: string;
  pack_id: string;
  a_user_id: string;
  b_user_id: string | null;
  status: string;
  invite_code: string | null;
  created_at: string;
  updated_at: string;
}

const toPartnership = (r: PartnershipRow): Partnership => ({
  id: r.id,
  packId: r.pack_id,
  members: [r.a_user_id, r.b_user_id ?? undefined],
  status: r.status as Partnership["status"],
  inviteCode: r.invite_code ?? undefined,
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

/** Short, human-shareable invite code (6 chars, no ambiguous 0/O/1/I). */
function makeInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function supabasePartnerStore(): PartnerStore {
  const sb = supabase()!;

  async function setStatus(partnershipId: string, status: "active" | "paused" | "ended"): Promise<Partnership> {
    const { data, error } = await sb.rpc("set_partnership_status", { pid: partnershipId, new_status: status });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as PartnershipRow | undefined;
    if (!row) throw new Error("partnership not found");
    return toPartnership(row);
  }

  async function getVisibility(partnershipId: string): Promise<VisibilitySettings> {
    const u = await uid();
    const { data } = await sb
      .from("partner_visibility")
      .select("settings")
      .eq("partnership_id", partnershipId)
      .eq("user_id", u)
      .maybeSingle();
    return (data as { settings?: VisibilitySettings } | null)?.settings ?? partner.DEFAULT_VISIBILITY;
  }

  return {
    me: () => uid(),

    async invite(packId) {
      const u = await uid();
      const id = crypto.randomUUID();
      const code = makeInviteCode();
      const p = partner.invite(id, packId, u, code); // core builds the canonical object
      const { error } = await sb
        .from("partnership")
        .insert({ id, pack_id: packId, a_user_id: u, status: "pending", invite_code: code });
      if (error) throw error;
      await sb.from("partner_visibility").upsert({ partnership_id: id, user_id: u, settings: partner.DEFAULT_VISIBILITY });
      return { partnership: p, code };
    },

    async redeem(code) {
      const { data, error } = await sb.rpc("redeem_partner_invite", { code: code.trim().toUpperCase() });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as PartnershipRow | undefined;
      if (!row) throw new Error("invalid or already-used invite code");
      return toPartnership(row);
    },

    async myPartnerships(packId) {
      const u = await uid();
      const { data, error } = await sb
        .from("partnership")
        .select("*")
        .eq("pack_id", packId)
        .or(`a_user_id.eq.${u},b_user_id.eq.${u}`)
        .neq("status", "ended")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as PartnershipRow[]).map(toPartnership);
    },

    pause: (id) => setStatus(id, "paused"),
    resume: (id) => setStatus(id, "active"),
    end: (id) => setStatus(id, "ended"),

    getVisibility,

    async setVisibility(partnershipId, settings) {
      const u = await uid();
      const { error } = await sb
        .from("partner_visibility")
        .upsert({ partnership_id: partnershipId, user_id: u, settings, updated_at: new Date().toISOString() });
      if (error) throw error;
    },

    async publish(partnershipId, packId, state) {
      const u = await uid();
      const vis = await getVisibility(partnershipId);
      // Visibility gating at publish time (the RLS gates the read; this gates the WRITE — §1.1).
      const gated: PublishedState = {
        activity: {
          lastActiveDay: vis.shareStreak ? state.activity.lastActiveDay : "",
          metrics: vis.shareActivity ? state.activity.metrics : undefined,
        },
        familiarity: vis.shareFamiliarity ? state.familiarity : undefined,
      };
      const { error } = await sb.from("partner_published_state").upsert({
        partnership_id: partnershipId,
        user_id: u,
        pack_id: packId,
        data: gated,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },

    async readPartnerPublished(partnershipId) {
      const u = await uid();
      const { data } = await sb
        .from("partner_published_state")
        .select("data")
        .eq("partnership_id", partnershipId)
        .neq("user_id", u)
        .maybeSingle();
      return (data as { data?: PublishedState } | null)?.data ?? null;
    },

    async putArtifact(partnershipId, packId, kind, payload, id) {
      const u = await uid();
      const rowId = id ?? crypto.randomUUID();
      const { error } = await sb
        .from("partner_artifact")
        .upsert({ id: rowId, partnership_id: partnershipId, pack_id: packId, kind, created_by: u, payload });
      if (error) throw error;
      return rowId;
    },

    async listArtifacts(partnershipId, kind) {
      const { data, error } = await sb
        .from("partner_artifact")
        .select("id,created_by,status,payload,created_at")
        .eq("partnership_id", partnershipId)
        .eq("kind", kind)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => {
        const row = r as { id: string; created_by: string; status: string; payload: unknown; created_at: string };
        return { id: row.id, kind, createdBy: row.created_by, status: row.status, payload: row.payload, createdAt: row.created_at };
      });
    },
  };
}

/** The partner store, or null when Supabase isn't configured (partner features then show as disabled). */
export function getPartnerStore(): PartnerStore | null {
  return supabaseConfigured() ? supabasePartnerStore() : null;
}
