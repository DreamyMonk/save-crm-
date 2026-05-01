export function htmlToPlainText(html: string) {
  if (typeof window === "undefined") {
    return html.replace(/<[^>]*>/g, " ");
  }
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.innerText.trim();
}
