export const config = {
  matcher: '/post/:slug',
};

// Vercel edge middleware — injects Open Graph meta tags for shared post links.
export default async function middleware(request) {
  const url = new URL(request.url);
  const slug = url.pathname.split('/').pop();

  // 1. Fetch the actual static index.html from the root
  const response = await fetch(new URL('/', request.url));
  let html = await response.text();

  // 2. Fetch the post from the GoodPost API (Render backend, backed by Neon)
  const apiUrl = (process.env.VITE_API_URL || process.env.API_URL || '').replace(/\/+$/, '');
  const storageBase = (process.env.VITE_STORAGE_PUBLIC_URL || process.env.STORAGE_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

  try {
    if (!apiUrl) throw new Error('API URL is not configured');

    const postRes = await fetch(`${apiUrl}/api/posts/slug/${encodeURIComponent(slug)}`);
    if (!postRes.ok) throw new Error('Post not found');

    const post = await postRes.json();
    if (!post) throw new Error('Post not found');

    const title = post.title || `Post by ${post.authorName || 'GoodPost User'}`;
    const desc = post.content
      ? post.content.slice(0, 150) + '...'
      : 'Check out this post on GoodPost.';

    // WhatsApp doesn't support SVG, so fall back to a dynamic dark gradient image.
    let image = `https://placehold.co/1200x630/121212/ffffff.png?text=${encodeURIComponent(title.substring(0, 30))}`;
    if (post.featuredImg && storageBase) {
      image = `${storageBase}/${post.featuredImg}`;
    }

    // 3. Inject Open Graph Tags
    html = html.replace('<!-- OG_TITLE -->', `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />`);
    html = html.replace('<!-- OG_DESC -->', `<meta property="og:description" content="${desc.replace(/"/g, '&quot;')}" />`);
    html = html.replace('<!-- OG_IMAGE -->', `<meta property="og:image" content="${image}" />`);
    html = html.replace('<!-- TWITTER_CARD -->', `<meta name="twitter:card" content="summary_large_image" />`);
  } catch (err) {
    // Fallback if the post fetch fails
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
