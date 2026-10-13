{{-- Label/value rows in a card. $rows: [[label, value, mono?], ...]; empty values are skipped. --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-card" style="margin:0 0 22px; border:1px solid #dde6f0; border-radius:12px; border-collapse:separate;">
@if (! empty($title))
<tr><td colspan="2" class="t-ink line" style="padding:14px 18px 10px; font-size:13px; line-height:18px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#182b41; border-bottom:1px solid #e7eef5;">{{ $title }}</td></tr>
@endif
@foreach (array_values(array_filter($rows, fn ($r) => ($r[1] ?? '') !== '' && $r[1] !== null)) as $i => $row)
<tr>
    <td class="t-muted line" valign="top" style="padding:11px 18px; width:42%; font-size:14px; line-height:20px; color:#5b6b7f; {{ $i ? 'border-top:1px solid #eef3f8;' : '' }}">{{ $row[0] }}</td>
    <td class="t-ink line" valign="top" align="right" style="padding:11px 18px; font-size:{{ ! empty($row[2]) ? '12px' : '14px' }}; line-height:20px; font-weight:{{ ! empty($row[2]) ? '400' : '600' }}; color:#182b41; text-align:right; {{ ! empty($row[2]) ? "word-break:break-all; font-family:'SF Mono', Menlo, Consolas, 'Courier New', monospace;" : 'overflow-wrap:break-word;' }} {{ $i ? 'border-top:1px solid #eef3f8;' : '' }}">{{ $row[1] }}</td>
</tr>
@endforeach
</table>
