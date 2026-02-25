/**
 * LOCAL COPY - DO NOT MODIFY
 * This file is frozen as part of Bilirkisi1Independent page isolation
 */

/**
 * Device UUID Management
 * Generates and stores a unique device identifier
 */

export function getDeviceUUID(): string {
  let uuid = localStorage.getItem("deviceUUID");
  
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem("deviceUUID", uuid);
    console.log("[DeviceUUID] New device UUID generated:", uuid);
  }
  
  return uuid;
}

export function resetDeviceUUID(): void {
  localStorage.removeItem("deviceUUID");
  console.log("[DeviceUUID] Device UUID reset");
}

export function getDeviceInfo(): { uuid: string; browser: string; os: string } {
  const uuid = getDeviceUUID();
  const userAgent = navigator.userAgent;
  
  let browser = "Unknown";
  if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Safari")) browser = "Safari";
  else if (userAgent.includes("Edge")) browser = "Edge";
  
  let os = "Unknown";
  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iOS")) os = "iOS";
  
  return { uuid, browser, os };
}
