const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const API_BASE = `${API_BASE_URL}/api/extra-calculations-sets`;

export interface ExtraItem {
  id: string;
  name: string;
  value: string;
}

export interface SavedExtraCalculationsSet {
  id: number;
  name: string;
  data: ExtraItem[];
  createdAt: string;
}

export async function getAllExtraCalculationsSets(): Promise<SavedExtraCalculationsSet[]> {
  try {
    const token = localStorage.getItem("access_token");
    const tenantId = localStorage.getItem("tenant_id") || "1";
    const response = await fetch(API_BASE, {
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data || [];
  } catch {
    return [];
  }
}

export async function saveExtraCalculationsSet(name: string, data: ExtraItem[]): Promise<boolean> {
  try {
    const token = localStorage.getItem("access_token");
    const tenantId = localStorage.getItem("tenant_id") || "1";
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ name, data }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function loadExtraCalculationsSet(name: string): Promise<ExtraItem[]> {
  try {
    const sets = await getAllExtraCalculationsSets();
    const found = sets.find((s) => s.name === name);
    return found?.data || [];
  } catch {
    return [];
  }
}

export async function deleteExtraCalculationsSet(id: number): Promise<boolean> {
  try {
    const token = localStorage.getItem("access_token");
    const tenantId = localStorage.getItem("tenant_id") || "1";
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
