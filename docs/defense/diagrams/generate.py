"""Writes the Mermaid sources (M{n}-{slug}-as-is.mmd / -to-be.mmd, overview, architecture, hosting) and
docs/defense/SECOND_INTERVIEW_QUESTIONS.md from process_data.py. Render with render.mjs. Run: python3 generate.py"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_data import LANES, MODULES, OVERVIEW_AS_IS, OVERVIEW_TO_BE  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
CLASSES = """    classDef cited fill:#eaf3fd,stroke:#1865ac,color:#142a40,stroke-width:1.5px
    classDef confirm fill:#fffaf0,stroke:#b26a00,color:#5e3c00,stroke-width:1.5px,stroke-dasharray:6 4
    classDef auto fill:#e6f5ee,stroke:#0c7f75,color:#0f3d33,stroke-width:1.5px
    classDef manual fill:#eaf3fd,stroke:#1865ac,color:#142a40,stroke-width:1.5px
    classDef mock fill:#f3f5f7,stroke:#5a6b7d,color:#3a4e63,stroke-width:1.5px,stroke-dasharray:3 3
    classDef planned fill:#ffffff,stroke:#5a6b7d,color:#3a4e63,stroke-width:1.5px,stroke-dasharray:6 4"""


def esc(text):
    return text.replace('"', '#quot;')


def label(step, view):
    if view == 'as-is':
        if 'confirm' in step:
            return f'{esc(step["text"])}<br/><i>to confirm with clinic</i>', 'confirm'
        return f'{esc(step["text"])}<br/><i>{esc(step["cite"])}</i>', 'cited'
    kind = step['kind']
    tag = {'auto': 'System does it', 'manual': '', 'mock': 'Mock only', 'planned': 'Planned'}[kind]
    return (f'{esc(step["text"])}<br/><i>{tag}</i>' if tag else esc(step['text'])), kind


def flow(title, steps, view):
    lines = [f'---\ntitle: "{esc(title)}"\n---', 'flowchart TB']
    for lane in LANES:
        ids = [i for i, s in enumerate(steps) if s['lane'] == lane]
        if not ids:
            continue
        # The lane name is the bold first line of each box (an untitled lane box), so no arrow can cross a lane title.
        lines.append(f'    subgraph L{LANES.index(lane)}[" "]\n    direction LR')
        for i in ids:
            text, cls = label(steps[i], view)
            lines.append(f'      S{i}["<b>{lane.upper()}</b><br/>{text}"]:::{cls}')
        lines.append('    end')
    for i in range(len(steps) - 1):
        dashed = steps[i + 1].get('kind') in ('planned', 'mock') or 'confirm' in steps[i + 1]
        lines.append(f'    S{i} {"-.->" if dashed else "-->"} S{i + 1}')
    lines.append(CLASSES)
    return '\n'.join(lines) + '\n'


ARCHITECTURE = """---
title: "System architecture (as built and running in the demo)"
---
flowchart TB
    subgraph Browser[" "]
      W["<b>BROWSER</b><br/>React portal (Vite)<br/><i>landing, patient portal, staff, dentist, owner</i>"]
    end
    subgraph Server[" "]
      A["<b>CLINIC SERVER</b><br/>Laravel API<br/><i>Sanctum sessions, roles, rules</i>"]
      Q["<b>CLINIC SERVER</b><br/>Queue worker<br/><i>emails, retries</i>"]
      SC["<b>CLINIC SERVER</b><br/>Scheduler<br/><i>due emails every minute</i>"]
      R["<b>CLINIC SERVER</b><br/>Reverb<br/><i>real-time messages</i>"]
    end
    DB[("PostgreSQL<br/><i>append-only money, audit and history</i>")]
    G["Gmail SMTP<br/><i>codes, confirmations, invoices, receipts</i>"]
    P["PayMongo<br/><i>hosted checkout + signed webhook</i>"]
    W -->|HTTPS JSON| A
    W <-->|WebSocket| R
    A --> DB
    Q --> DB
    SC --> Q
    A -->|outbox| Q
    Q -->|SMTP| G
    W -->|redirect to pay| P
    P -->|webhook| A
    A -->|broadcast| R
    classDef ext fill:#fffaf0,stroke:#b26a00,color:#5e3c00
    class G,P ext
"""

HOSTING = """---
title: "Planned hosting (not deployed yet)"
---
flowchart LR
    V["<b>VERCEL</b><br/>React portal<br/><i>Planned</i>"]:::planned
    subgraph RW[" "]
      A["<b>RAILWAY</b><br/>Laravel API<br/><i>Planned</i>"]:::planned
      Q["<b>RAILWAY</b><br/>Queue worker<br/><i>Planned</i>"]:::planned
      SC["<b>RAILWAY</b><br/>Scheduler<br/><i>Planned</i>"]:::planned
      R["<b>RAILWAY</b><br/>Reverb<br/><i>Planned</i>"]:::planned
    end
    subgraph SB[" "]
      DB[("<b>SUPABASE</b><br/>PostgreSQL<br/><i>Planned</i>")]:::planned
      ST["<b>SUPABASE</b><br/>Private file storage<br/><i>Planned</i>"]:::planned
    end
    M["Transactional email provider<br/><i>clinic's own domain</i><br/><i>Planned</i>"]:::planned
    P["PayMongo<br/><i>clinic's own account</i>"]
    V --> A
    V <--> R
    A --> DB
    A --> ST
    Q --> M
    P -->|webhook| A
    classDef planned fill:#ffffff,stroke:#5a6b7d,color:#3a4e63,stroke-dasharray:6 4
"""


def main():
    written = []
    index = []
    for m in MODULES:
        base = f'M{m["n"]}-{m["slug"]}'
        for view, steps in (('as-is', m['as_is']), ('to-be', m['to_be'])):
            title = f'M{m["n"]} {m["name"]}: {"AS-IS (before)" if view == "as-is" else "TO-BE (with the system)"}'
            with open(os.path.join(HERE, f'{base}-{view}.mmd'), 'w') as f:
                f.write(flow(title, steps, view))
            written.append(f'{base}-{view}.mmd')
        index.append({'n': m['n'], 'base': base, 'name': m['name'], 'status': m['status'], 'errors': m['errors'], 'automation': m['automation'],
                      'as_is': m['as_is'], 'to_be': m['to_be']})
    for name, title, steps, view in (('overview-as-is', 'Patient journey: AS-IS (before)', OVERVIEW_AS_IS, 'as-is'),
                                     ('overview-to-be', 'Patient journey: TO-BE (with the system)', OVERVIEW_TO_BE, 'to-be')):
        with open(os.path.join(HERE, f'{name}.mmd'), 'w') as f:
            f.write(flow(title, steps, view))
        written.append(f'{name}.mmd')
    for name, text in (('architecture', ARCHITECTURE), ('hosting-planned', HOSTING)):
        with open(os.path.join(HERE, f'{name}.mmd'), 'w') as f:
            f.write(text)
        written.append(f'{name}.mmd')
    with open(os.path.join(HERE, 'modules.json'), 'w') as f:
        json.dump({'modules': index, 'overview': {'as_is': OVERVIEW_AS_IS, 'to_be': OVERVIEW_TO_BE}}, f, indent=1, ensure_ascii=False)

    # Second interview: every "to confirm" step, grouped by module.
    out = ['# Second interview: questions for the clinic', '',
           'Every step of the old process that the first interview did not describe is drawn as a dashed "to confirm with clinic"',
           'box in the AS-IS diagrams. These are the questions behind those boxes, grouped by module. For each, please tell us',
           '**who does it, with what tool, how long it takes, and what goes wrong**.', '',
           'Clinic: ______________________   Answered by: ______________________   Date: ____________', '']
    count = 0
    groups = [(f'M{m["n"]} {m["name"]}', m['as_is']) for m in MODULES] + [('Patient journey (overview)', OVERVIEW_AS_IS)]
    for title, steps in groups:
        qs = [s['confirm'] for s in steps if 'confirm' in s]
        if not qs:
            continue
        out += [f'## {title}', '']
        for q in qs:
            count += 1
            out += [f'{count}. {q}', '   - Who does it / tool: ______________________________', '   - How long / what goes wrong: ______________________________', '']
    with open(os.path.join(HERE, '..', 'SECOND_INTERVIEW_QUESTIONS.md'), 'w') as f:
        f.write('\n'.join(out))
    print(f'{len(written)} diagrams, {count} questions')


if __name__ == '__main__':
    main()
