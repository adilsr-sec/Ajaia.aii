import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/errors";
import { sanitizeRichHtml, sanitizeTitle } from "@/lib/sanitize";
import type { UserSummary } from "@/lib/auth";

export type ShareRole = "EDITOR" | "VIEWER";
export type DocumentRole = "OWNER" | ShareRole;

export interface DocumentSummary {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerAvatarColor: string;
  updatedAt: string;
  createdAt: string;
  shareCount: number;
  role: DocumentRole;
  lastEditedByName: string | null;
}

export interface DocumentShareItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  role: ShareRole;
  createdAt: string;
}

export interface DocumentDetail {
  id: string;
  title: string;
  contentHtml: string;
  ownerId: string;
  owner: UserSummary;
  lastEditedBy: UserSummary | null;
  shares: DocumentShareItem[];
  role: DocumentRole;
  isOwner: boolean;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createDocumentSchema = z.object({
  title: z.string().trim().max(120, "Title must be 120 characters or fewer").optional(),
  contentHtml: z.string().optional(),
});

export const updateDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(120, "Title must be 120 characters or fewer")
      .optional(),
    contentHtml: z.string().optional(),
  })
  .refine(
    (data) => data.title !== undefined || data.contentHtml !== undefined,
    { message: "Provide title or contentHtml to update" }
  );

export const shareDocumentSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  role: z.enum(["EDITOR", "VIEWER"]).optional().default("EDITOR"),
});

function normalizeShareRole(role: string): ShareRole {
  return role === "VIEWER" ? "VIEWER" : "EDITOR";
}

function formatDocumentDetail(
  doc: {
    id: string;
    title: string;
    contentHtml: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    owner: UserSummary;
    lastEditedBy: UserSummary | null;
    shares: Array<{
      id: string;
      userId: string;
      role: string;
      createdAt: Date;
      user: UserSummary;
    }>;
  },
  role: DocumentRole
): DocumentDetail {
  const isOwner = role === "OWNER";
  const canEdit = role === "OWNER" || role === "EDITOR";

  return {
    id: doc.id,
    title: doc.title,
    contentHtml: doc.contentHtml,
    ownerId: doc.ownerId,
    owner: doc.owner,
    lastEditedBy: doc.lastEditedBy,
    shares: doc.shares.map((s) => ({
      id: s.id,
      userId: s.userId,
      name: s.user.name,
      email: s.user.email,
      avatarColor: s.user.avatarColor,
      role: normalizeShareRole(s.role),
      createdAt: s.createdAt.toISOString(),
    })),
    role,
    isOwner,
    canEdit,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

const documentDetailInclude = {
  owner: {
    select: { id: true, name: true, email: true, avatarColor: true },
  },
  lastEditedBy: {
    select: { id: true, name: true, email: true, avatarColor: true },
  },
  shares: {
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarColor: true },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function listDocumentsForUser(
  currentUserId: string,
  db: PrismaClient = prisma
): Promise<{
  owned: DocumentSummary[];
  sharedWithMe: DocumentSummary[];
}> {
  const [ownedDocs, sharedDocs] = await Promise.all([
    db.document.findMany({
      where: { ownerId: currentUserId },
      orderBy: { updatedAt: "desc" },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        lastEditedBy: {
          select: { name: true },
        },
        _count: {
          select: { shares: true },
        },
      },
    }),
    db.document.findMany({
      where: {
        ownerId: { not: currentUserId },
        shares: {
          some: { userId: currentUserId },
        },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarColor: true },
        },
        lastEditedBy: {
          select: { name: true },
        },
        shares: {
          where: { userId: currentUserId },
          select: { role: true },
        },
        _count: {
          select: { shares: true },
        },
      },
    }),
  ]);

  const owned: DocumentSummary[] = ownedDocs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    ownerId: doc.ownerId,
    ownerName: doc.owner.name,
    ownerEmail: doc.owner.email,
    ownerAvatarColor: doc.owner.avatarColor,
    updatedAt: doc.updatedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    shareCount: doc._count.shares,
    role: "OWNER",
    lastEditedByName: doc.lastEditedBy?.name ?? null,
  }));

  const sharedWithMe: DocumentSummary[] = sharedDocs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    ownerId: doc.ownerId,
    ownerName: doc.owner.name,
    ownerEmail: doc.owner.email,
    ownerAvatarColor: doc.owner.avatarColor,
    updatedAt: doc.updatedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    shareCount: doc._count.shares,
    role: normalizeShareRole(doc.shares[0]?.role ?? "VIEWER"),
    lastEditedByName: doc.lastEditedBy?.name ?? null,
  }));

  return { owned, sharedWithMe };
}

export async function createDocument(
  currentUserId: string,
  input: { title?: string; contentHtml?: string },
  db: PrismaClient = prisma
): Promise<DocumentDetail> {
  const parsed = createDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      400,
      parsed.error.issues[0]?.message || "Invalid document payload"
    );
  }

  const title = sanitizeTitle(parsed.data.title ?? "", "Untitled Document");
  const contentHtml = sanitizeRichHtml(parsed.data.contentHtml ?? "");

  const doc = await db.document.create({
    data: {
      title,
      contentHtml,
      ownerId: currentUserId,
      lastEditedById: currentUserId,
    },
    include: documentDetailInclude,
  });

  return formatDocumentDetail(doc, "OWNER");
}

export async function getDocumentById(
  currentUserId: string,
  documentId: string,
  db: PrismaClient = prisma
): Promise<DocumentDetail> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: documentDetailInclude,
  });

  if (!doc) {
    throw new ServiceError(404, "Document not found");
  }

  if (doc.ownerId === currentUserId) {
    return formatDocumentDetail(doc, "OWNER");
  }

  const share = doc.shares.find((s) => s.userId === currentUserId);
  if (!share) {
    throw new ServiceError(403, "You do not have access to this document");
  }

  return formatDocumentDetail(doc, normalizeShareRole(share.role));
}

export async function updateDocument(
  currentUserId: string,
  documentId: string,
  input: { title?: string; contentHtml?: string },
  db: PrismaClient = prisma
): Promise<DocumentDetail> {
  const parsed = updateDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      400,
      parsed.error.issues[0]?.message || "Invalid update payload"
    );
  }

  const existing = await db.document.findUnique({
    where: { id: documentId },
    include: {
      shares: {
        where: { userId: currentUserId },
      },
    },
  });

  if (!existing) {
    throw new ServiceError(404, "Document not found");
  }

  const isOwner = existing.ownerId === currentUserId;
  const share = existing.shares[0];
  const role: DocumentRole | null = isOwner
    ? "OWNER"
    : share
      ? normalizeShareRole(share.role)
      : null;

  if (role !== "OWNER" && role !== "EDITOR") {
    throw new ServiceError(
      403,
      "You do not have permission to edit this document"
    );
  }

  const updateData: {
    title?: string;
    contentHtml?: string;
    lastEditedById: string;
  } = {
    lastEditedById: currentUserId,
  };

  if (parsed.data.title !== undefined) {
    const cleanedTitle = sanitizeTitle(parsed.data.title, "");
    if (!cleanedTitle) {
      throw new ServiceError(400, "Title cannot be empty");
    }
    updateData.title = cleanedTitle;
  }

  if (parsed.data.contentHtml !== undefined) {
    updateData.contentHtml = sanitizeRichHtml(parsed.data.contentHtml);
  }

  const updated = await db.document.update({
    where: { id: documentId },
    data: updateData,
    include: documentDetailInclude,
  });

  return formatDocumentDetail(updated, role);
}

export async function deleteDocument(
  currentUserId: string,
  documentId: string,
  db: PrismaClient = prisma
): Promise<{ deleted: true; id: string }> {
  const existing = await db.document.findUnique({
    where: { id: documentId },
    select: { id: true, ownerId: true },
  });

  if (!existing) {
    throw new ServiceError(404, "Document not found");
  }

  if (existing.ownerId !== currentUserId) {
    throw new ServiceError(
      403,
      "Only the document owner can delete this document"
    );
  }

  await db.document.delete({
    where: { id: documentId },
  });

  return { deleted: true, id: documentId };
}

export async function upsertDocumentShare(
  currentUserId: string,
  documentId: string,
  input: { email: string; role?: ShareRole },
  db: PrismaClient = prisma
): Promise<{ share: DocumentShareItem; shares: DocumentShareItem[] }> {
  const parsed = shareDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError(
      400,
      parsed.error.issues[0]?.message || "Invalid share request"
    );
  }

  const existing = await db.document.findUnique({
    where: { id: documentId },
    select: { id: true, ownerId: true },
  });

  if (!existing) {
    throw new ServiceError(404, "Document not found");
  }

  if (existing.ownerId !== currentUserId) {
    throw new ServiceError(
      403,
      "Only the document owner can share this document"
    );
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const targetUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true, avatarColor: true },
  });

  if (!targetUser) {
    throw new ServiceError(404, "No user found with that email address");
  }

  if (targetUser.id === existing.ownerId) {
    throw new ServiceError(400, "Cannot share a document with its owner");
  }

  const upserted = await db.documentShare.upsert({
    where: {
      documentId_userId: {
        documentId,
        userId: targetUser.id,
      },
    },
    update: { role: parsed.data.role },
    create: {
      documentId,
      userId: targetUser.id,
      role: parsed.data.role,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarColor: true },
      },
    },
  });

  const allShares = await db.documentShare.findMany({
    where: { documentId },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarColor: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    share: {
      id: upserted.id,
      userId: upserted.userId,
      name: upserted.user.name,
      email: upserted.user.email,
      avatarColor: upserted.user.avatarColor,
      role: normalizeShareRole(upserted.role),
      createdAt: upserted.createdAt.toISOString(),
    },
    shares: allShares.map((s) => ({
      id: s.id,
      userId: s.userId,
      name: s.user.name,
      email: s.user.email,
      avatarColor: s.user.avatarColor,
      role: normalizeShareRole(s.role),
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

export async function revokeDocumentShare(
  currentUserId: string,
  documentId: string,
  targetUserId: string,
  db: PrismaClient = prisma
): Promise<{ revoked: true; userId: string }> {
  const existing = await db.document.findUnique({
    where: { id: documentId },
    select: { id: true, ownerId: true },
  });

  if (!existing) {
    throw new ServiceError(404, "Document not found");
  }

  if (existing.ownerId !== currentUserId) {
    throw new ServiceError(
      403,
      "Only the document owner can revoke access"
    );
  }

  const result = await db.documentShare.deleteMany({
    where: {
      documentId,
      userId: targetUserId,
    },
  });

  if (result.count === 0) {
    throw new ServiceError(404, "Share entry not found");
  }

  return { revoked: true, userId: targetUserId };
}
