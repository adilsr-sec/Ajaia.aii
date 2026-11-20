import "dotenv/config";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "../prisma/seed";
import { signUserId, verifySignedUserId } from "@/lib/auth";
import {
  createDocument,
  deleteDocument,
  getDocumentById,
  listDocumentsForUser,
  revokeDocumentShare,
  updateDocument,
  upsertDocumentShare,
} from "@/lib/documents";
import { ServiceError } from "@/lib/errors";
import { importDocumentFromFile, MAX_IMPORT_FILE_SIZE } from "@/lib/importer";

const TEST_SCHEMA = "vitest_isolated";

function withSchema(connectionUrl: string, schema: string): string {
  const url = new URL(connectionUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

const basePooledUrl = process.env.DATABASE_URL;
const baseDirectUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!basePooledUrl || !baseDirectUrl) {
  throw new Error("DATABASE_URL must be set to run integration tests");
}

const testPooledUrl = withSchema(basePooledUrl, TEST_SCHEMA);
const testDirectUrl = withSchema(baseDirectUrl, TEST_SCHEMA);

let db: PrismaClient;
let aliceId: string;
let bobId: string;
let charlieId: string;

async function expectServiceError(
  promise: Promise<unknown>,
  expectedStatus: number
): Promise<ServiceError> {
  try {
    await promise;
    throw new Error(`Expected ServiceError(${expectedStatus}) but resolved`);
  } catch (err) {
    expect(err).toBeInstanceOf(ServiceError);
    const serviceErr = err as ServiceError;
    expect(serviceErr.status).toBe(expectedStatus);
    return serviceErr;
  }
}

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: {
      ...process.env,
      DATABASE_URL: testPooledUrl,
      DATABASE_URL_UNPOOLED: testDirectUrl,
    },
    stdio: "pipe",
  });

  db = new PrismaClient({
    datasources: {
      db: { url: testPooledUrl },
    },
  });

  const seeded = await seedDatabase(db);
  aliceId = seeded.alice.id;
  bobId = seeded.bob.id;
  charlieId = seeded.charlie.id;
});

afterAll(async () => {
  if (db) {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await db.$disconnect();
  }
});

describe("Session signing", () => {
  it("signs and verifies user IDs and rejects tampered tokens", () => {
    const token = signUserId(aliceId);
    expect(verifySignedUserId(token)).toBe(aliceId);
    expect(verifySignedUserId(`${token}tampered`)).toBeNull();
    expect(verifySignedUserId("invalid-token")).toBeNull();
    expect(verifySignedUserId(undefined)).toBeNull();
  });
});

describe("Document lifecycle & XSS sanitization", () => {
  it("creates, renames, saves rich-text formatting, reloads cleanly, and strips XSS payloads", async () => {
    const created = await createDocument(
      aliceId,
      {
        title: "  Sprint Retrospective  ",
        contentHtml: "<p>Initial draft</p>",
      },
      db
    );

    expect(created.title).toBe("Sprint Retrospective");
    expect(created.role).toBe("OWNER");
    expect(created.isOwner).toBe(true);
    expect(created.canEdit).toBe(true);

    const richHtmlWithXss = [
      "<h1>Sprint 14 Review</h1>",
      "<h2>Highlights</h2>",
      "<h3>Action Items</h3>",
      "<p>Shipped <strong>editor</strong>, <em>importer</em>, and <u>sharing</u>.</p>",
      "<ul><li><p>Bullet one</p></li></ul>",
      "<ol><li><p>Step one</p></li></ol>",
      `<script>window.__xss = true; alert("xss")</script>`,
      `<p onclick="alert(1)">Safe text without handler</p>`,
      `<img src="x" onerror="alert(2)" />`,
    ].join("");

    const updated = await updateDocument(
      aliceId,
      created.id,
      {
        title: "Sprint 14 Retrospective (Final)",
        contentHtml: richHtmlWithXss,
      },
      db
    );

    expect(updated.title).toBe("Sprint 14 Retrospective (Final)");

    const reloaded = await getDocumentById(aliceId, created.id, db);
    expect(reloaded.title).toBe("Sprint 14 Retrospective (Final)");
    expect(reloaded.contentHtml).toContain("<h1>Sprint 14 Review</h1>");
    expect(reloaded.contentHtml).toContain("<h2>Highlights</h2>");
    expect(reloaded.contentHtml).toContain("<h3>Action Items</h3>");
    expect(reloaded.contentHtml).toContain("<strong>editor</strong>");
    expect(reloaded.contentHtml).toContain("<em>importer</em>");
    expect(reloaded.contentHtml).toContain("<u>sharing</u>");
    expect(reloaded.contentHtml).toContain("<ul>");
    expect(reloaded.contentHtml).toContain("<ol>");
    expect(reloaded.contentHtml).toContain("Safe text without handler");

    // Verify XSS payloads and event handlers were stripped
    expect(reloaded.contentHtml).not.toContain("<script");
    expect(reloaded.contentHtml).not.toContain("__xss");
    expect(reloaded.contentHtml).not.toContain("onclick");
    expect(reloaded.contentHtml).not.toContain("onerror");
    expect(reloaded.contentHtml).not.toContain("<img");
  });
});

describe("File import (.md and .txt)", () => {
  it("imports valid .md and .txt files into sanitized formatted documents", async () => {
    const mdContent = [
      "# Architecture Notes",
      "",
      "This is **bold** and *italic*.",
      "",
      "- Item A",
      "- Item B",
      "",
      `<script>alert("bad")</script>`,
    ].join("\n");

    const mdDoc = await importDocumentFromFile(
      aliceId,
      {
        filename: "Architecture-Notes.md",
        size: Buffer.byteLength(mdContent, "utf8"),
        content: mdContent,
      },
      db
    );

    expect(mdDoc.title).toBe("Architecture-Notes");
    expect(mdDoc.contentHtml).toContain("<h1>Architecture Notes</h1>");
    expect(mdDoc.contentHtml).toContain("<strong>bold</strong>");
    expect(mdDoc.contentHtml).toContain("<em>italic</em>");
    expect(mdDoc.contentHtml).toContain("<ul>");
    expect(mdDoc.contentHtml).not.toContain("<script");

    const txtContent =
      "First line <script>nope</script>\nSecond line\n\nSecond paragraph";
    const txtDoc = await importDocumentFromFile(
      bobId,
      {
        filename: "Meeting Notes.TXT",
        size: Buffer.byteLength(txtContent, "utf8"),
        content: txtContent,
      },
      db
    );

    expect(txtDoc.title).toBe("Meeting Notes");
    expect(txtDoc.contentHtml).toContain(
      "<p>First line &lt;script&gt;nope&lt;/script&gt;<br />Second line</p>"
    );
    expect(txtDoc.contentHtml).toContain("<p>Second paragraph</p>");
  });

  it("rejects unsupported file extensions, empty files, and oversized files with 400", async () => {
    await expectServiceError(
      importDocumentFromFile(
        aliceId,
        {
          filename: "report.pdf",
          size: 1024,
          content: "%PDF-1.4 binary",
        },
        db
      ),
      400
    );

    await expectServiceError(
      importDocumentFromFile(
        aliceId,
        {
          filename: "empty.txt",
          size: 0,
          content: "",
        },
        db
      ),
      400
    );

    await expectServiceError(
      importDocumentFromFile(
        aliceId,
        {
          filename: "huge.md",
          size: MAX_IMPORT_FILE_SIZE + 1,
          content: "a",
        },
        db
      ),
      400
    );
  });
});

describe("Sharing and access control", () => {
  it("enforces VIEWER, EDITOR, non-owner restrictions, and immediate revocation", async () => {
    const doc = await createDocument(
      aliceId,
      {
        title: "Security Audit Plan",
        contentHtml: "<p>Confidential audit steps</p>",
      },
      db
    );

    // 1. Unshared user (Charlie) is blocked on read, edit, share, and delete
    await expectServiceError(getDocumentById(charlieId, doc.id, db), 403);
    await expectServiceError(
      updateDocument(charlieId, doc.id, { title: "Hijacked" }, db),
      403
    );
    await expectServiceError(
      upsertDocumentShare(
        charlieId,
        doc.id,
        { email: "bob@ajaia.demo", role: "EDITOR" },
        db
      ),
      403
    );
    await expectServiceError(deleteDocument(charlieId, doc.id, db), 403);

    // Owner cannot share with self (400) or unknown user (404)
    await expectServiceError(
      upsertDocumentShare(
        aliceId,
        doc.id,
        { email: "alice@ajaia.demo", role: "EDITOR" },
        db
      ),
      400
    );
    await expectServiceError(
      upsertDocumentShare(
        aliceId,
        doc.id,
        { email: "nobody@ajaia.demo", role: "VIEWER" },
        db
      ),
      404
    );

    // 2. Owner shares with Charlie as VIEWER -> Charlie can read, cannot edit/share/delete
    const viewerShare = await upsertDocumentShare(
      aliceId,
      doc.id,
      { email: "charlie@ajaia.demo", role: "VIEWER" },
      db
    );
    expect(viewerShare.share.role).toBe("VIEWER");

    const charlieRead = await getDocumentById(charlieId, doc.id, db);
    expect(charlieRead.role).toBe("VIEWER");
    expect(charlieRead.canEdit).toBe(false);
    expect(charlieRead.isOwner).toBe(false);

    await expectServiceError(
      updateDocument(
        charlieId,
        doc.id,
        { contentHtml: "<p>Viewer attempt</p>" },
        db
      ),
      403
    );

    // Verify document appears in Charlie's sharedWithMe list
    const charlieLists = await listDocumentsForUser(charlieId, db);
    const sharedEntry = charlieLists.sharedWithMe.find((d) => d.id === doc.id);
    expect(sharedEntry?.role).toBe("VIEWER");

    // 3. Owner upgrades Charlie to EDITOR via upsert -> Charlie can edit, still cannot share or delete
    const editorShare = await upsertDocumentShare(
      aliceId,
      doc.id,
      { email: "charlie@ajaia.demo", role: "EDITOR" },
      db
    );
    expect(editorShare.share.role).toBe("EDITOR");
    expect(editorShare.shares).toHaveLength(1);

    const charlieEdited = await updateDocument(
      charlieId,
      doc.id,
      { contentHtml: "<p>Updated by Charlie as Editor</p>" },
      db
    );
    expect(charlieEdited.contentHtml).toBe(
      "<p>Updated by Charlie as Editor</p>"
    );
    expect(charlieEdited.role).toBe("EDITOR");
    expect(charlieEdited.canEdit).toBe(true);

    // Non-owner Editor still cannot share or delete
    await expectServiceError(
      upsertDocumentShare(
        charlieId,
        doc.id,
        { email: "bob@ajaia.demo", role: "VIEWER" },
        db
      ),
      403
    );
    await expectServiceError(deleteDocument(charlieId, doc.id, db), 403);

    // 4. Owner revokes Charlie's share -> immediate 403
    const revoked = await revokeDocumentShare(aliceId, doc.id, charlieId, db);
    expect(revoked.revoked).toBe(true);

    await expectServiceError(getDocumentById(charlieId, doc.id, db), 403);
    await expectServiceError(
      updateDocument(charlieId, doc.id, { title: "After revoke" }, db),
      403
    );

    // 5. Owner deletes document -> 404 thereafter
    const deleted = await deleteDocument(aliceId, doc.id, db);
    expect(deleted.deleted).toBe(true);
    await expectServiceError(getDocumentById(aliceId, doc.id, db), 404);
  });
});
