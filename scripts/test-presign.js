const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function test() {
  // Step 1: List first object
  console.log('Step 1: Listing objects...');
  let key;
  try {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: 'flowsmartly-media', MaxKeys: 1 }));
    if (!list.Contents || list.Contents.length === 0) {
      console.log('No objects in bucket');
      return;
    }
    key = list.Contents[0].Key;
    console.log('  OK - Test key:', key);
  } catch (e) {
    console.error('  FAIL - ListObjects error:', e.message);
    return;
  }

  // Step 2: Generate presigned URL
  console.log('Step 2: Generating presigned URL...');
  let url;
  try {
    const cmd = new GetObjectCommand({ Bucket: 'flowsmartly-media', Key: key });
    url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
    console.log('  OK - URL:', url.substring(0, 150) + '...');
  } catch (e) {
    console.error('  FAIL - Presign error:', e.message);
    return;
  }

  // Step 3: Direct GetObject via SDK (not presigned)
  console.log('Step 3: Direct GetObject via SDK...');
  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: 'flowsmartly-media', Key: key }));
    console.log('  OK - ContentType:', resp.ContentType, 'ContentLength:', resp.ContentLength);
    resp.Body.destroy();
  } catch (e) {
    console.error('  FAIL - Direct GetObject error:', e.message);
  }

  // Step 4: Fetch presigned URL
  console.log('Step 4: Fetching presigned URL...');
  try {
    const resp = await fetch(url);
    console.log('  Status:', resp.status, resp.statusText);
    if (!resp.ok) {
      const body = await resp.text();
      console.log('  Error body:', body.substring(0, 500));
    } else {
      console.log('  Content-Type:', resp.headers.get('content-type'));
      console.log('  Content-Length:', resp.headers.get('content-length'));
    }
  } catch (e) {
    console.error('  FAIL - Fetch error:', e.message);
  }
}

test();
