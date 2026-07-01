/**
 * Workbook persistence (Supabase). All functions require cloud mode to be
 * configured (see src/lib/supabase.ts); callers should guard on
 * isCloudEnabled before invoking these.
 */

import { supabase } from './supabase';
import { SerializedWorkbook } from '../engine/serialization';

export interface WorkbookSummary {
  id: string;
  ownerId: string;
  title: string;
  isPublic: boolean;
  shareToken: string;
  updatedAt: string;
}

export interface WorkbookRecord extends WorkbookSummary {
  data: SerializedWorkbook;
}

interface WorkbookRow {
  id: string;
  owner_id: string;
  title: string;
  is_public: boolean;
  share_token: string;
  updated_at: string;
  data?: SerializedWorkbook;
}

function requireClient() {
  if (!supabase) {
    throw new Error('Cloud features are not configured (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)');
  }
  return supabase;
}

function summaryFromRow(row: WorkbookRow): WorkbookSummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    isPublic: row.is_public,
    shareToken: row.share_token,
    updatedAt: row.updated_at,
  };
}

function fromRow(row: WorkbookRow): WorkbookRecord {
  return { ...summaryFromRow(row), data: row.data as SerializedWorkbook };
}

export async function listWorkbooks(): Promise<WorkbookSummary[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('workbooks')
    .select('id, owner_id, title, is_public, share_token, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(summaryFromRow);
}

export async function createWorkbook(title: string, data: SerializedWorkbook): Promise<WorkbookRecord> {
  const client = requireClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Must be signed in to create a workbook');

  const { data: row, error } = await client
    .from('workbooks')
    .insert({ title, data, owner_id: userData.user.id })
    .select()
    .single();

  if (error) throw error;
  return fromRow(row);
}

export async function getWorkbook(id: string): Promise<WorkbookRecord> {
  const client = requireClient();
  const { data: row, error } = await client.from('workbooks').select('*').eq('id', id).single();
  if (error) throw error;
  return fromRow(row);
}

export async function getWorkbookByShareToken(token: string): Promise<WorkbookRecord> {
  const client = requireClient();
  const { data: rows, error } = await client.rpc('get_shared_workbook', { token });
  if (error) throw error;
  const row = rows?.[0];
  if (!row) throw new Error('This share link is invalid or no longer public');
  return fromRow(row);
}

export async function regenerateShareToken(id: string): Promise<string> {
  const client = requireClient();
  const { data: row, error } = await client
    .from('workbooks')
    .update({ share_token: crypto.randomUUID() })
    .eq('id', id)
    .select('share_token')
    .single();
  if (error) throw error;
  return row.share_token;
}

export async function saveWorkbook(id: string, data: SerializedWorkbook, title?: string): Promise<void> {
  const client = requireClient();
  const update: Record<string, unknown> = { data };
  if (title !== undefined) update.title = title;
  const { error } = await client.from('workbooks').update(update).eq('id', id);
  if (error) throw error;
}

export async function renameWorkbook(id: string, title: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('workbooks').update({ title }).eq('id', id);
  if (error) throw error;
}

export async function deleteWorkbook(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('workbooks').delete().eq('id', id);
  if (error) throw error;
}

export async function setWorkbookPublic(id: string, isPublic: boolean): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('workbooks').update({ is_public: isPublic }).eq('id', id);
  if (error) throw error;
}
