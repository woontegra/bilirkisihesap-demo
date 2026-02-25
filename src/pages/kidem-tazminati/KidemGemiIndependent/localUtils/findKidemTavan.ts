import { KIDEM_TAVAN_DONEMLERI } from "../localConstants/kidemTavan";

export function findKidemTavan(exitDate: Date): number | null {
  const normalizedExitDate = new Date(exitDate.getFullYear(), exitDate.getMonth(), exitDate.getDate());

  for (const d of KIDEM_TAVAN_DONEMLERI) {
    const startParts = d.start.split(".");
    const endParts = d.end.split(".");

    const start = new Date(
      parseInt(startParts[2], 10),
      parseInt(startParts[1], 10) - 1,
      parseInt(startParts[0], 10)
    );

    const end = new Date(
      parseInt(endParts[2], 10),
      parseInt(endParts[1], 10) - 1,
      parseInt(endParts[0], 10)
    );

    if (normalizedExitDate >= start && normalizedExitDate <= end) {
      return d.tavan;
    }
  }
  return null;
}
