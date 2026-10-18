{{-- Two one-click answers (F1–F3): a filled button and an outlined one. Each opens a page on the clinic site; the link works once. --}}
@php
    $b = \App\Support\Brand::forEmail();
    $colour = $b['design'] === 'fresh' ? $b['primary'] : $b['accent_dark'];
    $radius = $b['design'] === 'fresh' ? '999px' : '12px';
@endphp
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
<tr>
    <td width="50%" style="padding:0 6px 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="{{ $colour }}" style="border-radius:{{ $radius }}; background-color:{{ $colour }};">
            <a href="{{ $primaryUrl }}" target="_blank" style="display:block; padding:16px 12px; font-size:16px; line-height:20px; font-weight:800; color:#ffffff; text-decoration:none; border-radius:{{ $radius }}; text-align:center;">{{ $primaryLabel }}</a>
        </td></tr></table>
    </td>
    <td width="50%" style="padding:0 0 0 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border-radius:{{ $radius }}; border:2px solid {{ $colour }};">
            <a href="{{ $secondaryUrl }}" target="_blank" style="display:block; padding:14px 12px; font-size:16px; line-height:20px; font-weight:800; color:{{ $colour }}; text-decoration:none; border-radius:{{ $radius }}; text-align:center;">{{ $secondaryLabel }}</a>
        </td></tr></table>
    </td>
</tr>
</table>
@if (! empty($note))<p class="t-muted" style="margin:0 0 20px; font-size:14px; line-height:20px; color:#5b6b7f; text-align:center;">{{ $note }}</p>@endif
