{{-- Itemized procedures with subtotal, optional HMO coverage, and total. $invoice must have its lines loaded. --}}
@php($money = fn ($v) => \App\Support\Brand::money($v))
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-card" style="margin:0 0 18px; border:1px solid #dde6f0; border-radius:12px; border-collapse:separate;">
<tr>
    <td class="t-muted line" style="padding:12px 18px; font-size:12px; line-height:16px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#5b6b7f; border-bottom:1px solid #e7eef5;">Procedure</td>
    <td class="t-muted line" align="right" style="padding:12px 18px; font-size:12px; line-height:16px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#5b6b7f; border-bottom:1px solid #e7eef5; text-align:right; white-space:nowrap;">Amount</td>
</tr>
@foreach ($invoice->lines as $line)
<tr>
    <td class="t-ink line" valign="top" style="padding:12px 18px; font-size:14px; line-height:20px; color:#182b41; border-bottom:1px solid #eef3f8;">
        <strong>{{ $line->service_name }}</strong><br>
        <span class="t-muted" style="font-size:12px; color:#5b6b7f;">{{ $line->quantity }} &times; {{ $money($line->unit_price) }}</span>
    </td>
    <td class="t-ink line" valign="top" align="right" style="padding:12px 18px; font-size:14px; line-height:20px; color:#182b41; text-align:right; white-space:nowrap; border-bottom:1px solid #eef3f8;">{{ $money($line->line_total) }}</td>
</tr>
@endforeach
<tr>
    <td class="t-muted" style="padding:12px 18px 4px; font-size:14px; line-height:20px; color:#5b6b7f;">Subtotal</td>
    <td class="t-ink" align="right" style="padding:12px 18px 4px; font-size:14px; line-height:20px; color:#182b41; text-align:right; white-space:nowrap;">{{ $money($invoice->gross_amount) }}</td>
</tr>
@if ((float) $invoice->hmo_coverage_amount > 0)
<tr>
    <td class="t-muted" style="padding:4px 18px; font-size:14px; line-height:20px; color:#5b6b7f;">HMO coverage</td>
    <td class="t-ink" align="right" style="padding:4px 18px; font-size:14px; line-height:20px; color:#182b41; text-align:right; white-space:nowrap;">&minus;{{ $money($invoice->hmo_coverage_amount) }}</td>
</tr>
@endif
<tr>
    <td class="t-ink" style="padding:10px 18px 14px; font-size:16px; line-height:22px; font-weight:800; color:#182b41;">Total</td>
    <td class="t-ink" align="right" style="padding:10px 18px 14px; font-size:16px; line-height:22px; font-weight:800; color:#182b41; text-align:right; white-space:nowrap;">{{ $money($invoice->patient_responsibility_amount) }}</td>
</tr>
</table>
