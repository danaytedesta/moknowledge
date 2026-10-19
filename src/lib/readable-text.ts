/** Reads visible text in document order without cloning and rewriting the DOM.
 * Large location directories contain thousands of nodes; linear traversal keeps
 * text extraction predictable. Limits reject oversized blocks rather than hang.
 */
interface TextNode { type?: string; name?: string; data?: string; children?: TextNode[] }
export function readableText(element: { toArray(): TextNode[] }, preserveLines = false): string {
  const stack = element.toArray().reverse();
  const parts: string[] = [];
  let visited = 0;
  let length = 0;
  while (stack.length && visited++ < 12000 && length < 16000) {
    const node = stack.pop()!;
    if (node.type === "text") {
      parts.push(node.data ?? "");
      length += node.data?.length ?? 0;
    } else if (!/^(script|style|template|noscript)$/.test(node.name ?? "")) {
      // A separator before and after block elements avoids joining adjacent words.
      if (/^(p|div|li|br|h[1-6]|section|article|td)$/.test(node.name ?? "")) {
        parts.push(preserveLines ? "\n" : " ");
        stack.push({ type: "text", data: preserveLines ? "\n" : " " });
      }
      if (node.children) stack.push(...[...node.children].reverse());
    }
  }
  return parts.join("").replace(preserveLines ? /[^\S\n]+/g : /\s+/g, " ").trim();
}
