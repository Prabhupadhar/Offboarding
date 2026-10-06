// Turns the single-file build into an artifact page body: the publisher adds its own
// doctype/html/head/body skeleton, so strip ours and keep title, fonts, styles and script.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("dist-artifact/index.html", "utf8");
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g);
const links = pick(/<link[^>]+>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g);
const out = [...title, ...links, ...styles, '<div id="root"></div>', ...scripts].join("\n");
writeFileSync("dist-artifact/offboarding-control-center.html", out);
console.log(`wrote dist-artifact/offboarding-control-center.html (${(out.length / 1024).toFixed(0)} KB)`);
