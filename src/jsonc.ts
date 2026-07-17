// Parse JSONC (keybindings.json, Zed keymap.json): strip // and /* */ comments
// and trailing commas, then JSON.parse. Single string-aware pass, so comment
// markers or commas inside string values are left untouched.
export function parseJsonc(text: string): unknown {
  const out: string[] = [];
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      out.push(c);
      if (c === "\\") out.push(text[++i] ?? "");
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out.push(c);
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (c === "}" || c === "]") {
      let j = out.length - 1; // drop a trailing comma before this closer
      while (j >= 0 && /\s/.test(out[j])) j--;
      if (j >= 0 && out[j] === ",") out.splice(j, 1);
    }
    out.push(c);
  }
  return JSON.parse(out.join(""));
}
