// Link previews for shared items (Cloudflare Pages "advanced mode")
const SUPABASE_URL = 'https://rkdasiyctqzdcdmsnnui.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zReOxI6DnAGU07iIjA_M-w_vO31z8Es';
const SITE = 'https://ighmarket.com.ng';

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function short(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/item\/([0-9a-f-]{36})\/?$/i);

    // everything else is the normal website
    if (!match) return env.ASSETS.fetch(request);

    const id = match[1].toLowerCase();
    let item = null;
    try {
      const api = SUPABASE_URL + '/rest/v1/listings'
        + '?id=eq.' + id
        + '&is_sold=eq.false'
        + '&select=id,title,price,description,image_urls,condition,location,sellers(store_name)'
        + '&limit=1';
      const res = await fetch(api, { headers: { apikey: SUPABASE_KEY } });
      if (res.ok) {
        const rows = await res.json();
        item = rows && rows[0] ? rows[0] : null;
      }
    } catch (err) {}

    // sold, deleted or unknown items go to the home page
    if (!item) return Response.redirect(url.origin + '/', 302);

    const price = '₦' + Number(item.price).toLocaleString('en-US');
    const title = item.title + ' - ' + price;
    const bits = [price];
    if (item.condition) bits.push(item.condition === 'new' ? 'New' : 'Used');
    if (item.location) bits.push(item.location);
    if (item.sellers && item.sellers.store_name) bits.push('Sold by ' + item.sellers.store_name);
    let desc = bits.join(' · ');
    if (item.description) desc += '. ' + short(item.description, 120);

    const image = item.image_urls && item.image_urls[0]
      ? item.image_urls[0]
      : SITE + '/ighmarket%20logo2.png';
    const link = SITE + '/item/' + id;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} | IGH Market</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:site_name" content="IGH Market">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(link)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<script>location.replace('/#item=${id}');</script>
</head>
<body>
<p>Opening <a href="/#item=${id}">${esc(item.title)}</a> on IGH Market...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300'
      }
    });
  }
};