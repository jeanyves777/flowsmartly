const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = "flowsmartly-media";
const UPLOADS_DIR = path.join(__dirname, "..", "public", "uploads");

const MIME_MAP = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  pdf: "application/pdf",
};

function getContentType(file) {
  const ext = file.split(".").pop().toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

function getAllFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function migrate() {
  const files = getAllFiles(UPLOADS_DIR);
  console.log("Found " + files.length + " files to upload to S3");

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const relativePath = path.relative(UPLOADS_DIR, file).split(path.sep).join("/");
    const contentType = getContentType(file);
    const body = fs.readFileSync(file);

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: relativePath,
          Body: body,
          ContentType: contentType,
        })
      );
      success++;
      if (success % 10 === 0 || success === files.length) {
        console.log("  Uploaded " + success + "/" + files.length);
      }
    } catch (err) {
      failed++;
      console.error("  FAILED: " + relativePath + " - " + err.message);
    }
  }

  console.log("\nDone! Uploaded: " + success + ", Failed: " + failed);
}

migrate();
