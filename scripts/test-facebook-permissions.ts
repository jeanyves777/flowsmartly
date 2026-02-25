/**
 * Test Facebook Graph API Permissions
 * This script makes test API calls to unlock "Request Advanced Access" for each permission
 *
 * Run: npx ts-node scripts/test-facebook-permissions.ts
 */

const FACEBOOK_APP_ID = '2014720428980289';
const FACEBOOK_APP_SECRET = 'e481af6c90bb69f0eaf21ca32a3310dd';

// You'll get this from logging in and connecting a Facebook Page
let USER_ACCESS_TOKEN = 'YOUR_USER_ACCESS_TOKEN_HERE';
let PAGE_ACCESS_TOKEN = 'YOUR_PAGE_ACCESS_TOKEN_HERE';
let PAGE_ID = 'YOUR_PAGE_ID_HERE';
let INSTAGRAM_ACCOUNT_ID = 'YOUR_INSTAGRAM_ID_HERE';

/**
 * Step 1: Get User Access Token
 *
 * 1. Go to: https://developers.facebook.com/tools/explorer/
 * 2. Select your app: "flowsmartly"
 * 3. Click "Generate Access Token"
 * 4. Grant permissions:
 *    - pages_show_list
 *    - pages_manage_posts
 *    - pages_read_engagement
 *    - instagram_basic
 *    - instagram_content_publish
 *    - read_insights
 * 5. Copy the token and paste below as USER_ACCESS_TOKEN
 */

async function testPermissions() {
  console.log('🚀 Testing Facebook Graph API Permissions...\n');

  try {
    // Test 1: pages_show_list (Get user's pages)
    console.log('1️⃣  Testing pages_show_list...');
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${USER_ACCESS_TOKEN}`
    );
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error('❌ Error:', pagesData.error.message);
      console.log('\n⚠️  Make sure you generated a User Access Token with all permissions!\n');
      return;
    }

    if (pagesData.data && pagesData.data.length > 0) {
      console.log('✅ pages_show_list works!');
      console.log(`   Found ${pagesData.data.length} page(s)`);

      // Get first page token
      const firstPage = pagesData.data[0];
      PAGE_ACCESS_TOKEN = firstPage.access_token;
      PAGE_ID = firstPage.id;

      console.log(`   Page ID: ${PAGE_ID}`);
      console.log(`   Page Name: ${firstPage.name}\n`);
    } else {
      console.log('⚠️  No pages found. You need a Facebook Page to test posting.\n');
      return;
    }

    // Test 2: pages_manage_posts (Publish a test post)
    console.log('2️⃣  Testing pages_manage_posts...');
    const postResponse = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '🧪 Test post from FlowSmartly - Testing pages_manage_posts permission',
          access_token: PAGE_ACCESS_TOKEN,
        }),
      }
    );
    const postData = await postResponse.json();

    if (postData.id) {
      console.log('✅ pages_manage_posts works!');
      console.log(`   Post ID: ${postData.id}\n`);
    } else {
      console.log('❌ Failed to post:', postData.error?.message || 'Unknown error\n');
    }

    // Test 3: pages_read_engagement (Get post engagement)
    console.log('3️⃣  Testing pages_read_engagement...');
    const engagementResponse = await fetch(
      `https://graph.facebook.com/v21.0/${postData.id}?fields=likes.summary(true),comments.summary(true),shares&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const engagementData = await engagementResponse.json();

    if (engagementData.id) {
      console.log('✅ pages_read_engagement works!');
      console.log(`   Likes: ${engagementData.likes?.summary?.total_count || 0}`);
      console.log(`   Comments: ${engagementData.comments?.summary?.total_count || 0}\n`);
    } else {
      console.log('❌ Failed to get engagement:', engagementData.error?.message || 'Unknown error\n');
    }

    // Test 4: read_insights (Get page insights)
    console.log('4️⃣  Testing read_insights...');
    const insightsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}/insights?metric=page_impressions,page_engaged_users&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const insightsData = await insightsResponse.json();

    if (insightsData.data) {
      console.log('✅ read_insights works!');
      console.log(`   Retrieved ${insightsData.data.length} insight(s)\n`);
    } else {
      console.log('❌ Failed to get insights:', insightsData.error?.message || 'Unknown error\n');
    }

    // Test 5: instagram_basic (Get Instagram account)
    console.log('5️⃣  Testing instagram_basic...');
    const igAccountResponse = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=instagram_business_account&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const igAccountData = await igAccountResponse.json();

    if (igAccountData.instagram_business_account) {
      INSTAGRAM_ACCOUNT_ID = igAccountData.instagram_business_account.id;
      console.log('✅ instagram_basic works!');
      console.log(`   Instagram Account ID: ${INSTAGRAM_ACCOUNT_ID}\n`);

      // Test 6: instagram_content_publish (Create Instagram post)
      console.log('6️⃣  Testing instagram_content_publish...');

      // First, create media container
      const containerResponse = await fetch(
        `https://graph.facebook.com/v21.0/${INSTAGRAM_ACCOUNT_ID}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: 'https://flowsmartly-media.s3.us-east-2.amazonaws.com/test-image.jpg',
            caption: '🧪 Test post from FlowSmartly - Testing instagram_content_publish',
            access_token: PAGE_ACCESS_TOKEN,
          }),
        }
      );
      const containerData = await containerResponse.json();

      if (containerData.id) {
        console.log('✅ instagram_content_publish works!');
        console.log(`   Media Container ID: ${containerData.id}`);
        console.log('   Note: Use this to publish: POST /{ig-user-id}/media_publish\n');
      } else {
        console.log('⚠️  Instagram publish requires a valid image URL');
        console.log('   Error:', containerData.error?.message || 'Unknown error\n');
      }
    } else {
      console.log('⚠️  No Instagram Business Account connected to this page');
      console.log('   Connect one at: https://www.facebook.com/settings/?tab=instagram\n');
    }

    console.log('✅ All tests complete!');
    console.log('\n⏰ Wait up to 24 hours for "Request Advanced Access" button to activate.');
    console.log('   Then submit for App Review.\n');

  } catch (error) {
    console.error('❌ Error running tests:', error);
  }
}

// Instructions
console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Facebook Graph API Permission Testing                         ║
╚════════════════════════════════════════════════════════════════╝

Before running this script:

1. Get a User Access Token:
   - Go to: https://developers.facebook.com/tools/explorer/
   - Select app: "flowsmartly" (App ID: ${FACEBOOK_APP_ID})
   - Click "Generate Access Token"
   - Grant ALL permissions:
     ✓ pages_show_list
     ✓ pages_manage_posts
     ✓ pages_read_engagement
     ✓ instagram_basic
     ✓ instagram_content_publish
     ✓ read_insights
   - Copy the token

2. Update this file:
   - Set USER_ACCESS_TOKEN to the token you just copied
   - Save the file

3. Run: npx ts-node scripts/test-facebook-permissions.ts

4. Wait 24 hours for permissions to unlock

Press Ctrl+C to exit, or update the tokens above and run the script.
`);

// Uncomment to run automatically
// testPermissions();
