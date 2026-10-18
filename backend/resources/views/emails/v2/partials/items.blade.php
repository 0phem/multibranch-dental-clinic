{{-- Itemized procedures, comfortable rows, subtotal, optional coverage deduction and a clear total. --}}
@php
    $money = fn ($v) => \App\Support\Brand::money($v);
    $fresh = \App\Support\Brand::design() === 'fresh';
    $rule = $fresh ? '#e4f0ec' : '#e6ebf1';
@endphp
<p class="t-ink" style="margin:6px 0 10px; font-size:17px; line-height:24px; font-weight:800; color:#14283d;">{{ $title ?? 'Procedures' }}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="{{ $fresh ? 'bg-soft' : '' }}" style="margin:0 0 22px; {{ $fresh ? 'background-color:#f6faf9; border-radius:16px;' : '' }} border-collapse:separate;">
@foreach ($invoice->lines as $i => $line)
<tr>
    <td class="t-ink line" valign="top" style="padding:14px {{ $fresh ? '18px' : '0' }}; font-size:16px; line-height:22px; color:#14283d; border-top:{{ $i || ! $fresh ? '1px solid '.$rule : '0' }};">
        <strong>{{ $line->service_name }}</strong><br>
        <span class="t-muted" style="font-size:14px; line-height:20px; color:#5b6b7f;">{{ $line->quantity }} &times; {{ $money($line->unit_price) }}</span>
    </td>
    <td class="t-ink line" valign="top" align="right" style="padding:14px {{ $fresh ? '18px' : '0' }}; font-size:16px; line-height:22px; font-weight:700; color:#14283d; text-align:right; white-space:nowrap; border-top:{{ $i || ! $fresh ? '1px solid '.$rule : '0' }};">{{ $money($line->line_total) }}</td>
</tr>
@endforeach
<tr>
    <td class="t-muted line" style="padding:14px {{ $fresh ? '18px' : '0' }} 4px; font-size:15px; line-height:22px; color:#5b6b7f; border-top:1px solid {{ $rule }};">Subtotal</td>
    <td class="t-ink line" align="right" style="padding:14px {{ $fresh ? '18px' : '0' }} 4px; font-size:15px; line-height:22px; color:#14283d; text-align:right; white-space:nowrap; border-top:1px solid {{ $rule }};">{{ $money($invoice->gross_amount) }}</td>
</tr>
@if ((float) $invoice->hmo_coverage_amount > 0)
<tr>
    <td class="t-muted" style="padding:4px {{ $fresh ? '18px' : '0' }}; font-size:15px; line-height:22px; color:#5b6b7f;">Less: coverage</td>
    <td class="t-ink" align="right" style="padding:4px {{ $fresh ? '18px' : '0' }}; font-size:15px; line-height:22px; color:#14283d; text-align:right; white-space:nowrap;">&minus;{{ $money($invoice->hmo_coverage_amount) }}</td>
</tr>
@endif
<tr>
    <td class="t-ink" style="padding:10px {{ $fresh ? '18px' : '0' }} 16px; font-size:18px; line-height:26px; font-weight:800; color:#14283d;">Total</td>
    <td class="t-ink" align="right" style="padding:10px {{ $fresh ? '18px' : '0' }} 16px; font-size:18px; line-height:26px; font-weight:800; color:#14283d; text-align:right; white-space:nowrap;">{{ $money($invoice->patient_responsibility_amount) }}</td>
</tr>
</table>
