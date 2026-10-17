// Builds the web version of "ears don't have earlids" from the iA Writer file.
//
//   node build.mjs
//
// Writes preview.html (unlocked, local only) and index.html (locked with the
// password in .password, the only file that goes to GitHub Pages).

import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";
import { homedir } from "node:os";

const SOURCE = `${homedir()}/Documents/Superpsyched Ears/Superpsyched Ears.md`;
const PASSWORD = readFileSync(new URL(".password", import.meta.url), "utf8").trim();
const ITERATIONS = 600000;

// A player goes right after the first paragraph that links to its Bandcamp page.
const PLAYERS = [
  { link: "dionmcgregor.bandcamp.com/album/the-dream-world", embed: "album=4260889161", label: "The Dream World of Dion McGregor" },
  { link: "coldspring.bandcamp.com/track/cut-ups-self-explained", embed: "track=2809731049", label: "Brion Gysin, “Cut-Ups Self-Explained”" },
  { link: "coldspring.bandcamp.com/track/i-am-that-i-am", embed: "track=986190572", label: "Brion Gysin, “I Am That I Am”" },
  { link: "pierreschaeffer.bandcamp.com/album/uvres-1948-1952", embed: "track=3218358149", label: "Pierre Schaeffer, Étude aux chemins de fer" },
];

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(s) {
  s = escape(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return s;
}

// Bare web addresses and DOIs in Works Cited become links.
function autolink(html) {
  return html
    .replace(/doi:(10\.[^\s<]+[^\s<.,])/g, '<a href="https://doi.org/$1">doi:$1</a>')
    .replace(/(^|[\s(])((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/[^\s<]*[^\s<.,])/g, '$1<a href="https://$2">$2</a>');
}

function player({ embed, label }) {
  const src = `https://bandcamp.com/EmbeddedPlayer/${embed}/size=large/bgcol=ffffff/linkcol=333333/tracklist=false/artwork=small/transparent=true/`;
  return `<figure class="player"><iframe src="${src}" title="${escape(label)}" loading="lazy" seamless></iframe></figure>`;
}

function render(md) {
  const blocks = md.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.replace(/\s+$/, "")).filter(Boolean);
  const out = [];
  const used = new Set();
  let inWorksCited = false;

  for (const block of blocks) {
    if (/^(Website|Web version)\b/i.test(block)) continue; // the PDF's link-and-password line
    if (block.trim() === "+++") { out.push('<hr class="page">'); continue; }

    // An image with an optional caption: iA Writer's  /image.jpg "Caption"
    // or Markdown's  ![alt](url)  with the caption on the next line.
    const block_ = block.trim();
    const contentBlock = block_.match(/^\/(\S+\.(?:jpe?g|png|gif|webp))(?:\s+"(.*)")?$/i);
    const mdImage = block_.match(/^!\[([^\]]*)\]\(([^)\s]+)\) *(?:\n([\s\S]+))?$/);
    if (contentBlock || mdImage) {
      const src = contentBlock ? contentBlock[1] : mdImage[2].replace(/^https:\/\/nithinsmk\.github\.io\/ears-dont-have-earlids\//, "");
      const text = contentBlock ? contentBlock[2] : mdImage[3]?.trim().replace(/^\*(.*)\*$/s, "$1");
      const caption = text ? inline(text) : "";
      const alt = mdImage?.[1] || caption.replace(/<[^>]+>/g, "");
      out.push(`<figure class="figure"><img src="${src}" alt="${escape(alt)}">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`);
      continue;
    }

    const heading = block.match(/^(#{1,3}) (.*)/);
    if (heading) {
      const [first, ...rest] = block.split("\n");
      const level = heading[1].length;
      const text = first.replace(/^#+ /, "").trim();
      inWorksCited = level === 2 && /works cited/i.test(text);
      out.push(`<h${level}>${inline(text)}</h${level}>`);
      // Under the title, a line like "Total length 15:35" is a subtitle;
      // under a section heading, text with no blank line is just the first paragraph.
      if (rest.length) out.push(`<p${level === 1 ? ' class="sub"' : ""}>${inline(rest.join(" ").trim())}</p>`);
      continue;
    }

    const lines = block.split("\n");
    if (lines.length > 1 && lines.slice(0, -1).every((l) => / {2}$/.test(l))) {
      out.push(`<p class="heading-block">${lines.map((l) => inline(l.trim())).join("<br>")}</p>`);
      continue;
    }

    let html = inline(block.replace(/\\\n/g, "\n").replace(/\n/g, " "));
    let cls = "";
    if (inWorksCited && /^\*[^*].*\*$/s.test(block.trim())) cls = "endnote"; // the closing note after Works Cited
    else if (inWorksCited) { cls = "wc"; html = autolink(html); }
    else if (/^\[[^\]]*\]$/.test(block.trim())) cls = "note";
    out.push(cls ? `<p class="${cls}">${html}</p>` : `<p>${html}</p>`);

    for (const p of PLAYERS) {
      if (!used.has(p.link) && block.includes(p.link)) { out.push(player(p)); used.add(p.link); }
    }
  }
  const missing = PLAYERS.filter((p) => !used.has(p.link)).map((p) => p.label);
  if (missing.length) console.warn("No paragraph links to:", missing.join("; "));
  return out.join("\n");
}

const STYLE = `
:root { --ink: #1d1b18; --muted: #6b665e; --rule: #ddd8cf; --paper: #fdfcf9; --link: #1d1b18; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--paper); color: var(--ink);
  font: 1.125rem/1.65 "Source Serif 4", Georgia, "Times New Roman", serif; }
main { max-width: 40rem; margin: 0 auto; padding: 3rem 16px 5rem; }
.heading-block { margin: 0 0 2.5rem; }
h1 { font-size: 2rem; font-weight: 600; line-height: 1.2; text-align: center; margin: 0 0 .25rem; }
.sub { text-align: center; color: var(--muted); margin: 0 0 2.5rem; font-size: 1rem; }
h2 { font-size: 1.35rem; font-weight: 600; margin: 3rem 0 1rem; }
h3 { font-size: 1.1rem; font-weight: 600; margin: 2.5rem 0 .75rem; }
p { margin: 0 0 1.1rem; }
a { color: var(--link); text-decoration-color: var(--muted); text-underline-offset: .15em; overflow-wrap: anywhere; }
a:hover { text-decoration-color: currentColor; }
.note { color: var(--muted); font-style: italic; }
.wc { padding-left: 2.5rem; text-indent: -2.5rem; font-size: 1rem; }
.endnote { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--rule); font-size: .95rem; color: var(--muted); }
hr.page { border: 0; border-top: 1px solid var(--rule); margin: 3rem 0; }
.figure { margin: 1.5rem 0 2rem; }
.figure img { display: block; width: 100%; height: auto; }
.figure figcaption { margin-top: .5rem; font-size: .9rem; line-height: 1.5; color: var(--muted); }
.player { margin: 1.5rem 0 2rem; }
.player iframe { display: block; border: 0; width: 100%; height: 120px; }
@media print { .player { display: none; } body { background: #fff; } }
`;

function page(body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ears don’t have earlids</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

const b64 = (bytes) => Buffer.from(bytes).toString("base64");

async function lock(html) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", enc.encode(PASSWORD), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(html)));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ears don’t have earlids</title>
<style>
:root { --ink: #1d1b18; --muted: #6b665e; --rule: #cfc9be; --paper: #fdfcf9; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--paper); color: var(--ink);
  font: 1.125rem/1.6 Georgia, "Times New Roman", serif; padding: 16px; }
form { width: 100%; max-width: 22rem; text-align: center; }
h1 { font-size: 1.6rem; font-weight: normal; margin: 0 0 .25rem; }
p { color: var(--muted); margin: 0 0 1.5rem; font-size: 1rem; }
input, button { font: inherit; width: 100%; padding: .6rem .75rem; border: 1px solid var(--rule); border-radius: 4px; background: #fff; color: var(--ink); }
button { margin-top: .6rem; background: var(--ink); color: var(--paper); border-color: var(--ink); cursor: pointer; }
button:disabled { opacity: .6; cursor: progress; }
#msg { min-height: 1.5rem; margin: .75rem 0 0; }
</style>
</head>
<body>
<form id="gate">
  <h1>ears don’t have earlids</h1>
  <p>Nithin Shams · Superpsyched Ears, UdK Berlin</p>
  <label for="pw" style="position:absolute;left:-9999px">Password</label>
  <input id="pw" type="password" autocomplete="current-password" placeholder="Password" autofocus required>
  <button type="submit">Open</button>
  <p id="msg" role="status"></p>
</form>
<script>
const SALT = "${b64(salt)}", IV = "${b64(iv)}", DATA = "${b64(data)}", ITERATIONS = ${ITERATIONS};
const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
document.getElementById("gate").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button"), msg = document.getElementById("msg");
  button.disabled = true; msg.textContent = "Opening…";
  try {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(document.getElementById("pw").value), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: bytes(SALT), iterations: ITERATIONS, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const html = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(IV) }, key, bytes(DATA)));
    document.open(); document.write(html); document.close();
  } catch {
    msg.textContent = "That password didn’t work. Try again.";
    button.disabled = false;
  }
});
</script>
</body>
</html>
`;
}

const html = page(render(readFileSync(SOURCE, "utf8")));
writeFileSync(new URL("preview.html", import.meta.url), html);
writeFileSync(new URL("index.html", import.meta.url), await lock(html));
console.log("Built preview.html and index.html");
