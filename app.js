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
  // UI文言([data-i18n])は自動で反映される
  function initLangButtons(onChange) {
    const buttons = document.querySelectorAll("[data-lang]");
    const current = getLang();

    applyUIStrings(current);

    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.lang === current);
      btn.addEventListener("click", () => {
        setLang(btn.dataset.lang);
        buttons.forEach(b => b.classList.toggle("active", b === btn));
        applyUIStrings(getLang());
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

  // 動画URL(YouTube/TikTok/Vimeo)を、サイト内でそのまま再生できる埋め込みURLに変換する
  // 対応外のURLの場合は null を返す(その場合は普通のリンクとして扱う)
  function toVideoEmbed(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");

      // YouTube(watch / shorts / youtu.be)
      if (host.includes("youtube.com") || host === "youtu.be") {
        let id = "";
        if (host === "youtu.be") {
          id = u.pathname.slice(1);
        } else if (u.searchParams.get("v")) {
          id = u.searchParams.get("v");
        } else if (u.pathname.includes("/shorts/")) {
          id = u.pathname.split("/shorts/")[1];
        }
        return id ? { platform: "youtube", embedUrl: "https://www.youtube.com/embed/" + id } : null;
      }

      // Vimeo(vimeo.com/数字)
      if (host.includes("vimeo.com")) {
        const match = u.pathname.match(/\/(\d+)/);
        return match ? { platform: "vimeo", embedUrl: "https://player.vimeo.com/video/" + match[1] } : null;
      }

      // TikTok(tiktok.com/@ユーザー名/video/数字)
      if (host.includes("tiktok.com")) {
        const match = u.pathname.match(/\/video\/(\d+)/);
        return match ? { platform: "tiktok", videoId: match[1], originalUrl: url } : null;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // 後方互換用(YouTubeだけを対象にしていた頃の呼び出し元のため)
  function toYoutubeEmbed(url) {
    const result = toVideoEmbed(url);
    return result ? result.embedUrl : null;
  }

  // TikTok公式の埋め込みスクリプトを読み込む(再読み込みして、新しく追加された動画も変換させる)
  function loadTikTokEmbeds() {
    const existing = document.getElementById("tiktok-embed-script");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.id = "tiktok-embed-script";
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
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

  // ===== サイト共通のUI文言(HOME・ボタン・見出しなど)の翻訳辞書 =====
  const UI_STRINGS = {
    jp: {
      card_events_label: "イベント",
      card_guides_label: "ガイド",
      card_videos_label: "動画",
      card_events_desc: "イベントごとのルールや攻略方法を確認できます。",
      card_guides_desc: "画像を使って操作や設定をわかりやすく解説します。",
      card_videos_desc: "動画でイベント攻略や操作方法を学べます。",
      cta_more: "詳しく見る ›",
      notice_heading: "重要なお知らせ",
      notice_empty: "まだお知らせはありません。",
      notice_loading: "読み込み中…",
      notice_link: "お知らせ一覧 ›",
      eyebrow_events: "イベント",
      eyebrow_guides: "ガイド",
      eyebrow_videos: "動画",
      eyebrow_notice: "お知らせ",
      back_to_top: "‹ トップページへ戻る",
      loading: "読み込み中…",
      empty_posts: "まだ投稿はありません。",
      empty_videos: "まだ動画はありません。",
      back_to_list_suffix: " 一覧へ戻る",
      not_found: "記事が見つかりませんでした。",
      admin_eyebrow: "管理者専用",
      admin_breadcrumb: "記事投稿",
      admin_heading: "新しい記事を投稿",
      label_password: "合言葉",
      ph_password: "合言葉を入力",
      label_category: "カテゴリー",
      opt_events: "EVENTS(イベント)",
      opt_guides: "GUIDES(ガイド)",
      opt_videos: "VIDEOS(動画)",
      opt_notice: "NOTICE(お知らせ)",
      label_title: "タイトル",
      ph_title: "例: 水晶戦争 開催のお知らせ",
      label_content: "本文",
      ph_content: "本文を入力してください",
      translations_toggle: "翻訳を入力する(任意・空欄でもOK)",
      label_title_en: "タイトル(英語)",
      label_content_en: "本文(英語)",
      label_title_kr: "タイトル(韓国語)",
      label_content_kr: "本文(韓国語)",
      label_title_tr: "タイトル(トルコ語)",
      label_content_tr: "本文(トルコ語)",
      label_title_de: "タイトル(ドイツ語)",
      label_content_de: "本文(ドイツ語)",
      label_images: "画像(スマホの写真を選択、複数可)",
      hint_images: "写真を選ぶと、下にプレビューが表示されます。",
      label_youtube: "動画リンク(YouTube/TikTok/Vimeo、1行に1つ、複数可・任意)",
      ph_youtube: "https://www.youtube.com/watch?v=...",
      label_publish: "すぐに公開する(オフにすると下書き保存)",
      submit_btn: "投稿する",
      msg_uploading: "画像をアップロード中…",
      msg_saving: "記事を保存中…",
      msg_sending: "送信中です…",
      msg_missing_fields: "タイトルと本文は必須です。",
      msg_wrong_password: "合言葉が間違っています。",
      msg_failed: "投稿に失敗しました。時間をおいて再度お試しください。",
      msg_success: "投稿しました!",
      link_manage: "記事の管理・削除はこちら ›",
      footer_admin_post: "管理者用:記事を投稿する",
      footer_admin_manage: "記事の管理・削除"
    },
    en: {
      card_events_label: "Events",
      card_guides_label: "Guides",
      card_videos_label: "Videos",
      card_events_desc: "Check the rules and strategies for each event.",
      card_guides_desc: "Clear, image-based explanations of settings and controls.",
      card_videos_desc: "Learn event strategies and controls through videos.",
      cta_more: "Learn more ›",
      notice_heading: "Important Notice",
      notice_empty: "No notices yet.",
      notice_loading: "Loading…",
      notice_link: "All notices ›",
      eyebrow_events: "Events",
      eyebrow_guides: "Guides",
      eyebrow_videos: "Videos",
      eyebrow_notice: "Notice",
      back_to_top: "‹ Back to top",
      loading: "Loading…",
      empty_posts: "No posts yet.",
      empty_videos: "No videos yet.",
      back_to_list_suffix: " list",
      not_found: "Post not found.",
      admin_eyebrow: "Admin only",
      admin_breadcrumb: "New Post",
      admin_heading: "Post a new article",
      label_password: "Passphrase",
      ph_password: "Enter passphrase",
      label_category: "Category",
      opt_events: "EVENTS",
      opt_guides: "GUIDES",
      opt_videos: "VIDEOS",
      opt_notice: "NOTICE",
      label_title: "Title",
      ph_title: "e.g. Crystal War announcement",
      label_content: "Content",
      ph_content: "Write the content here",
      translations_toggle: "Add translations (optional)",
      label_title_en: "Title (English)",
      label_content_en: "Content (English)",
      label_title_kr: "Title (Korean)",
      label_content_kr: "Content (Korean)",
      label_title_tr: "Title (Turkish)",
      label_content_tr: "Content (Turkish)",
      label_title_de: "Title (German)",
      label_content_de: "Content (German)",
      label_images: "Images (choose photos, multiple allowed)",
      hint_images: "A preview appears below once you choose photos.",
      label_youtube: "Video links (YouTube/TikTok/Vimeo, one per line, optional)",
      ph_youtube: "https://www.youtube.com/watch?v=...",
      label_publish: "Publish immediately (uncheck to save as draft)",
      submit_btn: "Post",
      msg_uploading: "Uploading images…",
      msg_saving: "Saving post…",
      msg_sending: "Sending…",
      msg_missing_fields: "Title and content are required.",
      msg_wrong_password: "Incorrect passphrase.",
      msg_failed: "Failed to post. Please try again later.",
      msg_success: "Posted!",
      link_manage: "Manage / delete posts ›",
      footer_admin_post: "Admin: Post an article",
      footer_admin_manage: "Manage / delete posts"
    },
    kr: {
      card_events_label: "이벤트",
      card_guides_label: "가이드",
      card_videos_label: "영상",
      card_events_desc: "이벤트별 규칙과 공략법을 확인할 수 있습니다.",
      card_guides_desc: "이미지를 활용해 조작과 설정을 알기 쉽게 설명합니다.",
      card_videos_desc: "영상으로 이벤트 공략과 조작 방법을 배울 수 있습니다.",
      cta_more: "자세히 보기 ›",
      notice_heading: "중요 공지",
      notice_empty: "아직 공지가 없습니다.",
      notice_loading: "불러오는 중…",
      notice_link: "공지 목록 ›",
      eyebrow_events: "이벤트",
      eyebrow_guides: "가이드",
      eyebrow_videos: "영상",
      eyebrow_notice: "공지",
      back_to_top: "‹ 홈으로 돌아가기",
      loading: "불러오는 중…",
      empty_posts: "아직 게시물이 없습니다.",
      empty_videos: "아직 영상이 없습니다.",
      back_to_list_suffix: " 목록으로",
      not_found: "게시물을 찾을 수 없습니다.",
      admin_eyebrow: "관리자 전용",
      admin_breadcrumb: "글 작성",
      admin_heading: "새 글 작성",
      label_password: "암호",
      ph_password: "암호를 입력하세요",
      label_category: "카테고리",
      opt_events: "EVENTS(이벤트)",
      opt_guides: "GUIDES(가이드)",
      opt_videos: "VIDEOS(영상)",
      opt_notice: "NOTICE(공지)",
      label_title: "제목",
      ph_title: "예: 수정 전쟁 개최 안내",
      label_content: "본문",
      ph_content: "내용을 입력하세요",
      translations_toggle: "번역 입력하기(선택, 비워둬도 됨)",
      label_title_en: "제목(영어)",
      label_content_en: "본문(영어)",
      label_title_kr: "제목(한국어)",
      label_content_kr: "본문(한국어)",
      label_title_tr: "제목(터키어)",
      label_content_tr: "본문(터키어)",
      label_title_de: "제목(독일어)",
      label_content_de: "본문(독일어)",
      label_images: "이미지(사진 선택, 여러 장 가능)",
      hint_images: "사진을 선택하면 아래에 미리보기가 표시됩니다.",
      label_youtube: "동영상 링크(YouTube/TikTok/Vimeo, 한 줄에 하나씩, 선택)",
      ph_youtube: "https://www.youtube.com/watch?v=...",
      label_publish: "즉시 공개(끄면 임시 저장)",
      submit_btn: "게시하기",
      msg_uploading: "이미지 업로드 중…",
      msg_saving: "게시물 저장 중…",
      msg_sending: "전송 중입니다…",
      msg_missing_fields: "제목과 본문은 필수입니다.",
      msg_wrong_password: "암호가 올바르지 않습니다.",
      msg_failed: "게시에 실패했습니다. 잠시 후 다시 시도해주세요.",
      msg_success: "게시되었습니다!",
      link_manage: "게시물 관리·삭제 ›",
      footer_admin_post: "관리자용: 글 작성하기",
      footer_admin_manage: "게시물 관리·삭제"
    },
    tr: {
      card_events_label: "Etkinlikler",
      card_guides_label: "Rehberler",
      card_videos_label: "Videolar",
      card_events_desc: "Her etkinliğin kurallarını ve stratejilerini inceleyin.",
      card_guides_desc: "Görsellerle ayarlar ve kontroller kolayca anlatılır.",
      card_videos_desc: "Videolarla etkinlik stratejilerini ve kontrolleri öğrenin.",
      cta_more: "Daha fazla ›",
      notice_heading: "Önemli Duyuru",
      notice_empty: "Henüz duyuru yok.",
      notice_loading: "Yükleniyor…",
      notice_link: "Tüm duyurular ›",
      eyebrow_events: "Etkinlikler",
      eyebrow_guides: "Rehberler",
      eyebrow_videos: "Videolar",
      eyebrow_notice: "Duyuru",
      back_to_top: "‹ Ana sayfaya dön",
      loading: "Yükleniyor…",
      empty_posts: "Henüz gönderi yok.",
      empty_videos: "Henüz video yok.",
      back_to_list_suffix: " listesine dön",
      not_found: "Gönderi bulunamadı.",
      admin_eyebrow: "Sadece yönetici",
      admin_breadcrumb: "Yeni Gönderi",
      admin_heading: "Yeni bir makale paylaş",
      label_password: "Parola",
      ph_password: "Parolayı girin",
      label_category: "Kategori",
      opt_events: "EVENTS",
      opt_guides: "GUIDES",
      opt_videos: "VIDEOS",
      opt_notice: "NOTICE",
      label_title: "Başlık",
      ph_title: "Örn: Kristal Savaşı duyurusu",
      label_content: "İçerik",
      ph_content: "İçeriği buraya yazın",
      translations_toggle: "Çeviri ekle (isteğe bağlı)",
      label_title_en: "Başlık (İngilizce)",
      label_content_en: "İçerik (İngilizce)",
      label_title_kr: "Başlık (Korece)",
      label_content_kr: "İçerik (Korece)",
      label_title_tr: "Başlık (Türkçe)",
      label_content_tr: "İçerik (Türkçe)",
      label_title_de: "Başlık (Almanca)",
      label_content_de: "İçerik (Almanca)",
      label_images: "Görseller (fotoğraf seçin, birden fazla olabilir)",
      hint_images: "Fotoğraf seçtiğinizde aşağıda önizleme görünür.",
      label_youtube: "Video bağlantıları (YouTube/TikTok/Vimeo, her satıra bir tane, isteğe bağlı)",
      ph_youtube: "https://www.youtube.com/watch?v=...",
      label_publish: "Hemen yayınla (kapatırsan taslak olarak kaydedilir)",
      submit_btn: "Paylaş",
      msg_uploading: "Görseller yükleniyor…",
      msg_saving: "Gönderi kaydediliyor…",
      msg_sending: "Gönderiliyor…",
      msg_missing_fields: "Başlık ve içerik zorunludur.",
      msg_wrong_password: "Parola yanlış.",
      msg_failed: "Paylaşılamadı. Lütfen daha sonra tekrar deneyin.",
      msg_success: "Paylaşıldı!",
      link_manage: "Gönderileri yönet / sil ›",
      footer_admin_post: "Yönetici: Makale paylaş",
      footer_admin_manage: "Gönderileri yönet / sil"
    },
    de: {
      card_events_label: "Events",
      card_guides_label: "Anleitungen",
      card_videos_label: "Videos",
      card_events_desc: "Regeln und Strategien für jedes Event ansehen.",
      card_guides_desc: "Einstellungen und Steuerung anschaulich mit Bildern erklärt.",
      card_videos_desc: "Event-Strategien und Steuerung per Video lernen.",
      cta_more: "Mehr erfahren ›",
      notice_heading: "Wichtiger Hinweis",
      notice_empty: "Noch keine Hinweise.",
      notice_loading: "Wird geladen…",
      notice_link: "Alle Hinweise ›",
      eyebrow_events: "Events",
      eyebrow_guides: "Anleitungen",
      eyebrow_videos: "Videos",
      eyebrow_notice: "Hinweis",
      back_to_top: "‹ Zur Startseite",
      loading: "Wird geladen…",
      empty_posts: "Noch keine Beiträge.",
      empty_videos: "Noch keine Videos.",
      back_to_list_suffix: "-Liste",
      not_found: "Beitrag nicht gefunden.",
      admin_eyebrow: "Nur für Admins",
      admin_breadcrumb: "Neuer Beitrag",
      admin_heading: "Neuen Artikel veröffentlichen",
      label_password: "Passwort",
      ph_password: "Passwort eingeben",
      label_category: "Kategorie",
      opt_events: "EVENTS",
      opt_guides: "GUIDES",
      opt_videos: "VIDEOS",
      opt_notice: "NOTICE",
      label_title: "Titel",
      ph_title: "z.B. Ankündigung Kristallkrieg",
      label_content: "Inhalt",
      ph_content: "Inhalt hier eingeben",
      translations_toggle: "Übersetzungen hinzufügen (optional)",
      label_title_en: "Titel (Englisch)",
      label_content_en: "Inhalt (Englisch)",
      label_title_kr: "Titel (Koreanisch)",
      label_content_kr: "Inhalt (Koreanisch)",
      label_title_tr: "Titel (Türkisch)",
      label_content_tr: "Inhalt (Türkisch)",
      label_title_de: "Titel (Deutsch)",
      label_content_de: "Inhalt (Deutsch)",
      label_images: "Bilder (Fotos auswählen, mehrere möglich)",
      hint_images: "Nach der Auswahl erscheint unten eine Vorschau.",
      label_youtube: "Video-Links (YouTube/TikTok/Vimeo, einer pro Zeile, optional)",
      ph_youtube: "https://www.youtube.com/watch?v=...",
      label_publish: "Sofort veröffentlichen (deaktivieren = als Entwurf speichern)",
      submit_btn: "Veröffentlichen",
      msg_uploading: "Bilder werden hochgeladen…",
      msg_saving: "Beitrag wird gespeichert…",
      msg_sending: "Wird gesendet…",
      msg_missing_fields: "Titel und Inhalt sind erforderlich.",
      msg_wrong_password: "Falsches Passwort.",
      msg_failed: "Veröffentlichung fehlgeschlagen. Bitte später erneut versuchen.",
      msg_success: "Veröffentlicht!",
      link_manage: "Beiträge verwalten / löschen ›",
      footer_admin_post: "Admin: Artikel veröffentlichen",
      footer_admin_manage: "Beiträge verwalten / löschen"
    }
  };

  function t(key, lang) {
    const l = lang || getLang();
    return (UI_STRINGS[l] && UI_STRINGS[l][key]) || UI_STRINGS.jp[key] || "";
  }

  // ページ内の [data-i18n="キー"] を持つ要素の文字を、選択中の言語に差し替える
  function applyUIStrings(lang) {
    const l = lang || getLang();
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.dataset.i18n, l);
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  return {
    getLang, setLang, initLangButtons, v,
    fetchPosts, toArray, toYoutubeEmbed, toVideoEmbed, loadTikTokEmbeds,
    formatDate, excerpt, escapeHtml,
    t, applyUIStrings
  };
})();
