/* ===== SMG GUIDE 共通スクリプト ===== */
/* config.js を先に読み込んでおくこと (window.SMG_CONFIG) */

const SMG = (() => {
  const cfg = window.SMG_CONFIG || {};
  const LANG_KEY = "smg_lang";

  function getLang() {
    return localStorage.getItem(LANG_KEY) || "jp";
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
  }

  // 言語ボタンの見た目(active)を切り替え、クリック時に onChange を呼ぶ
  function initLangButtons(onChange) {
    const buttons = document.querySelectorAll("[data-lang]");
    const current = getLang();

    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lang === current);
      btn.addEventListener("click", () => {
        setLang(btn.dataset.lang);
        buttons.forEach(b => b.classList.toggle("active", b === btn));
        if (onChange) onChange(getLang());
      });
    });
  }

  // フィールドを言語ごとに取り出す。無ければ日本語にフォールバック
  // 例: v(post, "title", "en") → post.title_en が空なら post.title
  function v(post, field, lang) {
    if (!post) return "";
    if (lang === "jp") return post[field] || "";
    return post[field + "_" + lang] || post[field] || "";
  }

  // Supabaseから記事を取得する
  // category を渡すとそのカテゴリだけ、渡さなければ全件
  async function fetchPosts({ category, id, limit, order } = {}) {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
      console.error("config.js が正しく読み込まれていません(SUPABASE_URL / KEY が空です)");
      return [];
    }

    let url = cfg.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/posts?select=*&published=eq.true";

    if (category) url += "&category=eq." + encodeURIComponent(category);
    if (id) url += "&id=eq." + encodeURIComponent(id);
    url += "&order=" + (order || "created_at.desc");
    if (limit) url += "&limit=" + limit;

    console.log("[SMG] リクエストURL:", url);

    try {
      const res = await fetch(url, {
        headers: {
          apikey: cfg.SUPABASE_PUBLISHABLE_KEY,
          Authorization: "Bearer " + cfg.SUPABASE_PUBLISHABLE_KEY
        }
      });

      console.log("[SMG] レスポンスステータス:", res.status);

      if (!res.ok) {
        console.error("[SMG] Supabaseエラー:", await res.text());
        return [];
      }

      const data = await res.json();
      console.log("[SMG] 取得件数:", data.length);
      return data;
    } catch (err) {
      console.error("[SMG] 通信エラー:", err);
      return [];
    }
  }

  // image_urls / youtube_urls は配列(text[] or jsonb)を想定。
  // 文字列で1件だけ返る場合や、カンマ区切りの場合にも一応対応する。
  function toArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // JSONでなければカンマ区切りとして扱う
      }
      return value.split(",").map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  // YouTube URL(watch/short/youtu.be)を embed URLに変換する
  function toYoutubeEmbed(url) {
    try {
      const u = new URL(url);
      let id = "";
      if (u.hostname.includes("youtu.be")) {
        id = u.pathname.slice(1);
      } else if (u.searchParams.get("v")) {
        id = u.searchParams.get("v");
      } else if (u.pathname.includes("/shorts/")) {
        id = u.pathname.split("/shorts/")[1];
      }
      return id ? "https://www.youtube.com/embed/" + id : null;
    } catch (e) {
      return null;
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    return d.getFullYear() + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0");
  }

  function excerpt(text, len = 80) {
    if (!text) return "";
    return text.length > len ? text.slice(0, len) + "…" : text;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  return {
    getLang, setLang, initLangButtons, v,
    fetchPosts, toArray, toYoutubeEmbed,
    formatDate, excerpt, escapeHtml
  };
})();
