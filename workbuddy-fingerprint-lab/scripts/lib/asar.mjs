import fs from "node:fs";
import path from "node:path";

function walk(node, prefix, out) {
  for (const [name, value] of Object.entries(node.files || {})) {
    const p = prefix + "/" + name;
    if (value.files) {
      walk(value, p, out);
    } else {
      out.push({
        path: p,
        size: value.size,
        offset: Number(value.offset),
        unpacked: Boolean(value.unpacked),
        executable: Boolean(value.executable),
      });
    }
  }
}

export function openAsar(asarPath, unpackedDir) {
  const fd = fs.openSync(asarPath, "r");
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  const headerSize = head.readUInt32LE(12);
  const headerBuf = Buffer.alloc(headerSize);
  fs.readSync(fd, headerBuf, 0, headerSize, 16);
  const header = JSON.parse(headerBuf.toString("utf8").replace(/\0+$/u, ""));
  const base = 16 + headerSize;
  const entries = [];
  walk(header, "", entries);
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));

  function read(p) {
    const key = p.startsWith("/") ? p : "/" + p;
    const entry = byPath.get(key);
    if (!entry) return null;
    if (entry.unpacked) {
      if (!unpackedDir) return null;
      return fs.readFileSync(path.join(unpackedDir, key.replace(/^\//, "")), "utf8");
    }
    const buf = Buffer.alloc(entry.size);
    fs.readSync(fd, buf, 0, entry.size, base + entry.offset);
    return buf.toString("utf8");
  }

  function extract(exts, outDir) {
    let count = 0;
    for (const entry of entries) {
      if (entry.unpacked) continue;
      if (!exts.some((ext) => entry.path.endsWith(ext))) continue;
      const dst = path.join(outDir, entry.path);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const buf = Buffer.alloc(entry.size);
      fs.readSync(fd, buf, 0, entry.size, base + entry.offset);
      fs.writeFileSync(dst, buf);
      count += 1;
    }
    return count;
  }

  return {
    asarPath,
    header,
    entries,
    byPath,
    read,
    extract,
    close: () => fs.closeSync(fd),
  };
}
