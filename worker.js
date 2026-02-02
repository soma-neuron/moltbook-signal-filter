/**
 * Moltbook Signal Filter - Cloudflare Worker
 * 
 * Serves filtered Moltbook feed showing only real work.
 */

const SIGNAL_INDICATORS = [
  'built', 'shipped', 'launched', 'released', 'github.com',
  'skill', 'tool', 'api', 'protocol', 'infrastructure',
  'security', 'scanner', 'automation', 'framework', 'deploy'
];

const NOISE_INDICATORS = [
  'vibes', 'gm', 'gn', 'wagmi', '🚀🚀🚀', 'just vibes',
  'token', 'pump', 'moon', 'king', 'ruler'
];

function scorePost(post) {
  let score = 0;
  const text = `${post.title} ${post.content || ''}`.toLowerCase();
  
  for (const indicator of SIGNAL_INDICATORS) {
    if (text.includes(indicator)) score += 2;
  }
  
  for (const indicator of NOISE_INDICATORS) {
    if (text.includes(indicator)) score -= 3;
  }
  
  if (['agentskills', 'builds', 'tooling'].includes(post.submolt?.name)) {
    score += 3;
  }
  
  if (post.url || text.includes('http')) score += 2;
  if (post.comment_count > 2) score += 1; // Engagement indicates value
  
  return score;
}

async function fetchSignalPosts(apiKey) {
  const response = await fetch('https://www.moltbook.com/api/v1/posts?sort=new&limit=100', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  
  if (!response.ok) {
    throw new Error(`Moltbook API error: ${response.status}`);
  }
  
  const data = await response.json();
  const posts = data.posts || [];
  
  return posts
    .map(post => ({ ...post, signalScore: scorePost(post) }))
    .filter(p => p.signalScore > 0)
    .sort((a, b) => b.signalScore - a.signalScore)
    .slice(0, 20);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // API endpoint
    if (url.pathname === '/api/signal') {
      try {
        const posts = await fetchSignalPosts(env.MOLTBOOK_API_KEY);
        return new Response(JSON.stringify(posts), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Serve HTML
    return new Response(HTML, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};

const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Moltbook Signal Filter</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; background: #0a0a0a; color: #fff; }
    h1 { color: #ff6b6b; }
    .post { background: #1a1a1a; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #ff6b6b; }
    .score { color: #4ecdc4; font-weight: bold; }
    .author { color: #95e1d3; }
    button { background: #ff6b6b; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
    button:hover { background: #ff5252; }
  </style>
</head>
<body>
  <h1>🦞 Moltbook Signal Filter</h1>
  <p>Filter Moltbook to show only posts from agents doing real work.</p>
  <button onclick="loadSignal()">Load Signal Feed</button>
  <div id="feed">Click button to load...</div>
  <script>
    async function loadSignal() {
      document.getElementById('feed').innerHTML = 'Loading...';
      const res = await fetch('/api/signal');
      const posts = await res.json();
      document.getElementById('feed').innerHTML = posts.map(p => \`
        <div class="post">
          <div class="score">[\${p.signalScore} points]</div>
          <div class="author">@\${p.author.name}</div>
          <h3>\${p.title}</h3>
          <p>\${p.content?.slice(0,150)||''}...</p>
          <a href="https://www.moltbook.com/post/\${p.id}" target="_blank">View →</a>
        </div>
      \`).join('');
    }
  </script>
</body>
</html>`;
