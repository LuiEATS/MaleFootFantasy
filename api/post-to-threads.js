// Posts a published gallery item to Threads on behalf of the configured account.
// Requires these Vercel environment variables (set in the Vercel dashboard, never in code):
//   THREADS_USER_ID, THREADS_ACCESS_TOKEN

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function createContainer(userId, token, text, imageUrl, isVideo) {
  var params = new URLSearchParams();
  params.set('access_token', token);
  params.set('text', text);
  if (imageUrl) {
    params.set('media_type', isVideo ? 'VIDEO' : 'IMAGE');
    if (isVideo) params.set('video_url', imageUrl);
    else params.set('image_url', imageUrl);
  } else {
    params.set('media_type', 'TEXT');
  }

  var res = await fetch('https://graph.threads.net/v1.0/' + userId + '/threads?' + params.toString(), {
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

  var res = await fetch('https://graph.threads.net/v1.0/' + userId + '/threads_publish?' + params.toString(), {
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

  var userId = process.env.THREADS_USER_ID;
  var token = process.env.THREADS_ACCESS_TOKEN;
  if (!userId || !token) {
    res.status(500).json({ error: 'Threads credentials not configured on the server' });
    return;
  }

  try {
    var body = req.body || {};
    var title = (body.title || '').trim();
    var tags = Array.isArray(body.tags) ? body.tags : [];
    var imageUrl = body.imageUrl || null;
    var isVideo = !!body.isVideo;

    var hashtags = tags.slice(0, 6).map(function (t) { return '#' + t.replace(/\s+/g, ''); }).join(' ');
    var text = (title + (hashtags ? '\n' + hashtags : '')).slice(0, 480);

    var creationId = await createContainer(userId, token, text, imageUrl, isVideo);
    // Meta recommends a short wait before publishing so the media has time to process.
    await sleep(3000);
    var published = await publishContainer(userId, token, creationId);

    res.status(200).json({ ok: true, post: published });
  } catch (err) {
    console.error('post-to-threads failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
