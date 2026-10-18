"""Builds docs/defense/diagrams/process_documentation.html (A4) from modules.json and the rendered SVGs; pdf.mjs prints it to
docs/defense/PROCESS_DOCUMENTATION.pdf. Run after generate.py and render.mjs: python3 build_pdf.py"""
import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(HERE, 'modules.json')))
E = html.escape
PILL = {'Implemented': 'ok', 'Partial': 'part', 'Mock only': 'mock', 'Planned': 'plan'}
LANE_ORDER = ['Patient', 'Front desk', 'Dentist', 'Owner', 'System']


def svg(name):
    path = os.path.join(HERE, 'svg', f'{name}.svg')
    if not os.path.exists(path):
        return f'<p class="missing">Diagram {E(name)} not rendered</p>'
    return f'<div class="svg" role="img" aria-label="{E(name)}">' + open(path).read() + '</div>'


def lanes(steps):
    used = [l for l in LANE_ORDER if any(s['lane'] == l for s in steps)]
    return ', '.join(used)


def module_page(m):
    before = m['as_is']
    built = [s for s in m['to_be'] if s.get('kind') not in ('planned', 'mock')]
    later = [s for s in m['to_be'] if s.get('kind') in ('planned', 'mock')]
    autos = [s for s in m['to_be'] if s.get('kind') == 'auto']
    confirm = [s for s in before if 'confirm' in s]
    cites = sorted({s['cite'] for s in before if 'cite' in s})
    rows = [
        ('Steps', f'{len(before)} known' + (f' ({len(confirm)} to confirm)' if confirm else ''), f'{len(built)} in the system' + (f' + {len(later)} planned or mock' if later else '')),
        ('Who does it', lanes(before), lanes(built) or 'Nobody yet (planned)'),
        ('Steps the system does by itself', '—', f'{len(autos)}'),
        ('Estimated time', 'Not measured (no figure in the interview)', 'Not measured'),
        ('Errors removed', '—', m['errors']),
        ('Automation type', 'Manual', m['automation']),
    ]
    table = ''.join(f'<tr><th>{E(k)}</th><td>{E(a)}</td><td>{E(b)}</td></tr>' for k, a, b in rows)
    return f"""<section class="page module">
  <header class="mod-head"><h2>M{m['n']} {E(m['name'])}</h2><span class="pill {PILL[m['status']]}">{E(m['status'])}</span></header>
  <p class="sources">AS-IS sources: {E(', '.join(cites)) if cites else 'none in the interview'}{' · dashed amber boxes are to confirm with the clinic (SECOND_INTERVIEW_QUESTIONS.md)' if confirm else ''}</p>
  <div class="pair"><figure><figcaption>AS-IS (before)</figcaption>{svg(m['base'] + '-as-is')}</figure>
  <figure><figcaption>TO-BE (with the system)</figcaption>{svg(m['base'] + '-to-be')}</figure></div>
  <table class="bvn"><thead><tr><th></th><th>Before</th><th>Now</th></tr></thead><tbody>{table}</tbody></table>
</section>"""


summary_rows = ''.join(f"<tr><td>M{m['n']}</td><td>{E(m['name'])}</td><td><span class=\"pill {PILL[m['status']]}\">{E(m['status'])}</span></td><td>{E(m['automation'])}</td></tr>" for m in data['modules'])
counts = {k: sum(1 for m in data['modules'] if m['status'] == k) for k in PILL}
legend = """<div class="legend"><span><i class="k cited"></i>Step from the interview (citation shown)</span><span><i class="k confirm"></i>To confirm with the clinic</span>
<span><i class="k auto"></i>The system does it</span><span><i class="k manual"></i>A person does it in the system</span><span><i class="k mock"></i>Mock only</span><span><i class="k planned"></i>Planned (not built)</span></div>"""

page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Process documentation</title><style>
@page {{ size: A4; margin: 13mm 12mm 15mm; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #142a40; font-size: 9.5pt; line-height: 1.4; }}
.page {{ page-break-after: always; }}
.bar {{ height: 5px; background: linear-gradient(90deg, #1865ac, #0c9b8e); border-radius: 3px; margin-bottom: 8px; }}
h1 {{ color: #124b80; font-size: 26pt; margin: 40mm 0 6mm; line-height: 1.1; }}
h2 {{ color: #124b80; font-size: 15pt; margin: 0; }}
h3 {{ color: #124b80; font-size: 11.5pt; margin: 10px 0 6px; }}
.cover p {{ font-size: 11pt; color: #3a4e63; max-width: 150mm; }}
.cover .meta {{ margin-top: 30mm; font-size: 9.5pt; color: #5a6b7d; }}
table {{ width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 8.6pt; }}
th, td {{ border-bottom: 1px solid #e1eaf1; padding: 4px 6px; text-align: left; vertical-align: top; }}
thead th {{ background: #eaf3fd; color: #124b80; }}
.pill {{ display: inline-block; padding: 1px 8px; border-radius: 999px; font-weight: 700; font-size: 8pt; }}
.pill.ok {{ background: #e6f5ee; color: #1d6b43; }} .pill.part {{ background: #eaf3fd; color: #124b80; }}
.pill.mock {{ background: #f3f5f7; color: #5a6b7d; }} .pill.plan {{ background: #fff6e3; color: #6a4500; }}
.mod-head {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eaf5f2; padding-bottom: 4px; }}
.sources {{ margin: 4px 0 6px; color: #5a6b7d; font-size: 8.4pt; }}
.pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
figure {{ margin: 0; border: 1px solid #dbe6ee; border-radius: 10px; padding: 6px; display: flex; flex-direction: column; align-items: center; }}
figcaption {{ align-self: flex-start; font-weight: 700; color: #124b80; font-size: 9pt; margin-bottom: 2px; }}
figure .svg {{ width: 100%; display: flex; justify-content: center; }}
figure svg {{ max-width: 100% !important; max-height: 172mm; width: auto; height: auto; }}
.wide figure svg {{ max-height: 118mm; }}
.tall figure svg {{ max-height: 232mm; }}
.arch figure svg {{ max-height: 240mm; }}
.bvn th {{ width: 26%; }} .bvn td {{ width: 37%; }}
.legend {{ display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 6px 0; font-size: 8.2pt; color: #3a4e63; }}
.legend .k {{ display: inline-block; width: 18px; height: 11px; border-radius: 3px; vertical-align: -1px; margin-right: 4px; border: 1.5px solid; }}
.k.cited, .k.manual {{ background: #eaf3fd; border-color: #1865ac; }} .k.confirm {{ background: #fffaf0; border-color: #b26a00; border-style: dashed; }}
.k.auto {{ background: #e6f5ee; border-color: #0c7f75; }} .k.mock {{ background: #f3f5f7; border-color: #5a6b7d; border-style: dotted; }} .k.planned {{ background: #fff; border-color: #5a6b7d; border-style: dashed; }}
ul {{ margin: 4px 0; padding-left: 18px; }} li {{ margin: 2px 0; }}
.missing {{ color: #a33; }}
</style></head><body>
<section class="page cover"><div class="bar"></div>
  <p style="color:#0c7f75;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:9pt">Dr. Dana E. Roxas Dental Clinic</p>
  <h1>Process documentation:<br/>before and with the system</h1>
  <p>For each of the 25 modules, how the clinic did the work before (AS-IS, from the clinic interview only) and how the
  Multi-Branch Dental Clinic Operation System does it now (TO-BE, from the code and its tests).</p>
  <p class="meta">Version of 2026-10-18 · branch feat/auth-messaging-paymongo · sources: docs/defense/INTERVIEW_EVIDENCE.md,
  docs/defense/MODULES_FINAL.md, docs/defense/AUTOMATION_EVIDENCE.md</p>
</section>
<section class="page"><div class="bar"></div><h2>Scope and how to read this document</h2>
  <ul>
    <li><b>AS-IS</b> steps come only from the interview: each shows its source (Q = first interview, PI = follow-up of 2026-10-11,
    MC = team confirmation of 2026-10-12). A step the interview did not describe is a <b>dashed amber box "to confirm with
    clinic"</b>; its question is in SECOND_INTERVIEW_QUESTIONS.md. Nothing about the old process is invented.</li>
    <li><b>TO-BE</b> steps are what the system does today. Planned work is dashed and tagged "Planned"; browser-only prototypes are tagged "Mock only".</li>
    <li>No time savings are claimed: the interview gave no task durations, so every estimate says "not measured".</li>
    <li>Statuses: Implemented {counts['Implemented']}, Partial {counts['Partial']}, Mock only {counts['Mock only']}, Planned {counts['Planned']}.</li>
  </ul>
  {legend}
  <h3>Module summary</h3>
  <table><thead><tr><th>#</th><th>Module</th><th>Status</th><th>Automation type</th></tr></thead><tbody>{summary_rows}</tbody></table>
</section>
<section class="page tall"><div class="bar"></div><h2>End-to-end patient journey</h2>{legend}
  <div class="pair"><figure><figcaption>AS-IS (before)</figcaption>{svg('overview-as-is')}</figure><figure><figcaption>TO-BE (with the system)</figcaption>{svg('overview-to-be')}</figure></div>
</section>
<section class="page arch"><div class="bar"></div><h2>System architecture (as built)</h2>
  <p class="sources">Running today in the demo: one clinic server, PostgreSQL, Gmail SMTP and PayMongo test mode.</p>
  <figure><figcaption>As built and running in the demo</figcaption>{svg('architecture')}</figure>
</section>
<section class="page arch"><div class="bar"></div><h2>Planned hosting</h2>
  <p class="sources">Not deployed. Dashed boxes are planned; PayMongo would use the clinic's own account.</p>
  <figure><figcaption>Planned hosting (not deployed)</figcaption>{svg('hosting-planned')}</figure>
</section>
{''.join(module_page(m) for m in data['modules'])}
<section class="page"><div class="bar"></div><h2>Limitations and open items</h2>
  <ul>
    <li>Planned modules (M3, M10, M12, M15, M24, M25) and mock-only modules (M19, M20) are drawn as designs, not working software.</li>
    <li>Appointment reminders are not automated yet (PI-31); confirmation and change emails are.</li>
    <li>Online times are limited by the dentists' seeded shifts until the clinic gives real schedules (PI-06).</li>
    <li>Branches 1 and 2 share one phone number (to confirm); branch 3 has no email and an incomplete address.</li>
    <li>Payments run in PayMongo test mode; live payments need the clinic's own PayMongo account.</li>
    <li>Privacy Policy and Terms are drafts; retention periods are not decided (RA 10173).</li>
    <li>Some timestamps are stored 8 hours early (docs/TIMEZONE_PLAN.md); fix planned after the defense.</li>
    <li>24 questions for the second interview: docs/defense/SECOND_INTERVIEW_QUESTIONS.md. Full list of clinic decisions: docs/defense/OPEN_ITEMS.md.</li>
  </ul>
</section>
</body></html>"""
open(os.path.join(HERE, 'process_documentation.html'), 'w').write(page)
print('html written')
