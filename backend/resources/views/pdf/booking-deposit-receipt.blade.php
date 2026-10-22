{{--
    Booking Deposit Receipt PDF (A4, dompdf, matching clinic branding).
    Issued when a patient pays the advance booking deposit online via PayMongo or at the clinic.
    Page numbers and footer are drawn by BillingDocuments::footer().
--}}
@php
    $fresh = \App\Support\Brand::design() === 'fresh';
    $ink = '#14283d'; $muted = '#5b6b7f'; $rule = $fresh ? '#dfece8' : '#e1e7ee';
    $stampColour = '#157347';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Booking Deposit Receipt {{ $depositNumber }}</title>
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
    .tile { background-color: #ffffff; border-radius: {{ $fresh ? '40px' : '10px' }}; padding: 6px; width: 64px; height: 64px; }
    .rule { height: 3px; background-color: {{ $fresh ? '#bfe5da' : $brand['accent'] }}; margin: 0 0 18px; }
    .stamp { display: inline-block; border: 2px solid {{ $stampColour }}; color: {{ $stampColour }}; font-size: 11pt; font-weight: bold; letter-spacing: 3px; padding: 5px 14px; border-radius: 4px; margin-top: 10px; background-color: #ffffff; }
    .box { border: 1px solid {{ $rule }}; border-radius: 8px; padding: 12px 14px; {{ $fresh ? 'background-color:#f7fbfa;' : '' }} }
    .kv td { padding: 3px 0; font-size: 9.4pt; }
    .kv td.k { color: {{ $muted }}; width: 44%; }
    .kv td.v { color: {{ $ink }}; font-weight: bold; text-align: right; }
    .items { margin-top: 16px; }
    .items thead { display: table-header-group; }
    .items th { font-size: 7.6pt; letter-spacing: 1.2px; text-transform: uppercase; color: {{ $fresh ? '#0b5f56' : '#ffffff' }}; background-color: {{ $fresh ? '#e3f3ee' : $brand['primary_dark'] }}; padding: 8px 10px; text-align: left; }
    .items td { padding: 10px 10px; border-bottom: 1px solid {{ $rule }}; color: {{ $ink }}; font-size: 9.6pt; }
    .items .num { text-align: right; white-space: nowrap; }
    .items .qty { text-align: center; white-space: nowrap; width: 9%; }
    .items tr.sum td { border-bottom: none; background-color: #ffffff; padding: 5px 10px; font-size: 9.8pt; }
    .items tr.sum.first td.k, .items tr.sum.first td.v { padding-top: 12px; }
    .items tr.sum td.k { color: {{ $muted }}; text-align: right; }
    .items tr.sum td.v { color: {{ $ink }}; text-align: right; white-space: nowrap; }
    .due { margin-top: 8px; border-radius: 8px; background-color: #e8f6ef; border: 1px solid #bfe3cf; }
    .due td { padding: 10px 12px; font-size: 11.5pt; font-weight: bold; color: {{ $ink }}; }
    .note { border-left: 3px solid #157347; padding: 8px 12px; background-color: #f7fbfa; border-radius: 0 4px 4px 0; font-size: 9pt; color: #233446; line-height: 1.5; margin-top: 16px; }
    .section { margin-top: 18px; }
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
        <div class="doc">Deposit Receipt</div>
        <div class="docmeta">No. <b>{{ $depositNumber }}</b><br>Date <b>{{ $date }}</b></div>
        <div style="text-align:right;"><span class="stamp">PAID</span></div>
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
            @if ($appointment->patient?->person?->phone)<div class="muted">{{ $appointment->patient->person->phone }}</div>@endif
        </div>
    </td>
    <td style="width:51%; padding-left:8px;">
        <div class="box">
            <div class="label" style="margin-bottom:4px;">Payment & Visit Details</div>
            <table class="kv">
                <tr><td class="k">Receipt number</td><td class="v">{{ $depositNumber }}</td></tr>
                <tr><td class="k">Appointment code</td><td class="v">{{ $appointment->appointment_code }}</td></tr>
                <tr><td class="k">Payment date</td><td class="v">{{ $paidAt }}</td></tr>
                <tr><td class="k">Method</td><td class="v">{{ $method }}</td></tr>
                @if ($reference)<tr><td class="k">Reference</td><td class="v" style="font-family:'DejaVu Sans Mono', monospace; font-weight:normal; font-size:8.4pt;">{{ $reference }}</td></tr>@endif
                @if ($branch)<tr><td class="k">Branch</td><td class="v">{{ $branch->name }}</td></tr>@endif
                <tr><td class="k">Scheduled visit</td><td class="v">{{ \App\Support\ClinicClock::local($appointment->starts_at)->format('M j, Y \a\t g:i A') }}</td></tr>
            </table>
        </div>
    </td>
</tr></table>

<table class="items">
    <thead>
        <tr>
            <th>Description</th>
            <th class="qty">Qty</th>
            <th class="num" style="width:25%;">Deposit Amount</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <b>Advance Booking Deposit</b><br>
                <span class="muted">{{ $appointment->service?->name ?? 'Dental Service' }} &mdash; Appointment {{ $appointment->appointment_code }}</span>
            </td>
            <td class="qty">1</td>
            <td class="num">{{ $amount }}</td>
        </tr>
        <tr class="sum first">
            <td class="blank"></td>
            <td class="k">Total Deposit Paid</td>
            <td class="v">{{ $amount }}</td>
        </tr>
        <tr class="sum">
            <td class="blank"></td>
            <td colspan="2" style="padding:6px 0 0 0;">
                <table class="due">
                    <tr>
                        <td style="white-space:nowrap;">Amount Received</td>
                        <td style="text-align:right; white-space:nowrap;">{{ $amount }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </tbody>
</table>

<div class="note">
    <b>Thank you for your payment.</b> This Booking Deposit Receipt confirms that your advance deposit of <b>{{ $amount }}</b> has been received via {{ $method }}. This deposit guarantees your appointment slot and will be credited toward your total procedure charges on the day of your visit.
</div>

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
