import sqlite3 from "sqlite3";
import { open } from "sqlite";

export interface VeramoDatabaseCredential {
  hash: string;
  raw: string;
  id: string;
  issuanceDate: string;
  expirationDate: string;
  context: string;
  type: string;
  issuerDid: string;
  subjectDid: string;
}

export class VeramoDatabase {
    private async openDb() {
      return open({
        filename: "/Users/phantientai/Desktop/Pre-thesis/veramo-agent/database.sqlite",
        driver: sqlite3.Database,
      });
    }
  
    async getAllCredentials(): Promise<[VeramoDatabaseCredential]> {
      let db;
      try {
        db = await this.openDb();
        const allCredentials: [VeramoDatabaseCredential] = await db.all("SELECT * FROM credential");
        return allCredentials;
      } catch (error) {
        return error as any;
      } finally {
        if (db !== undefined) await db.close();
      }
    }
  
    async deleteCredential(hash: string): Promise<boolean> {
      let db;
      try {
        db = await this.openDb();
        await db.exec(`DELETE FROM credential WHERE hash='${hash}'`);
        return true;
      } catch (error) {
        return error as any;
      } finally {
        if (db !== undefined) await db.close();
      }
    }
  }