import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedDatabase(client: PrismaClient = prisma) {
  const alice = await client.user.upsert({
    where: { email: "alice@ajaia.demo" },
    update: {
      name: "Alice Chen",
      avatarColor: "#2563eb",
    },
    create: {
      name: "Alice Chen",
      email: "alice@ajaia.demo",
      avatarColor: "#2563eb",
    },
  });

  const bob = await client.user.upsert({
    where: { email: "bob@ajaia.demo" },
    update: {
      name: "Bob Patel",
      avatarColor: "#059669",
    },
    create: {
      name: "Bob Patel",
      email: "bob@ajaia.demo",
      avatarColor: "#059669",
    },
  });

  const charlie = await client.user.upsert({
    where: { email: "charlie@ajaia.demo" },
    update: {
      name: "Charlie Kim",
      avatarColor: "#7c3aed",
    },
    create: {
      name: "Charlie Kim",
      email: "charlie@ajaia.demo",
      avatarColor: "#7c3aed",
    },
  });

  const q4Content = [
    "<h1>Q4 Product Launch Plan</h1>",
    "<p>This document outlines the release readiness checklist, launch milestones, and cross-functional owners for our <strong>Q4 Workspace Release</strong>. Please review all dates marked as <u>final freeze</u> before Friday.</p>",
    "<h2>Key Objectives</h2>",
    "<ul>",
    "<li><p><strong>Zero-downtime rollout</strong> across all regional clusters with automated canary checks.</p></li>",
    "<li><p>Deliver <em>sub-second document load times</em> for accounts with more than 200 shared files.</p></li>",
    "<li><p>Complete security verification for <u>HTML sanitization</u> and role-based access enforcement.</p></li>",
    "</ul>",
    "<h2>Launch Sequence</h2>",
    "<ol>",
    "<li><p><strong>Week 1:</strong> Freeze schema migrations and run full regression suite in staging.</p></li>",
    "<li><p><strong>Week 2:</strong> Enable beta cohort access and monitor error budgets.</p></li>",
    "<li><p><strong>Week 3:</strong> General availability announcement and customer changelog publication.</p></li>",
    "</ol>",
  ].join("");

  const onboardingContent = [
    "<h1>Engineering Onboarding Notes</h1>",
    "<p>Welcome to the product engineering team. Use these private setup notes during your first week to configure your local environment and review repository conventions.</p>",
    "<h2>Day 1 Environment Setup</h2>",
    "<ul>",
    "<li><p>Clone the primary monorepo and verify <strong>Node.js 22+</strong> is active.</p></li>",
    "<li><p>Copy <code>.env.example</code> to <code>.env</code> and run database migrations locally.</p></li>",
    "<li><p>Run the integration test suite before opening your first pull request.</p></li>",
    "</ul>",
    "<h2>Code Review Expectations</h2>",
    "<p>Keep pull requests <em>focused and reversible</em>. Include clear reproduction notes and verify <u>server-side authorization checks</u> on every new route.</p>",
  ].join("");

  const designReviewContent = [
    "<h1>Design Review Checklist</h1>",
    "<p>Shared reference checklist used before approving editor and workspace UI changes for production release.</p>",
    "<h2>Typography &amp; Layout</h2>",
    "<ul>",
    "<li><p>Verify <strong>4.5:1 minimum contrast</strong> across neutral canvas and document page surfaces.</p></li>",
    "<li><p>Confirm sticky formatting toolbar stays compact and never obscures headings.</p></li>",
    "<li><p>Check keyboard focus rings and <em>Cmd/Ctrl + S</em> save shortcut behavior.</p></li>",
    "</ul>",
    "<h2>Read-Only &amp; Permissions</h2>",
    "<ol>",
    "<li><p>Ensure <u>Viewer</u> accounts cannot edit title or body content.</p></li>",
    "<li><p>Confirm share controls are hidden for non-owners and enforced server-side.</p></li>",
    "</ol>",
  ].join("");

  const q4Doc = await client.document.upsert({
    where: { id: "doc-q4-product-launch" },
    update: {
      title: "Q4 Product Launch Plan",
      contentHtml: q4Content,
      ownerId: alice.id,
      lastEditedById: alice.id,
    },
    create: {
      id: "doc-q4-product-launch",
      title: "Q4 Product Launch Plan",
      contentHtml: q4Content,
      ownerId: alice.id,
      lastEditedById: alice.id,
    },
  });

  await client.document.upsert({
    where: { id: "doc-eng-onboarding" },
    update: {
      title: "Engineering Onboarding Notes",
      contentHtml: onboardingContent,
      ownerId: alice.id,
      lastEditedById: alice.id,
    },
    create: {
      id: "doc-eng-onboarding",
      title: "Engineering Onboarding Notes",
      contentHtml: onboardingContent,
      ownerId: alice.id,
      lastEditedById: alice.id,
    },
  });

  const designDoc = await client.document.upsert({
    where: { id: "doc-design-review" },
    update: {
      title: "Design Review Checklist",
      contentHtml: designReviewContent,
      ownerId: bob.id,
      lastEditedById: bob.id,
    },
    create: {
      id: "doc-design-review",
      title: "Design Review Checklist",
      contentHtml: designReviewContent,
      ownerId: bob.id,
      lastEditedById: bob.id,
    },
  });

  await client.documentShare.upsert({
    where: {
      documentId_userId: {
        documentId: q4Doc.id,
        userId: bob.id,
      },
    },
    update: { role: "EDITOR" },
    create: {
      documentId: q4Doc.id,
      userId: bob.id,
      role: "EDITOR",
    },
  });

  await client.documentShare.upsert({
    where: {
      documentId_userId: {
        documentId: designDoc.id,
        userId: alice.id,
      },
    },
    update: { role: "VIEWER" },
    create: {
      documentId: designDoc.id,
      userId: alice.id,
      role: "VIEWER",
    },
  });

  return { alice, bob, charlie, q4Doc, designDoc };
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("seed.ts");

if (isDirectRun) {
  seedDatabase()
    .then(() => {
      console.log("Database seeded successfully with 3 demo users and 3 sample documents.");
    })
    .catch((err) => {
      console.error("Error seeding database:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
