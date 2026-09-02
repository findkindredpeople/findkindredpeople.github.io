(() => {
  const article = document.querySelector("article.article");
  const output = document.querySelector("[data-reading-time]");

  if (!article || !output) return;

  const words = (article.textContent.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  const label = `${minutes} minute${minutes === 1 ? "" : "s"} read`;

  output.textContent = label;
  output.setAttribute("aria-label", `Estimated reading time: ${label}`);
})();
