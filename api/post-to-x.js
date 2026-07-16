// Posts a published gallery item to X (Twitter) on behalf of the configured account.
// Requires these Vercel environment variables (set in the Vercel dashboard, never in code):
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
const crypto = require('crypto');

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

function buildOauthHeader(method, url, extraParams, tokens) {
  var oauthParams = {
    oauth_consumer_key: tokens.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: tokens.accessToken,
    oauth_version: '1.0'
  };

  var allParams = Object.assign({}, oauthParams, extraParams || {});
  var paramString = Object.keys(allParams).sort().map(function (k) {
    return percentEncode(k) + '=' + percentEncode(allParams[k]);
  }).join('&');

  var baseString = method.toUpperCase() + '&' + percentEncode(url) + '&' + percentEncode(paramString);
  var signingKey = percentEncode(tokens.apiSecret) + '&' + percentEncode(tokens.accessTokenSecret);
  var signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  var headerParams = Object.assign({}, oauthParams, { oauth_signature: signature });
  return 'OAuth ' + Object.keys(headerParams).sort().map(function (k) {
    return percentEncode(k) + '="' + percentEncode(headerParams[k]) + '"';
  }).join(', ');
}

async function uploadMedia(imageUrl, tokens) {
  var imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error('Could not fetch image for upload');
  var buf = Buffer.from(await imgRes.arrayBuffer());

  var uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  var authHeader = buildOauthHeader('POST', uploadUrl, {}, tokens);

  var form = new FormData();
  form.append('media', new Blob([buf]));

  var res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: authHeader },
    body: form
  });
  var data = await res.json();
  if (!res.ok) throw new Error('Media upload failed: ' + JSON.stringify(data));
  return data.media_id_string;
}

async function postTweet(text, mediaId, tokens) {
  var tweetUrl = 'https://api.x.com/2/tweets';
  var authHeader = buildOauthHeader('POST', tweetUrl, {}, tokens);
  var body = mediaId ? { text: text, media: { media_ids: [mediaId] } } : { text: text };

  var res = await fetch(tweetUrl, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  var data = await res.json();
  if (!res.ok) throw new Error('Tweet failed: ' + JSON.stringify(data));
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  var tokens = {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET
  };
  if (!tokens.apiKey || !tokens.apiSecret || !tokens.accessToken || !tokens.accessTokenSecret) {
    res.status(500).json({ error: 'X API credentials not configured on the server' });
    return;
  }

  try {
    var body = req.body || {};
    var title = (body.title || '').trim();
    var tags = Array.isArray(body.tags) ? body.tags : [];
    var imageUrl = body.imageUrl || null;

    var hashtags = tags.slice(0, 4).map(function (t) { return '#' + t.replace(/\s+/g, ''); }).join(' ');
    var text = (title + (hashtags ? '\n' + hashtags : '')).slice(0, 280);

    var mediaId = null;
    if (imageUrl) {
      mediaId = await uploadMedia(imageUrl, tokens);
    }

    var tweet = await postTweet(text, mediaId, tokens);
    res.status(200).json({ ok: true, tweet: tweet });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
