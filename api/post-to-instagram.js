// Posts a published gallery item to Instagram on behalf of the configured account.
// Requires these Vercel environment variables (set in the Vercel dashboard, never in code):
//   IG_USER_ID, IG_ACCESS_TOKEN
//
// Prerequisite: the Instagram account must be a Business or Creator account
// linked to a Facebook Page — the Content Publishing API will not work
// against a personal account.

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function createContainer(userId, token, caption, mediaUrl, isVideo) {
  var params = new URLSearchParams();
  params.set('access_token', token);
  params.set('caption', caption);
  if (isVideo) {
    params.set('media_type', 'REELS');
    params.set('video_url', mediaUrl);
  } else {
    params.set('image_url', mediaUrl);
  }

  var res = await fetch('https://graph.facebook.com/v19.0/' + userId + '/media?' + params.toString(), {
    method: 'POST'
  });
  var data = await res.json();
  if (!res.ok) throw new Error('Container creation failed: ' + JSON.stringify(data));
  return data.id;
}

async function publishContainer(userId, token, creationId) {
  var params = new URLSearchParams();
  params.set('access_token', token);
  params.set('creation_id', creationId);

  var res = await fetch('https://graph.facebook.com/v19.0/' + userId + '/media_publish?' + params.toString(), {
    method: 'POST'
  });
  var data = await res.json();
  if (!res.ok) throw new Error('Publish failed: ' + JSON.stringify(data));
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  var userId = process.env.IG_USER_ID;
  var token = process.env.IG_ACCESS_TOKEN;
  if (!userId || !token) {
    res.status(500).json({ error: 'Instagram credentials not configured on the server' });
    return;
  }

  try {
    var body = req.body || {};
    var title = (body.title || '').trim();
    var tags = Array.isArray(body.tags) ? body.tags : [];
    var mediaUrl = body.imageUrl || null;
    var isVideo = !!body.isVideo;

    if (!mediaUrl) {
      res.status(400).json({ ok: false, error: 'Instagram requires a photo or video — skipped a text-only post' });
      return;
    }

    var hashtags = tags.slice(0, 8).map(function (t) { return '#' + t.replace(/\s+/g, ''); }).join(' ');
    var caption = (title + (hashtags ? '\n' + hashtags : '')).slice(0, 2200);

    var creationId = await createContainer(userId, token, caption, mediaUrl, isVideo);
    // Meta recommends checking status before publishing, especially for video;
    // a short wait covers the common case without extra polling requests.
    await sleep(isVideo ? 8000 : 3000);
    var published = await publishContainer(userId, token, creationId);

    res.status(200).json({ ok: true, post: published });
  } catch (err) {
    console.error('post-to-instagram failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
