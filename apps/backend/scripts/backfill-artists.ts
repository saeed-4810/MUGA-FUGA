import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { deriveNameLc, slugify, type Artist } from "../src/domain/artist.js";

type Args = {
  project: string;
  dryRun: boolean;
};

type LegacyProduct = {
  id?: string;
  artistId?: string;
  artistName?: string;
};

const SYSTEM_UID = "system-backfill";
const SYSTEM_EMAIL = "system@muga.app";

const parseArgs = (argv: string[]): Args => {
  const project = readFlag(argv, "--project");
  if (!project) {
    throw new Error("Missing required --project=<firebase-project-id>");
  }
  return { project, dryRun: argv.includes("--dry-run") };
};

const readFlag = (argv: string[], name: string): string | null => {
  const exact = argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const idx = argv.indexOf(name);
  return idx >= 0 ? (argv[idx + 1] ?? null) : null;
};

const artistDocIdForName = (name: string): string => `backfill-${slugify(name)}`;

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const serviceAccount = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (getApps().length === 0) {
    initializeApp({
      credential: serviceAccount ? cert(JSON.parse(serviceAccount) as Record<string, string>) : applicationDefault(),
      projectId: args.project,
    });
  }
  const db = getFirestore();
  const products = await db.collection("products").get();
  const now = new Date().toISOString();
  let scanned = 0;
  let skipped = 0;
  let migrated = 0;
  const artistIds = new Map<string, string>();

  for (const doc of products.docs) {
    scanned++;
    const product = doc.data() as LegacyProduct;
    if (product.artistId) {
      skipped++;
      continue;
    }
    if (!product.artistName) {
      skipped++;
      console.warn({ productId: doc.id, message: "skipped product without artistName or artistId" });
      continue;
    }

    const key = deriveNameLc(product.artistName);
    const artistId = artistIds.get(key) ?? artistDocIdForName(product.artistName);
    artistIds.set(key, artistId);
    const artistRef = db.collection("artists").doc(artistId);
    const artistSnap = await artistRef.get();
    if (!artistSnap.exists) {
      const artist: Artist = {
        id: artistId,
        name: product.artistName,
        name_lc: key,
        slug: slugify(product.artistName),
        status: "published",
        ownerUid: SYSTEM_UID,
        ownerEmail: SYSTEM_EMAIL,
        createdAt: now,
        updatedAt: now,
        approvedAt: now,
        approvedBy: SYSTEM_UID,
      };
      if (args.dryRun) {
        console.info({ action: "would_create_artist", artist });
      } else {
        await artistRef.set(artist);
      }
    }

    if (args.dryRun) {
      console.info({ action: "would_update_product", productId: doc.id, artistId });
    } else {
      await doc.ref.update({ artistId, artistName: FieldValue.delete() });
    }
    migrated++;
  }

  console.info({ scanned, skipped, migrated, dryRun: args.dryRun });
};

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
