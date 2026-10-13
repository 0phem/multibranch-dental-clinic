{{-- Bulletproof button: a table cell carries the colour (Outlook ignores padding on links), with a plain link fallback under it. --}}
@php($b = \App\Support\Brand::forEmail())
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 10px;">
<tr><td align="center" bgcolor="{{ $b['primary'] }}" style="border-radius:10px; background-color:{{ $b['primary'] }};">
    <a href="{{ $url }}" target="_blank" style="display:inline-block; padding:14px 30px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size:15px; line-height:20px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;">{{ $label }}</a>
</td></tr>
</table>
<p class="t-muted" style="margin:0 0 18px; font-size:12px; line-height:18px; color:#5b6b7f;">Button not working? Copy this link into your browser:<br><a class="t-link" href="{{ $url }}" style="color:{{ $b['primary'] }}; word-break:break-all;">{{ $url }}</a></p>
