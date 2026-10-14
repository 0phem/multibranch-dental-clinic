{{-- Full-width, tall, rounded button (a table cell carries the colour for Outlook), and a small tidy "Open in browser" link. --}}
@php
    $b = \App\Support\Brand::forEmail();
    $fresh = $b['design'] === 'fresh';
    $colour = $fresh ? $b['primary'] : $b['accent_dark'];
    $radius = $fresh ? '999px' : '12px';
@endphp
{{-- Outlook (Word engine) ignores padding on links, so it gets a VML round-rectangle button instead; everyone else the table button. --}}
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ $url }}" style="height:56px; v-text-anchor:middle; width:520px; margin-top:24px;" arcsize="{{ $fresh ? '50%' : '20%' }}" stroke="f" fillcolor="{{ $colour }}"><w:anchorlock/><center style="color:#ffffff; font-family:Arial, sans-serif; font-size:17px; font-weight:bold;">{{ $label }}</center></v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
<tr><td align="center" bgcolor="{{ $colour }}" style="border-radius:{{ $radius }}; background-color:{{ $colour }};">
    <a href="{{ $url }}" target="_blank" style="display:block; padding:18px 24px; font-size:17px; line-height:22px; font-weight:800; color:#ffffff; text-decoration:none; border-radius:{{ $radius }}; text-align:center; mso-padding-alt:0;">{{ $label }}</a>
</td></tr>
</table>
<!--<![endif]-->
<p class="t-muted" style="margin:0 0 20px; font-size:14px; line-height:20px; color:#5b6b7f; text-align:center;">Button not working? <a class="t-link" href="{{ $url }}" target="_blank" style="color:{{ $b['primary'] }}; font-weight:600;">Open in browser</a></p>
