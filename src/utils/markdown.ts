function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

export function parseInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);

  return escaped
    // Allow explicit line breaks in about content.
    .replace(/&lt;br\s*\/?&gt;/gi, "<br />")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(\[])\*(?!\*)([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(\[])\_([^_\n]+?)_/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|\/|\.\/|\.\.\/|#)[^\s)]+)\)/g,
      (_match, label: string, href: string) => {
        const safeHref = escapeAttribute(href);

        if (/^https?:\/\//.test(href)) {
          return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        }

        return `<a href="${safeHref}">${label}</a>`;
      },
    );
}
