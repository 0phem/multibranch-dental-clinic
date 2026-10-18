{{--
    Payment Receipt / Invoice PDF (A4, dompdf). Two designs from config('clinic.brand.design'):
      premium (B) — deep brand-blue header band with a white logo tile; teal accents; refined invoice layout.
      fresh   (A) — white header with a mint wave, large logo, airy spacing.
    dompdf-safe: tables and fixed positioning only; fonts DejaVu Sans (has the peso sign); page numbers from CSS counters (no PHP).
    Titles are "Payment Receipt" / "Invoice", never "Official". Variables: $title, $docNumber, $docDate, $stamp ['text', 'tone'].
--}}
@php
    $fresh = ($design ?? 'premium') === 'fresh';
    $ink = '#14283d'; $muted = '#5b6b7f'; $rule = $fresh ? '#dfece8' : '#e1e7ee';
    $accent = $fresh ? $brand['primary'] : $brand['accent_dark'];
    $stampColour = ($stamp['tone'] ?? '') === 'paid' ? '#157347' : '#a15c00';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ $title }} {{ $docNumber }}</title>
<style>
    @page { margin: 16mm 16mm 26mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 9.6pt; line-height: 1.45; color: #33475b; margin: 0; }
    table { border-collapse: collapse; width: 100%; }
    td, th { vertical-align: top; }
    .muted { color: {{ $muted }}; }
    .ink { color: {{ $ink }}; }
    .strong { font-weight: bold; }
    .label { font-size: 7.6pt; letter-spacing: 1.4px; text-transform: uppercase; color: {{ $muted }}; font-weight: bold; }
    .head { {{ $fresh ? 'background-color:#eaf5f2; border-radius: 10px 10px 0 0;' : 'background-color:'.$brand['primary_dark'].'; border-radius: 10px;' }} }
    .head td { padding: 18px 20px; }
    .head .name { font-size: 15pt; font-weight: bold; color: {{ $fresh ? $ink : '#ffffff' }}; }
    .head .tag { font-size: 8.6pt; font-weight: bold; color: {{ $fresh ? '#08665c' : '#cfe3f7' }}; margin-top: 1px; }
    .head .contact { font-size: 8.4pt; color: {{ $fresh ? $muted : '#dbe8f5' }}; margin-top: 7px; line-height: 1.5; }
    .head .doc { font-size: 17pt; font-weight: bold; color: {{ $fresh ? $ink : '#ffffff' }}; text-align: right; }
    .head .docmeta { font-size: 9pt; color: {{ $fresh ? $muted : '#dbe8f5' }}; text-align: right; line-height: 1.6; margin-top: 3px; }
    .head .docmeta b { color: {{ $fresh ? $ink : '#ffffff' }}; }
    .tile { background-color: #ffffff; border-radius: {{ $fresh ? '40px' : '10px' }}; padding: 6px; width: 64px; height: 64px; {{ $fresh ? 'border:1px solid #cfe8e0;' : '' }} }
    .rule { height: 3px; background-color: {{ $fresh ? '#bfe5da' : $brand['accent'] }}; margin: 0 0 18px; }
    .stamp { display: inline-block; border: 2px solid {{ $stampColour }}; color: {{ $stampColour }}; font-size: 11pt; font-weight: bold; letter-spacing: 3px; padding: 5px 14px; border-radius: 4px; margin-top: 10px; background-color: #ffffff; }
    .box { border: 1px solid {{ $rule }}; border-radius: 8px; padding: 12px 14px; {{ $fresh ? 'background-color:#f7fbfa;' : '' }} }
    .kv td { padding: 3px 0; font-size: 9.4pt; }
    .kv td.k { color: {{ $muted }}; width: 42%; }
    .kv td.v { color: {{ $ink }}; font-weight: bold; text-align: right; }
    .items { margin-top: 6px; }
    .items thead { display: table-header-group; }
    .items tr { page-break-inside: avoid; }
    .items th { font-size: 7.6pt; letter-spacing: 1.2px; text-transform: uppercase; color: {{ $fresh ? '#0b5f56' : '#ffffff' }}; background-color: {{ $fresh ? '#e3f3ee' : $brand['primary_dark'] }}; padding: 8px 10px; text-align: left; }
    .items td { padding: 10px 10px; border-bottom: 1px solid {{ $rule }}; color: {{ $ink }}; font-size: 9.6pt; }
    .items .num { text-align: right; white-space: nowrap; }
    .items .qty { text-align: center; white-space: nowrap; width: 9%; }
    .items tr.alt td { background-color: {{ $fresh ? '#fafdfc' : '#f8fafc' }}; }
    .items tr.sum td { border-bottom: none; background-color: #ffffff; padding: 5px 10px; font-size: 9.8pt; }
    .items tr.sum.first td.k, .items tr.sum.first td.v { padding-top: 12px; }
    .items tr.sum td.k { color: {{ $muted }}; text-align: right; }
    .items tr.sum td.v { color: {{ $ink }}; text-align: right; white-space: nowrap; }
    .items tr.sum table.due td { padding: 10px 12px; font-size: 11.5pt; font-weight: bold; color: {{ $ink }}; border-bottom: none; background-color: {{ ($stamp['tone'] ?? '') === 'paid' ? '#e8f6ef' : '#fff3df' }}; }
    .items tr.sum.total td.k, .items tr.sum.total td.v { border-top: 1.5px solid {{ $ink }}; font-weight: bold; font-size: 11pt; color: {{ $ink }}; padding-top: 8px; }
    .due { margin-top: 8px; border-radius: 8px; background-color: {{ ($stamp['tone'] ?? '') === 'paid' ? '#e8f6ef' : '#fff3df' }}; border: 1px solid {{ ($stamp['tone'] ?? '') === 'paid' ? '#bfe3cf' : '#f1d4a6' }}; }
    .due td { padding: 10px 12px; font-size: 12pt; font-weight: bold; color: {{ $ink }}; }
    .note { margin-top: 0; border-left: 3px solid {{ $accent }}; background-color: {{ $fresh ? '#f2f9f7' : '#f5f8fb' }}; padding: 10px 14px; border-radius: 4px; font-size: 9.4pt; color: #33475b; page-break-inside: avoid; }
    .section { margin-top: 18px; page-break-inside: avoid; }
</style>
</head>
<body>
<table class="head"><tr>
    <td style="width:56%;">
        <table><tr>
            @if ($logo)<td style="width:84px; padding:0;"><div class="tile"><img src="{{ $logo }}" width="64" height="64" alt="{{ $brand['name'] }} logo"></div></td>@endif
            <td style="padding:2px 0 0 4px;">
                <div class="name">{{ $brand['name_line'] }}</div>
                @if ($brand['tagline'])<div class="tag">{{ $brand['tagline'] }}</div>@endif
                <div class="contact">
                    @if ($brand['branch_address'] ?: $brand['address']){{ $brand['branch_address'] ?: $brand['address'] }}<br>@endif
                    {{ $brand['branch_phone'] ?: $brand['phone'] }}@if ($brand['email'])<br>{{ $brand['email'] }}@endif
                </div>
            </td>
        </tr></table>
    </td>
    <td style="width:44%;">
        <div class="doc">{{ $title }}</div>
        <div class="docmeta">No. <b>{{ $docNumber }}</b><br>@if ($docDate)Date <b>{{ $docDate }}</b>@endif</div>
        <div style="text-align:right;"><span class="stamp">{{ $stamp['text'] }}</span></div>
    </td>
</tr></table>
@if ($fresh)
@if (! empty($wave))<img src="{{ $wave }}" alt="" style="width:100%; height:18px; display:block; margin:0 0 16px;">@else<div style="height:16px;"></div>@endif
@else
<div class="rule"></div>
@endif

<table><tr>
    <td style="width:49%; padding-right:8px;">
        <div class="box">
            <div class="label" style="margin-bottom:6px;">Billed to</div>
            <div class="ink strong" style="font-size:11pt;">{{ $patientName }}</div>
            @if ($patientEmail)<div class="muted">{{ $patientEmail }}</div>@endif
            @foreach ($billingAddress as $line)<div class="muted">{{ $line }}</div>@endforeach
        </div>
    </td>
    <td style="width:51%; padding-left:8px;">
        <div class="box">
            <div class="label" style="margin-bottom:4px;">Details</div>
            <table class="kv">@yield('details')</table>
        </div>
    </td>
</tr></table>

{{-- The column headings repeat on every page. The last two procedures, the totals, the amount box and the note belong together:
     BillingDocuments renders once, and if the totals or the note land on a later page than the second-to-last procedure it renders
     again with $breakTail, which closes the table before those two rows and reopens it, with its headings, on a new page. --}}
@php
    $lines = $invoice->lines->values();
    $tailAt = max(0, $lines->count() - 2);
    $segments = ! empty($breakTail) && $tailAt > 0 ? [[0, $tailAt], [$tailAt, $lines->count()]] : [[0, $lines->count()]];
@endphp
<div class="label" style="margin:18px 0 4px;">Procedures</div>
@foreach ($segments as $s => [$from, $to])
@if ($s)<div style="page-break-before: always;"></div>@endif
<table class="items">
    <thead><tr><th>Procedure</th><th class="qty" style="text-align:center;">Qty</th><th class="num" style="text-align:right; width:17%;">Unit price</th><th class="num" style="text-align:right; width:17%;">Amount</th></tr></thead>
    <tbody>
        @foreach ($lines->slice($from, $to - $from) as $i => $line)
        <tr class="{{ $i % 2 ? 'alt' : '' }}" @if ($i === $tailAt) id="pdf-tail" @endif><td>{{ $line->service_name }}</td><td class="qty">{{ $line->quantity }}</td><td class="num">{{ \App\Support\Brand::money($line->unit_price) }}</td><td class="num">{{ \App\Support\Brand::money($line->line_total) }}</td></tr>
        @endforeach
        @if ($to === $lines->count())
        <tr class="sum first" id="pdf-totals"><td colspan="2" class="blank"></td><td class="k">Subtotal</td><td class="v">{{ $subtotal }}</td></tr>
        @if ($hmoShare)<tr class="sum"><td colspan="2" class="blank"></td><td class="k">Less: coverage</td><td class="v">&minus;{{ $hmoShare }}</td></tr>@endif
        <tr class="sum total"><td colspan="2" class="blank"></td><td class="k">Total</td><td class="v">{{ $total }}</td></tr>
        <tr class="sum"><td class="blank"></td><td colspan="3" style="padding:6px 0 0 0;"><table class="due"><tr><td style="white-space:nowrap;">@yield('due-label')</td><td style="text-align:right; white-space:nowrap;">@yield('due-amount')</td></tr></table></td></tr>
        <tr class="sum" id="pdf-end"><td colspan="4" style="padding:16px 0 0 0;"><div class="note">@yield('note')</div></td></tr>
        @endif
    </tbody>
</table>
@endforeach

@if (! empty($bir))
<div class="section">
    <div class="label" style="margin-bottom:4px;">Business registration</div>
    <div class="box"><table class="kv">
        @foreach ($bir as $label => $value)<tr><td class="k">{{ $label }}</td><td class="v">{{ $value }}</td></tr>@endforeach
    </table></div>
</div>
@endif
</body>
</html>
