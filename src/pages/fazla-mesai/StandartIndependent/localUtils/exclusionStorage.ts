/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of StandartIndependent page isolation
 */

import { API_BASE_URL } from "./apiClient";

export interface ExcludedDay {
  id: string;
  type: string;
  start: string;
  end: string;
  days: number;
}

export interface SavedExclusionSet {
  id: number;
  name: string;
  data: ExcludedDay[];
  createdAt: string;
}

const API_BASE = `${API_BASE_URL}/api/exclusion-sets`;

export async function getAllExclusionSets(): Promise<SavedExclusionSet[]> {
  try {
    const token = localStorage.getItem("access_token");
    const tenantId = localStorage.getItem("tenant_id");
    const response = await fetch(API_BASE, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      },
    });
    
    if (!response.ok) {
      console.error("API error:", response.status);
      return [];
    }
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Dışlama setleri yüklenemedi:", error);
    return [];
  }
}

export async function saveExclusionSet(name: string, data: ExcludedDay[]): Promise<boolean> {
  try {
    const token = localStorage.getItem("access_token");
    const tenantId = localStorage.getItem("tenant_id");
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      },
      body: JSON.stringify({ name, data }),
    });
    
    if (!response.ok) {
      console.error("API error:", response.status);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Dışlama seti kaydedilemedi:", error);
    return false;
  }
}

export async function loadExclusionSet(name: string): Promise<ExcludedDay[]> {
  try {
    const sets = await getAllExclusionSets();
    const found = sets.find(s => s.name === name);
    return found?.data || [];
  } catch (error) {
    console.error("Dışlama seti yüklenemedi:", error);
    return [];
  }
}

export async function deleteExclusionSet(id: number): Promise<boolean> {
  try {
    const token = localStorage.getItem("access_token");
    const tenantId = localStorage.getItem("tenant_id");
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { "x-tenant-id": tenantId } : {}),
      },
    });
    
    if (!response.ok) {
      console.error("API error:", response.status);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Dışlama seti silinemedi:", error);
    return false;
  }
}
