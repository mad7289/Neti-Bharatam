const SITE_ORIGIN = "https://mad7289.github.io";
const SESSION_HOURS = 8;
const corsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

function json(data, status = 200, origin = SITE_ORIGIN) {
  const headers = { "Content-Type": "application/json; charset=utf-8", ...corsHeaders };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}
function getOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  return origin === SITE_ORIGIN ? SITE_ORIGIN : "";
}
function getPath(url) { return url.pathname.replace(/\/+$/, "") || "/"; }
function getId(value) { return /^\d+$/.test(String(value)) ? Number(value) : null; }
async function readJson(request) { try { return await request.json(); } catch { return null; } }
function slugify(value) {
  return String(value || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}
function hex(bytes) { return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function sha256(value) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
function constantTimeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i % (x.length || 1)] || 0) ^ (y[i % (y.length || 1)] || 0);
  return diff === 0;
}
async function getSession(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer ([a-f0-9]{64})$/i);
  if (!match) return null;
  const tokenHash = await sha256(match[1]);
  const row = await env.DB.prepare(
    "SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > datetime('now')"
  ).bind(tokenHash).first();
  return row ? { tokenHash } : null;
}
async function requireAdmin(request, env) { return await getSession(request, env); }
function validCategory(value) {
  return ["nifty","stocks","sensex","bank-nifty","stories","career-guidance","bitcoin","gold"].includes(value);
}
function errorMessage(error) {
  const message = String(error && error.message || "");
  if (message.includes("UNIQUE constraint failed")) return "That URL slug is already in use. Change the slug and try again.";
  return "Internal server error";
}

export default {
  async fetch(request, env) {
    const origin = getOrigin(request);
    if (origin === "") return new Response("Origin not allowed", { status: 403 });
    const allowedOrigin = origin || SITE_ORIGIN;
    const url = new URL(request.url);
    const path = getPath(url);
    const method = request.method;

    if (method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin, ...corsHeaders } });
    }
    if (!env.DB || !env.ADMIN_TOKEN) return json({ error: "Worker configuration is incomplete" }, 500, allowedOrigin);

    try {
      // Initial login: the ADMIN_TOKEN is exchanged for a short-lived session.
      if (path === "/admin/login" && method === "POST") {
        if (origin !== SITE_ORIGIN) return json({ error: "Login must come from the NetiBharatam website" }, 403, allowedOrigin);
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const ipHash = await sha256(ip + env.ADMIN_TOKEN);
        await env.DB.prepare("DELETE FROM admin_login_attempts WHERE attempted_at < datetime('now','-1 day')").run();
        const attempts = await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM admin_login_attempts WHERE ip_hash = ? AND attempted_at > datetime('now','-15 minutes')"
        ).bind(ipHash).first();
        if ((attempts?.total || 0) >= 5) return json({ error: "Too many login attempts. Please wait 15 minutes." }, 429, allowedOrigin);

        const data = await readJson(request);
        const supplied = String(data?.secret || "");
        await env.DB.prepare("INSERT INTO admin_login_attempts (ip_hash) VALUES (?)").bind(ipHash).run();
        if (!constantTimeEqual(supplied, env.ADMIN_TOKEN)) return json({ error: "Incorrect admin secret" }, 401, allowedOrigin);

        const random = new Uint8Array(32);
        crypto.getRandomValues(random);
        const token = hex(random);
        const tokenHash = await sha256(token);
        await env.DB.prepare(
          "INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, datetime('now', '+8 hours'))"
        ).bind(tokenHash).run();
        await env.DB.prepare("DELETE FROM admin_login_attempts WHERE ip_hash = ?").bind(ipHash).run();
        return json({ success: true, token, expires_in: SESSION_HOURS * 60 * 60 }, 200, allowedOrigin);
      }

      if (path.startsWith("/admin/") && path !== "/admin/login") {
        const session = await requireAdmin(request, env);
        if (!session) return json({ error: "Session expired. Please log in again." }, 401, allowedOrigin);

        if (path === "/admin/logout" && method === "POST") {
          await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(session.tokenHash).run();
          return json({ success: true }, 200, allowedOrigin);
        }
        if (path === "/admin/session" && method === "GET") return json({ authenticated: true }, 200, allowedOrigin);

        if (path === "/admin/posts" && method === "GET") {
          const result = await env.DB.prepare(
            "SELECT id, slug, title, body, category, status, parent_post_id, created_at, updated_at FROM posts ORDER BY created_at DESC"
          ).all();
          return json({ posts: result.results || [] }, 200, allowedOrigin);
        }

        if (path === "/admin/posts" && method === "POST") {
          const data = await readJson(request);
          const title = String(data?.title || "").trim();
          const body = String(data?.body || "").trim();
          const slug = slugify(data?.slug || title);
          const category = String(data?.category || "nifty");
          const status = data?.status === "draft" ? "draft" : "published";
          const parentId = data?.parent_post_id ? getId(data.parent_post_id) : null;
          if (!title || !body || !slug || !validCategory(category)) return json({ error: "Title, body, slug and valid category are required" }, 400, allowedOrigin);
          if (title.length > 200 || body.length > 50000) return json({ error: "Title or body is too long" }, 400, allowedOrigin);
          if (data?.parent_post_id && !parentId) return json({ error: "Invalid follow-up post selection" }, 400, allowedOrigin);
          if (parentId && !(await env.DB.prepare("SELECT id FROM posts WHERE id = ?").bind(parentId).first())) return json({ error: "Parent post not found" }, 404, allowedOrigin);
          const result = await env.DB.prepare(
            "INSERT INTO posts (slug, title, body, category, status, parent_post_id) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(slug, title, body, category, status, parentId).run();
          return json({ success: true, id: result.meta.last_row_id, slug, category, status }, 201, allowedOrigin);
        }

        const postMatch = path.match(/^\/admin\/posts\/(\d+)$/);
        if (postMatch) {
          const id = Number(postMatch[1]);
          if (method === "PUT") {
            const data = await readJson(request);
            const title = String(data?.title || "").trim();
            const body = String(data?.body || "").trim();
            const slug = slugify(data?.slug || title);
            const category = String(data?.category || "nifty");
            const status = data?.status === "draft" ? "draft" : "published";
            const parentId = data?.parent_post_id ? getId(data.parent_post_id) : null;
            if (!title || !body || !slug || !validCategory(category)) return json({ error: "Title, body, slug and valid category are required" }, 400, allowedOrigin);
            if (parentId === id) return json({ error: "A post cannot be its own follow-up" }, 400, allowedOrigin);
            await env.DB.prepare(
              "UPDATE posts SET slug = ?, title = ?, body = ?, category = ?, status = ?, parent_post_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(slug, title, body, category, status, parentId, id).run();
            return json({ success: true, id, slug, category, status }, 200, allowedOrigin);
          }
          if (method === "DELETE") {
            await env.DB.prepare("DELETE FROM comments WHERE post_id = ? OR post_id IN (SELECT id FROM posts WHERE parent_post_id = ?)").bind(id, id).run();
            await env.DB.prepare("DELETE FROM posts WHERE parent_post_id = ?").bind(id).run();
            await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
            return json({ success: true, deleted_id: id }, 200, allowedOrigin);
          }
        }

        if (path === "/admin/comments" && method === "GET") {
          const status = url.searchParams.get("status") || "pending";
          if (!["pending","approved","rejected"].includes(status)) return json({ error: "Invalid comment status" }, 400, allowedOrigin);
          const result = await env.DB.prepare(
            "SELECT c.id, c.visitor_name, c.comment_text, c.status, c.created_at, p.title AS post_title, p.slug AS post_slug FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.status = ? ORDER BY c.created_at ASC"
          ).bind(status).all();
          return json({ comments: result.results || [] }, 200, allowedOrigin);
        }
        const commentMatch = path.match(/^\/admin\/comments\/(\d+)$/);
        if (commentMatch && method === "PATCH") {
          const status = (await readJson(request))?.status;
          if (!["approved","rejected"].includes(status)) return json({ error: "Status must be approved or rejected" }, 400, allowedOrigin);
          const id = Number(commentMatch[1]);
          await env.DB.prepare("UPDATE comments SET status = ? WHERE id = ?").bind(status, id).run();
          return json({ success: true, id, status }, 200, allowedOrigin);
        }
        return json({ error: "Admin route not found" }, 404, allowedOrigin);
      }

      // Public endpoints
      if (path === "/posts" && method === "GET") {
        const category = url.searchParams.get("category");
        const query = category && validCategory(category)
          ? "SELECT id, slug, title, body, category, parent_post_id, created_at, updated_at FROM posts WHERE status = 'published' AND category = ? ORDER BY created_at DESC"
          : "SELECT id, slug, title, body, category, parent_post_id, created_at, updated_at FROM posts WHERE status = 'published' ORDER BY created_at DESC";
        const result = category && validCategory(category)
          ? await env.DB.prepare(query).bind(category).all()
          : await env.DB.prepare(query).all();
        return json({ posts: result.results || [] }, 200, allowedOrigin);
      }
      if (path.startsWith("/posts/") && method === "GET") {
        const slug = decodeURIComponent(path.slice(7));
        const post = await env.DB.prepare("SELECT id, slug, title, body, category, parent_post_id, created_at, updated_at FROM posts WHERE slug = ? AND status = 'published'").bind(slug).first();
        if (!post) return json({ error: "Post not found" }, 404, allowedOrigin);
        const followups = await env.DB.prepare("SELECT id, slug, title, body, category, created_at, updated_at FROM posts WHERE parent_post_id = ? AND status = 'published' ORDER BY created_at ASC").bind(post.id).all();
        return json({ post, followups: followups.results || [] }, 200, allowedOrigin);
      }
      if (path === "/comments" && method === "GET") {
        const slug = url.searchParams.get("post");
        if (!slug) return json({ error: "Post slug is required" }, 400, allowedOrigin);
        const result = await env.DB.prepare(
          "SELECT c.id, c.visitor_name, c.comment_text, c.created_at FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.slug = ? AND p.status = 'published' AND c.status = 'approved' ORDER BY c.created_at ASC"
        ).bind(slug).all();
        return json({ comments: result.results || [] }, 200, allowedOrigin);
      }
      if (path === "/comments" && method === "POST") {
        const data = await readJson(request);
        const slug = String(data?.post_slug || "").trim();
        const name = String(data?.visitor_name || "").trim();
        const comment = String(data?.comment_text || "").trim();
        if (!slug || !name || !comment) return json({ error: "Post, name and comment are required" }, 400, allowedOrigin);
        if (name.length > 60 || comment.length > 2000) return json({ error: "Name or comment is too long" }, 400, allowedOrigin);
        const post = await env.DB.prepare("SELECT id FROM posts WHERE slug = ? AND status = 'published'").bind(slug).first();
        if (!post) return json({ error: "Post not found" }, 404, allowedOrigin);
        const result = await env.DB.prepare("INSERT INTO comments (post_id, visitor_name, comment_text, status) VALUES (?, ?, ?, 'pending')").bind(post.id, name, comment).run();
        return json({ success: true, message: "Comment submitted for review", id: result.meta.last_row_id }, 201, allowedOrigin);
      }
      return json({ error: "Route not found" }, 404, allowedOrigin);
    } catch (error) {
      console.error("Worker error:", error);
      return json({ error: errorMessage(error) }, 500, allowedOrigin);
    }
  }
};