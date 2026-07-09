/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FabricType {
  id: number;
  name: string;
  badge_color: string;
  created_at: string;
}

export type StageKey = 'wet' | 'dry' | 'finish' | 'shade' | 'quality' | 'rfd' | 'delivered';
export type StageStatus = 'pending' | 'running' | 'completed' | 'hold';

export interface BatchStage {
  id: number;
  batch_id: number;
  stage_key: StageKey;
  status: StageStatus;
  updated_at: string;
}

export interface ReworkLog {
  id: number;
  batch_id: number;
  batch_number?: string;
  rework_type: 'Dyeing' | 'Finishing';
  reason: string;
  custom_reason: string;
  remarks: string | null;
  created_at: string;
}

export interface Batch {
  id: number;
  buyer: string;
  buyer_reference: string;
  batch_number: string;
  order_number: string | null;
  color: string | null;
  fabric_type_id: number | null;
  fabric_quantity: number | null; // in kg
  trims: string | null;
  trims_quantity: string | null;
  machine_number: string | null;
  lot_number: string | null;
  remarks: string | null;
  shade_status: 'pending' | 'ok' | 'not_ok';
  shade_reason: string | null;
  shade_custom_reason: string | null;
  quality_status: 'pending' | 'ok' | 'not_ok';
  quality_reason: string | null;
  quality_custom_reason: string | null;
  delivery_date: string | null; // YYYY-MM-DD
  delivery_remarks: string | null;
  delivery_qty: string | null;
  body_delivered?: boolean;
  body_delivery_date?: string | null;
  trims_delivered?: boolean;
  trims_delivery_date?: string | null;
  rework_count: number;
  rework_type: 'Dyeing' | 'Finishing' | null;
  created_at: string;
  updated_at: string;

  // Joined/Enriched fields for convenience
  fabric_type_name?: string;
  badge_color?: string;
  stages?: Record<StageKey, StageStatus>;
  stages_list?: BatchStage[];
  rework_logs?: ReworkLog[];
}

export interface DatabaseSchema {
  admin: {
    username: string;
    password_hash: string;
    created_at: string;
  };
  fabric_types: FabricType[];
  batches: Batch[];
  batch_stages: BatchStage[];
  rework_logs?: ReworkLog[];
}

export interface OCRResult {
  buyer?: string;
  buyer_reference?: string;
  batch_number?: string;
  order_number?: string;
  color?: string;
  fabric_type?: string;
  fabric_quantity?: number;
  trims?: string;
  trims_quantity?: string;
  remarks?: string;
  machine_number?: string;
  lot_number?: string;
}
