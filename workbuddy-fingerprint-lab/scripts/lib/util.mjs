import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export function expandHome(p) {
  if (!p) return p;
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
    } else {
      out._.push(token);
    }
  }
  return out;
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function walkFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) stack.push(full);
      else if (exts.some((ext) => full.endsWith(ext))) out.push(full);
    }
  }
  return out.sort();
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, "");
}

export function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

export function matchBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex, i + 1);
    }
  }
  return text.slice(openIndex, Math.min(text.length, openIndex + 12000));
}

export function extractFunction(text, marker, options = {}) {
  const re = marker instanceof RegExp ? marker : new RegExp(marker);
  const match = re.exec(text);
  if (!match) return null;
  let cursor = match.index + match[0].length;
  if (options.method) {
    const methodRe = options.method instanceof RegExp ? options.method : new RegExp(options.method);
    const methodMatch = methodRe.exec(text.slice(match.index, match.index + 4000));
    if (!methodMatch) return null;
    cursor = match.index + methodMatch.index + methodMatch[0].length - 1;
  }
  const open = text.indexOf("{", cursor);
  if (open < 0) return null;
  return {
    offset: match.index,
    open,
    body: matchBrace(text, open),
  };
}

export function shapeOf(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\"" || ch === "'" || ch === "`") {
      const quote = ch;
      i += 1;
      while (i < src.length) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      out += "S";
      continue;
    }
    if (/[0-9]/.test(ch)) {
      while (i < src.length && /[0-9a-fA-FxX._]/.test(src[i])) i += 1;
      out += "N";
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) i += 1;
      out += "I";
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

export function literalsOf(src) {
  const out = new Set();
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let match;
  while ((match = re.exec(src))) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? "").replace(/\$\{[^}]*\}/g, "${");
    if (raw.length < 2) continue;
    out.add(raw);
  }
  return [...out].sort();
}

export function readText(file) {
  return fs.readFileSync(file, "utf8");
}

export function rel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}
