export const config = {
  matcher: '/post/:slug',
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const slug = url.pathname.split('/').pop();

  // 1. Fetch the actual static index.html from the root
  const response = await fetch(new URL('/', request.url));
  let html = await response.text();

  // 2. Fetch the post details from Appwrite via REST (Edge compatible)
  const endpoint = process.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
  const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
  const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
  const collectionId = process.env.VITE_APPWRITE_TABLE_ID;
  const bucketId = process.env.VITE_APPWRITE_BUCKET_ID;

  try {
    const appwriteUrl = `${endpoint}/databases/${databaseId}/collections/${collectionId}/documents/${slug}`;
    const appwriteRes = await fetch(appwriteUrl, {
      headers: {
        "X-Appwrite-Project": projectId,
      },
    });

    if (appwriteRes.ok) {
      const post = await appwriteRes.json();
      
      const title = `Post by ${post.authorName || 'GoodPost User'}`;
      const desc = post.caption ? post.caption.slice(0, 150) + '...' : 'Check out this post on GoodPost.';
      
      let image = `https://${url.host}/GoodPost.svg`;
      if (post.featuredImg) {
        image = `${endpoint}/storage/buckets/${bucketId}/files/${post.featuredImg}/view?project=${projectId}`;
      }

      // 3. Inject Open Graph Tags
      html = html.replace('<!-- OG_TITLE -->', `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />`);
      html = html.replace('<!-- OG_DESC -->', `<meta property="og:description" content="${desc.replace(/"/g, '&quot;')}" />`);
      html = html.replace('<!-- OG_IMAGE -->', `<meta property="og:image" content="${image}" />`);
      html = html.replace('<!-- TWITTER_CARD -->', `<meta name="twitter:card" content="summary_large_image" />`);
    } else {
      throw new Error("Post not found");
    }
  } catch (err) {
    // Fallback if Appwrite fetch fails
    html = html.replace('<!-- OG_TITLE -->', `<meta property="og:title" content="GoodPost" />`);
    html = html.replace('<!-- OG_DESC -->', `<meta property="og:description" content="Join the conversation on GoodPost." />`);
    html = html.replace('<!-- OG_IMAGE -->', `<meta property="og:image" content="https://${url.host}/GoodPost.svg" />`);
  }

  // 4. Return the modified HTML to the crawler/browser
  return new Response(html, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
    },
  });
}
