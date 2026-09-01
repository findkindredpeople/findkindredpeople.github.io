(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { language: localStorage.getItem("kindred_language") || "en" };

  const copy = {
    en: { headline: "Find people who feel like your kind of people", sub: "A thoughtful preview for small local groups, shared interests and real-world plans.", badge: "🌍 Public preview · no real matching yet", saved: "Preview updated.", required: "Please complete this field.", story: "Story preview created locally. Nothing was published.", topic: "Topic preview added locally. Nothing was published.", join: "Join requests are not available in this public preview.", report: "Report saved locally for this preview. For a real concern, use the Contact page." },
    es: { headline: "Encuentra personas que se sientan como las tuyas", sub: "Una vista previa para pequeños grupos locales, intereses compartidos y planes reales.", badge: "🌍 Vista previa pública · sin emparejamiento real", saved: "Vista previa actualizada.", required: "Completa este campo.", story: "Vista previa creada localmente. No se publicó nada.", topic: "Tema añadido localmente. No se publicó nada.", join: "Las solicitudes no están disponibles en esta vista previa.", report: "Informe guardado localmente. Para una incidencia real, usa Contacto." },
    ru: { headline: "Найдите людей, близких вам по духу", sub: "Предварительная версия небольших местных групп, общих интересов и реальных планов.", badge: "🌍 Публичный preview · реального подбора пока нет", saved: "Предпросмотр обновлён.", required: "Заполните это поле.", story: "Предпросмотр истории создан локально. Ничего не опубликовано.", topic: "Тема добавлена только в preview. Ничего не опубликовано.", join: "Заявки недоступны в публичном preview.", report: "Жалоба сохранена локально для preview. Для реального обращения используйте Contact." },
    ar: { headline: "اعثر على أشخاص يشبهونك حقًا", sub: "معاينة لمجموعات محلية صغيرة واهتمامات مشتركة وخطط واقعية.", badge: "🌍 معاينة عامة · لا توجد مطابقة حقيقية بعد", saved: "تم تحديث المعاينة.", required: "يرجى إكمال هذا الحقل.", story: "تم إنشاء معاينة محلية فقط ولم يتم النشر.", topic: "تمت إضافة معاينة محلية فقط ولم يتم النشر.", join: "طلبات الانضمام غير متاحة في هذه المعاينة.", report: "تم حفظ البلاغ محليًا للمعاينة. استخدم صفحة الاتصال للبلاغ الحقيقي." },
    fr: { headline: "Trouvez des personnes qui vous ressemblent", sub: "Un aperçu pour de petits groupes locaux, des intérêts communs et des projets réels.", badge: "🌍 Aperçu public · pas encore de mise en relation réelle", saved: "Aperçu mis à jour.", required: "Veuillez remplir ce champ.", story: "Aperçu créé localement. Rien n’a été publié.", topic: "Sujet ajouté localement. Rien n’a été publié.", join: "Les demandes ne sont pas disponibles dans cet aperçu.", report: "Signalement enregistré localement. Utilisez Contact pour un cas réel." },
    pt: { headline: "Encontre pessoas que combinam com você", sub: "Uma prévia para pequenos grupos locais, interesses em comum e planos reais.", badge: "🌍 Prévia pública · ainda sem correspondência real", saved: "Prévia atualizada.", required: "Preencha este campo.", story: "Prévia criada localmente. Nada foi publicado.", topic: "Tópico adicionado localmente. Nada foi publicado.", join: "Pedidos não estão disponíveis nesta prévia.", report: "Denúncia salva localmente. Use Contato para um caso real." },
    hi: { headline: "अपने जैसे लोगों को खोजें", sub: "छोटे स्थानीय समूहों, साझा रुचियों और वास्तविक योजनाओं का पूर्वावलोकन।", badge: "🌍 सार्वजनिक पूर्वावलोकन · अभी वास्तविक मिलान नहीं", saved: "पूर्वावलोकन अपडेट हुआ।", required: "कृपया यह फ़ील्ड भरें।", story: "कहानी केवल स्थानीय पूर्वावलोकन में बनी। प्रकाशित नहीं हुई।", topic: "विषय केवल पूर्वावलोकन में जोड़ा गया। प्रकाशित नहीं हुआ।", join: "इस पूर्वावलोकन में अनुरोध उपलब्ध नहीं हैं।", report: "रिपोर्ट स्थानीय रूप से सहेजी गई। वास्तविक चिंता के लिए Contact पेज उपयोग करें।" },
    zh: { headline: "找到真正合拍的人", sub: "小型本地群组、共同兴趣和真实计划的预览。", badge: "🌍 公开预览 · 暂无真实匹配", saved: "预览已更新。", required: "请填写此字段。", story: "故事仅在本地预览，未发布。", topic: "主题仅添加到本地预览，未发布。", join: "公开预览中暂不接受加入请求。", report: "报告已保存到本地预览。如需正式反馈，请使用 Contact 页面。" }
  };

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3500);
  }

  function languageCopy() { return copy[state.language] || copy.en; }

  function applyLanguage(language) {
    state.language = copy[language] ? language : "en";
    localStorage.setItem("kindred_language", state.language);
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
    const d = languageCopy();
    const headline = $("[data-t='headline']");
    const sub = $("[data-t='sub']");
    const badge = $("[data-t='badge']");
    if (headline) headline.textContent = d.headline;
    if (sub) sub.textContent = d.sub;
    if (badge) badge.textContent = d.badge;
    const select = $("#uiLang");
    if (select) select.value = state.language;
  }

  function validate(field, minimum, message) {
    const value = field.value.trim();
    field.setAttribute("aria-invalid", String(value.length < minimum));
    if (value.length >= minimum) return true;
    field.focus();
    toast(message || languageCopy().required);
    return false;
  }

  function installReportDialog() {
    const dialog = document.createElement("dialog");
    dialog.id = "reportDialog";
    dialog.className = "report-dialog";
    dialog.innerHTML = `<form method="dialog" id="reportForm"><div class="dialog-head"><h2>Report a concern</h2><button value="cancel" aria-label="Close report dialog">×</button></div><p class="preview-note">Preview tool: reports are stored only in this browser and are not sent to moderators.</p><label>Reason<select id="reportReason" class="control" required><option value="">Choose a reason</option><option>Harassment or hate</option><option>Privacy or impersonation</option><option>Spam or fraud</option><option>Unsafe meetup</option><option>Other</option></select></label><label>Details<textarea id="reportDetails" class="control" minlength="20" maxlength="1000" required aria-describedby="reportHelp"></textarea></label><small id="reportHelp">Do not include passwords, identity documents, exact addresses or private medical information.</small><div class="report-actions"><button value="cancel">Cancel</button><button class="submit" id="saveReport" value="default">Save preview report</button></div></form>`;
    document.body.appendChild(dialog);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "report-trigger";
    open.textContent = "Report a concern";
    open.addEventListener("click", () => dialog.showModal());
    $("footer")?.before(open);
    $("#reportForm", dialog).addEventListener("submit", event => {
      if (event.submitter?.value === "cancel") return;
      event.preventDefault();
      const reason = $("#reportReason", dialog);
      const details = $("#reportDetails", dialog);
      if (!validate(reason, 1) || !validate(details, 20, "Please add at least 20 characters.")) return;
      const reports = JSON.parse(localStorage.getItem("kindred_preview_reports") || "[]");
      reports.push({ reason: reason.value, details: details.value.trim(), createdAt: new Date().toISOString(), status: "preview-unsubmitted" });
      localStorage.setItem("kindred_preview_reports", JSON.stringify(reports.slice(-20)));
      dialog.close();
      event.target.reset();
      toast(languageCopy().report);
    });
  }

  function initialize() {
    document.body.classList.add("preview-mode");
    $("#uiLang")?.addEventListener("change", event => applyLanguage(event.target.value));
    applyLanguage(state.language);

    const signIn = $("#signin");
    if (signIn) {
      signIn.textContent = "Preview · sign-in unavailable";
      signIn.setAttribute("aria-disabled", "true");
      signIn.onclick = () => toast("Account sign-in is not enabled in this public preview.");
    }

    const matcher = $("#matcher");
    if (matcher) matcher.onsubmit = event => {
      event.preventDefault();
      const city = $("#city");
      if (!validate(city, 2)) return;
      $("#resultTitle").textContent = `${$("#activity").value} · ${city.value.trim()}`;
      $("#result").classList.add("show");
      $("#result").focus?.();
      toast(languageCopy().saved);
    };

    const join = $("#joinBtn");
    if (join) join.onclick = () => toast(languageCopy().join);

    const story = $("#storyForm");
    if (story) story.onsubmit = event => {
      event.preventDefault();
      if (!validate($("#storyTitle"), 3) || !validate($("#storyText"), 20, "Please add at least 20 characters.")) return;
      toast(languageCopy().story);
    };

    const post = $("#addTopic");
    if (post) post.onclick = () => {
      const input = $("#topicTitle");
      if (!validate(input, 5, "Please add at least 5 characters.")) return;
      const card = document.createElement("article");
      card.className = "topic preview-topic";
      card.innerHTML = '<span class="topic-icon">✨</span><div><strong></strong><span>Local preview · not published</span></div><span class="count">Preview</span>';
      $("strong", card).textContent = input.value.trim();
      $("#forumList").prepend(card);
      input.value = "";
      toast(languageCopy().topic);
    };

    installReportDialog();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", initialize) : initialize();
})();
