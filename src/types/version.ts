/**
 * Version History Types
 */

export interface VersionSnapshot {
  id: string;
  timestamp: number;
  description: string;
  author: string;
  cellsData: string;  // Serialized cells
  graphsData: string;  // Serialized graphs
}

export interface VersionState {
  snapshots: VersionSnapshot[];
  currentIndex: number;
  autoSaveEnabled: boolean;
  lastAutoSave: number;
}
