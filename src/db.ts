import Dexie, { type EntityTable } from "dexie";

export type Note = {
  id?: number;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type Setting = {
  key: string;
  value: string;
};

class LocalKitDB extends Dexie {
  notes!: EntityTable<Note, "id">;
  settings!: EntityTable<Setting, "key">;

  constructor() {
    super("LocalKitDB");

    this.version(1).stores({
      notes: "++id,updatedAt,*tags",
      settings: "&key"
    });
  }
}

export const db = new LocalKitDB();
