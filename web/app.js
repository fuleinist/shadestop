// Static shadestop report view. No build, no dependencies.
// Loads report.json (a council JSON array or a full CommuteScore object).

async function main() {
  const reportEl = document.getElementById("report");
  const meta = document.getElementById("meta");
  let data;
  try {
    const res = await fetch("report.json");
    if (!res.ok) throw new Error("http " + res.status);
    data = await res.json();
  } catch (e) {
    meta.textContent =
      "Could not load report.json (" + e.message + "). Run: " +
      "npx tsx src/index.ts export --commute plan.json --format json --out web/report.json";
    return;
  }

  const rows = Array.isArray(data) ? data : data.stops;
  if (!rows) {
    meta.textContent = "report.json has no stop rows.";
    return;
  }

  meta.textContent = `date ${data.date ?? "?"}  ·  total exposure ${
    data.total != null ? data.total + "/100" : "n/a"
  }`;

  const riskClass = (r) => "risk-" + (r || "low");
  const bar = (score) =>
    `<div class="score-bar"><div class="score-fill" style="width:${score}%;background:hsl(${120 - score * 1.2},70%,45%)"></div></div> ${score}/100`;

  const head =
    "<tr><th>stop</th><th>exposure</th><th>apparent&nbsp;C</th><th>shade</th><th>trees</th><th>shelters</th><th>fountains</th><th>risk</th></tr>";
  const body = rows
    .map(
      (r) => `<tr>
      <td>${esc(r.name)}</td>
      <td>${bar(r.exposureScore)}</td>
      <td>${r.apparentTempC ?? ""}</td>
      <td>${(r.shadeFraction ?? 0).toFixed(2)}</td>
      <td>${r.trees ?? ""}</td>
      <td>${r.shelters ?? ""}</td>
      <td>${r.fountains ?? ""}</td>
      <td class="${riskClass(r.heatRisk)}">${esc(r.heatRisk ?? "")}</td>
    </tr>`,
    )
    .join("");

  reportEl.innerHTML = `<table>${head}${body}</table>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

main();
