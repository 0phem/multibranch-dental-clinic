{{-- The hero figure: a label, the amount large, and a line under it (for example the date). --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 24px;">
<tr><td align="center" class="bg-soft" style="background-color:#f4f8fc; border:1px solid #dde6f0; border-radius:14px; padding:24px 16px;">
    <div class="t-muted" style="font-size:12px; line-height:16px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#5b6b7f;">{{ $label }}</div>
    <div class="hero-amount t-ink" style="font-size:40px; line-height:48px; font-weight:800; color:#182b41; margin-top:6px;">{{ $amount }}</div>
    @if (! empty($note))<div class="t-muted" style="font-size:14px; line-height:20px; color:#5b6b7f; margin-top:4px;">{{ $note }}</div>@endif
</td></tr>
</table>
