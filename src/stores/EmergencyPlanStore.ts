import { makeAutoObservable, runInAction } from 'mobx';
import { SQLiteDatabase } from '../types/database-types';

let SQLite: any;
try {
  SQLite = require('react-native-sqlite-storage');
} catch {
  SQLite = null as any;
}

/**
 * Represents a single emergency contact.
 */
export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Represents a rally point (meeting location).
 */
export interface RallyPoint {
  id: string;
  name: string;
  description: string;
  coordinates?: string; // optional "lat, lng" or address string
  createdAt: number;
  updatedAt: number;
}

/**
 * Structured communication plan template.
 */
export interface CommunicationPlan {
  whoCallsWhom: string;
  ifPhonesDown: string;
  outOfAreaContact: string;
  checkInSchedule: string;
  updatedAt: number;
}

const EMPTY_COMMUNICATION_PLAN: CommunicationPlan = {
  whoCallsWhom: '',
  ifPhonesDown: '',
  outOfAreaContact: '',
  checkInSchedule: '',
  updatedAt: 0,
};

function hasCommunicationPlan(
  plan: CommunicationPlan | null | undefined,
): plan is CommunicationPlan {
  return Boolean(plan && plan.updatedAt > 0);
}

/**
 * Store for managing emergency contacts, rally points, and a communication plan.
 * Follows the same pattern as InventoryStore.
 */
export class EmergencyPlanStore {
  db: SQLiteDatabase | null = null;
  contacts: EmergencyContact[] = [];
  rallyPoints: RallyPoint[] = [];
  communicationPlan: CommunicationPlan = { ...EMPTY_COMMUNICATION_PLAN };

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * Generates a unique ID using timestamp and random string.
   * @private
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Initializes the database connection and loads data.
   */
  async initDatabase(): Promise<void> {
    if (!SQLite) {
      console.warn(
        'SQLite not available for EmergencyPlanStore, using in-memory storage',
      );
      return;
    }

    try {
      this.db = await SQLite.openDatabase({
        name: 'toast.db',
        location: 'default',
      });
      await this.createTables();
      await this.loadContacts();
      await this.loadRallyPoints();
      await this.loadCommunicationPlan();
    } catch (error) {
      console.error('Failed to initialize emergency plan database:', error);
    }
  }

  /**
   * Creates the necessary database tables.
   */
  private async createTables(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.executeSql(
        'CREATE TABLE IF NOT EXISTS emergency_contacts (' +
          'id TEXT PRIMARY KEY, ' +
          'name TEXT NOT NULL, ' +
          'relationship TEXT NOT NULL, ' +
          'phone TEXT NOT NULL, ' +
          'notes TEXT, ' +
          'createdAt INTEGER NOT NULL, ' +
          'updatedAt INTEGER NOT NULL' +
          ')',
      );

      await this.db.executeSql(
        'CREATE TABLE IF NOT EXISTS rally_points (' +
          'id TEXT PRIMARY KEY, ' +
          'name TEXT NOT NULL, ' +
          'description TEXT NOT NULL, ' +
          'coordinates TEXT, ' +
          'createdAt INTEGER NOT NULL, ' +
          'updatedAt INTEGER NOT NULL' +
          ')',
      );

      await this.db.executeSql(
        // This table is designed to hold exactly one row (id = 1).
        // saveCommunicationPlan always uses INSERT OR REPLACE with id = 1
        // so only one row ever exists.
        'CREATE TABLE IF NOT EXISTS communication_plan (' +
          'id INTEGER PRIMARY KEY DEFAULT 1, ' +
          "whoCallsWhom TEXT NOT NULL DEFAULT '', " +
          "ifPhonesDown TEXT NOT NULL DEFAULT '', " +
          "outOfAreaContact TEXT NOT NULL DEFAULT '', " +
          "checkInSchedule TEXT NOT NULL DEFAULT '', " +
          'updatedAt INTEGER NOT NULL DEFAULT 0' +
          ')',
      );
    } catch (error) {
      console.error('Failed to create emergency plan tables:', error);
    }
  }

  /**
   * Loads all emergency contacts from the database.
   */
  private async loadContacts(): Promise<void> {
    if (!this.db) return;

    try {
      const [results] = await this.db.executeSql(
        'SELECT * FROM emergency_contacts ORDER BY name ASC',
      );

      if (results && results.rows && results.rows.length > 0) {
        const loaded: EmergencyContact[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          const row = results.rows.item(i);
          loaded.push({
            id: row.id,
            name: row.name,
            relationship: row.relationship,
            phone: row.phone,
            notes: row.notes || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          });
        }
        runInAction(() => {
          this.contacts = loaded;
        });
      }
    } catch (error) {
      console.error('Failed to load emergency contacts:', error);
    }
  }

  /**
   * Loads all rally points from the database.
   */
  private async loadRallyPoints(): Promise<void> {
    if (!this.db) return;

    try {
      const [results] = await this.db.executeSql(
        'SELECT * FROM rally_points ORDER BY name ASC',
      );

      if (results && results.rows && results.rows.length > 0) {
        const loaded: RallyPoint[] = [];
        for (let i = 0; i < results.rows.length; i++) {
          const row = results.rows.item(i);
          loaded.push({
            id: row.id,
            name: row.name,
            description: row.description,
            coordinates: row.coordinates || undefined,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          });
        }
        runInAction(() => {
          this.rallyPoints = loaded;
        });
      }
    } catch (error) {
      console.error('Failed to load rally points:', error);
    }
  }

  /**
   * Loads the communication plan from the database.
   */
  private async loadCommunicationPlan(): Promise<void> {
    if (!this.db) return;

    try {
      const [results] = await this.db.executeSql(
        'SELECT * FROM communication_plan WHERE id = 1',
      );

      if (results && results.rows && results.rows.length > 0) {
        const row = results.rows.item(0);
        runInAction(() => {
          this.communicationPlan = {
            whoCallsWhom: row.whoCallsWhom,
            ifPhonesDown: row.ifPhonesDown,
            outOfAreaContact: row.outOfAreaContact,
            checkInSchedule: row.checkInSchedule,
            updatedAt: row.updatedAt,
          };
        });
      }
    } catch (error) {
      console.error('Failed to load communication plan:', error);
    }
  }

  // ─── Emergency Contacts ────────────────────────────────────────────────────

  /**
   * Creates a new emergency contact.
   */
  async createContact(
    name: string,
    relationship: string,
    phone: string,
    notes?: string,
  ): Promise<EmergencyContact> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Contact name is required');
    if (!relationship.trim()) throw new Error('Relationship is required');
    if (!phone.trim()) throw new Error('Phone number is required');

    const now = Date.now();
    const contact: EmergencyContact = {
      id: this.generateId(),
      name: trimmedName,
      relationship: relationship.trim(),
      phone: phone.trim(),
      notes: notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    if (this.db) {
      try {
        await this.db.executeSql(
          'INSERT INTO emergency_contacts (id, name, relationship, phone, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            contact.id,
            contact.name,
            contact.relationship,
            contact.phone,
            contact.notes || null,
            contact.createdAt,
            contact.updatedAt,
          ],
        );
      } catch (error) {
        console.error('Failed to create emergency contact:', error);
        throw new Error('Failed to save contact');
      }
    }

    runInAction(() => {
      this.contacts.push(contact);
      this.contacts.sort((a, b) => a.name.localeCompare(b.name));
    });

    return contact;
  }

  /**
   * Updates an existing emergency contact.
   */
  async updateContact(
    id: string,
    updates: Partial<Omit<EmergencyContact, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const contact = this.contacts.find((c) => c.id === id);
    if (!contact) throw new Error('Contact not found');

    const updated: EmergencyContact = {
      ...contact,
      ...updates,
      updatedAt: Date.now(),
    };

    if (this.db) {
      try {
        await this.db.executeSql(
          'UPDATE emergency_contacts SET name = ?, relationship = ?, phone = ?, notes = ?, updatedAt = ? WHERE id = ?',
          [
            updated.name,
            updated.relationship,
            updated.phone,
            updated.notes || null,
            updated.updatedAt,
            id,
          ],
        );
      } catch (error) {
        console.error('Failed to update emergency contact:', error);
        throw new Error('Failed to update contact');
      }
    }

    runInAction(() => {
      const index = this.contacts.findIndex((c) => c.id === id);
      if (index !== -1) {
        this.contacts[index] = updated;
        this.contacts.sort((a, b) => a.name.localeCompare(b.name));
      }
    });
  }

  /**
   * Deletes an emergency contact.
   */
  async deleteContact(id: string): Promise<void> {
    const contact = this.contacts.find((c) => c.id === id);
    if (!contact) throw new Error('Contact not found');

    if (this.db) {
      try {
        await this.db.executeSql(
          'DELETE FROM emergency_contacts WHERE id = ?',
          [id],
        );
      } catch (error) {
        console.error('Failed to delete emergency contact:', error);
        throw new Error('Failed to delete contact');
      }
    }

    runInAction(() => {
      this.contacts = this.contacts.filter((c) => c.id !== id);
    });
  }

  // ─── Rally Points ──────────────────────────────────────────────────────────

  /**
   * Creates a new rally point.
   */
  async createRallyPoint(
    name: string,
    description: string,
    coordinates?: string,
  ): Promise<RallyPoint> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Rally point name is required');
    if (!description.trim()) throw new Error('Description is required');

    const now = Date.now();
    const rallyPoint: RallyPoint = {
      id: this.generateId(),
      name: trimmedName,
      description: description.trim(),
      coordinates: coordinates?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    if (this.db) {
      try {
        await this.db.executeSql(
          'INSERT INTO rally_points (id, name, description, coordinates, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          [
            rallyPoint.id,
            rallyPoint.name,
            rallyPoint.description,
            rallyPoint.coordinates || null,
            rallyPoint.createdAt,
            rallyPoint.updatedAt,
          ],
        );
      } catch (error) {
        console.error('Failed to create rally point:', error);
        throw new Error('Failed to save rally point');
      }
    }

    runInAction(() => {
      this.rallyPoints.push(rallyPoint);
      this.rallyPoints.sort((a, b) => a.name.localeCompare(b.name));
    });

    return rallyPoint;
  }

  /**
   * Updates an existing rally point.
   */
  async updateRallyPoint(
    id: string,
    updates: Partial<Omit<RallyPoint, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const rallyPoint = this.rallyPoints.find((r) => r.id === id);
    if (!rallyPoint) throw new Error('Rally point not found');

    const updated: RallyPoint = {
      ...rallyPoint,
      ...updates,
      updatedAt: Date.now(),
    };

    if (this.db) {
      try {
        await this.db.executeSql(
          'UPDATE rally_points SET name = ?, description = ?, coordinates = ?, updatedAt = ? WHERE id = ?',
          [
            updated.name,
            updated.description,
            updated.coordinates || null,
            updated.updatedAt,
            id,
          ],
        );
      } catch (error) {
        console.error('Failed to update rally point:', error);
        throw new Error('Failed to update rally point');
      }
    }

    runInAction(() => {
      const index = this.rallyPoints.findIndex((r) => r.id === id);
      if (index !== -1) {
        this.rallyPoints[index] = updated;
        this.rallyPoints.sort((a, b) => a.name.localeCompare(b.name));
      }
    });
  }

  /**
   * Deletes a rally point.
   */
  async deleteRallyPoint(id: string): Promise<void> {
    const rallyPoint = this.rallyPoints.find((r) => r.id === id);
    if (!rallyPoint) throw new Error('Rally point not found');

    if (this.db) {
      try {
        await this.db.executeSql('DELETE FROM rally_points WHERE id = ?', [id]);
      } catch (error) {
        console.error('Failed to delete rally point:', error);
        throw new Error('Failed to delete rally point');
      }
    }

    runInAction(() => {
      this.rallyPoints = this.rallyPoints.filter((r) => r.id !== id);
    });
  }

  // ─── Communication Plan ────────────────────────────────────────────────────

  /**
   * Saves the communication plan (upsert).
   */
  async saveCommunicationPlan(
    plan: Omit<CommunicationPlan, 'updatedAt'>,
  ): Promise<void> {
    const updated: CommunicationPlan = {
      ...plan,
      updatedAt: Date.now(),
    };

    if (this.db) {
      try {
        await this.db.executeSql(
          'INSERT OR REPLACE INTO communication_plan (id, whoCallsWhom, ifPhonesDown, outOfAreaContact, checkInSchedule, updatedAt) VALUES (1, ?, ?, ?, ?, ?)',
          [
            updated.whoCallsWhom,
            updated.ifPhonesDown,
            updated.outOfAreaContact,
            updated.checkInSchedule,
            updated.updatedAt,
          ],
        );
      } catch (error) {
        console.error('Failed to save communication plan:', error);
        throw new Error('Failed to save communication plan');
      }
    }

    runInAction(() => {
      this.communicationPlan = updated;
    });
  }

  /**
   * Replaces or merges emergency plan data imported from a backup.
   * In replace mode all existing contacts, rally points, and communication
   * plan are removed before inserting the backup data.
   * In merge mode only records whose IDs do not already exist are inserted.
   */
  async importData(
    contacts: EmergencyContact[],
    rallyPoints: RallyPoint[],
    communicationPlan: CommunicationPlan | null,
    mode: 'replace' | 'merge',
  ): Promise<void> {
    if (this.db) {
      try {
        await this.db.executeSql('BEGIN TRANSACTION');
        if (mode === 'replace') {
          await this.db.executeSql('DELETE FROM emergency_contacts');
          await this.db.executeSql('DELETE FROM rally_points');
          await this.db.executeSql('DELETE FROM communication_plan');
        }
        const contactSql =
          mode === 'replace'
            ? 'INSERT OR REPLACE INTO emergency_contacts (id, name, relationship, phone, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
            : 'INSERT OR IGNORE INTO emergency_contacts (id, name, relationship, phone, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)';
        for (const c of contacts) {
          await this.db.executeSql(contactSql, [
            c.id,
            c.name,
            c.relationship,
            c.phone,
            c.notes ?? null,
            c.createdAt,
            c.updatedAt,
          ]);
        }
        const rallyPointSql =
          mode === 'replace'
            ? 'INSERT OR REPLACE INTO rally_points (id, name, description, coordinates, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
            : 'INSERT OR IGNORE INTO rally_points (id, name, description, coordinates, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)';
        for (const r of rallyPoints) {
          await this.db.executeSql(rallyPointSql, [
            r.id,
            r.name,
            r.description,
            r.coordinates ?? null,
            r.createdAt,
            r.updatedAt,
          ]);
        }
        if (hasCommunicationPlan(communicationPlan)) {
          await this.db.executeSql(
            'INSERT OR REPLACE INTO communication_plan (id, whoCallsWhom, ifPhonesDown, outOfAreaContact, checkInSchedule, updatedAt) VALUES (1, ?, ?, ?, ?, ?)',
            [
              communicationPlan.whoCallsWhom,
              communicationPlan.ifPhonesDown,
              communicationPlan.outOfAreaContact,
              communicationPlan.checkInSchedule,
              communicationPlan.updatedAt,
            ],
          );
        }
        await this.db.executeSql('COMMIT');
      } catch (error) {
        await this.db.executeSql('ROLLBACK');
        throw error;
      }
    }
    runInAction(() => {
      if (mode === 'replace') {
        this.contacts = contacts;
        this.rallyPoints = rallyPoints;
        this.communicationPlan = hasCommunicationPlan(communicationPlan)
          ? communicationPlan
          : {
              ...EMPTY_COMMUNICATION_PLAN,
            };
      } else {
        const existingContactIds = new Set(this.contacts.map((c) => c.id));
        const newContacts = contacts.filter(
          (c) => !existingContactIds.has(c.id),
        );
        this.contacts = [...this.contacts, ...newContacts].sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        const existingRallyIds = new Set(this.rallyPoints.map((r) => r.id));
        const newRallyPoints = rallyPoints.filter(
          (r) => !existingRallyIds.has(r.id),
        );
        this.rallyPoints = [...this.rallyPoints, ...newRallyPoints].sort(
          (a, b) => a.name.localeCompare(b.name),
        );

        if (
          hasCommunicationPlan(communicationPlan) &&
          this.communicationPlan.updatedAt === 0
        ) {
          this.communicationPlan = communicationPlan;
        }
      }
    });
  }

  /**
   * Cleans up resources.
   */
  dispose(): void {
    // Cleanup if needed
  }
}
