{{-- Tidy two-column details list. $rows: [[label, value], ...]; empty values are skipped. --}}
@php($fresh = \App\Support\Brand::design() === 'fresh')
@if (! empty($title))
<p class="t-ink" style="margin:6px 0 10px; font-size:17px; line-height:24px; font-weight:800; color:#14283d;">{{ $title }}</p>
@endif
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="{{ $fresh ? 'bg-soft' : '' }}" style="margin:0 0 24px; {{ $fresh ? 'background-color:#f6faf9; border-radius:16px;' : '' }} border-collapse:separate;">
@foreach (array_values(array_filter($rows, fn ($r) => ($r[1] ?? '') !== '' && $r[1] !== null)) as $i => $row)
<tr>
    <td class="t-muted line" valign="top" style="padding:13px {{ $fresh ? '18px' : '0' }}; width:44%; font-size:15px; line-height:22px; color:#5b6b7f; {{ $i ? 'border-top:1px solid '.($fresh ? '#e4f0ec' : '#e6ebf1').';' : ($fresh ? '' : 'border-top:1px solid #e6ebf1;') }}">{{ $row[0] }}</td>
    <td class="t-ink line" valign="top" align="right" style="padding:13px {{ $fresh ? '18px' : '0' }}; font-size:16px; line-height:22px; font-weight:700; color:#14283d; text-align:right; overflow-wrap:break-word; {{ $i ? 'border-top:1px solid '.($fresh ? '#e4f0ec' : '#e6ebf1').';' : ($fresh ? '' : 'border-top:1px solid #e6ebf1;') }}">{{ $row[1] }}</td>
</tr>
@endforeach
@if (! $fresh)<tr><td colspan="2" class="line" style="border-top:1px solid #e6ebf1; font-size:0; line-height:0;">&nbsp;</td></tr>@endif
</table>
