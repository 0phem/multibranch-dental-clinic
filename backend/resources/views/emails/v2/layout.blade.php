{{--
    Email layout v2 (design pass 2). One layout, two directions chosen by config('clinic.brand.design'):
      premium (B) — deep brand-blue header with a large white logo tile, crisp white body, teal accent for status and buttons.
      fresh   (A) — white and airy, soft mint / light-blue header with a large centred logo and a wave divider (embedded PNG).
    Table-based, inline styles, 600px, 16px body text. Images are embedded in the message (CID); the /dev/mail preview uses data URIs.
    Dark mode re-colours surfaces for clients that support prefers-color-scheme; the logo always sits on a white tile.
    Variables: $subject, $preheader, $reason, optional $branch.
--}}
@php
    $b = \App\Support\Brand::forEmail($branch ?? null);
    $fresh = $b['design'] === 'fresh';
    $inline = ! empty($brandPreview) || ! isset($message);
    $embed = fn (?string $path) => $path ? ($inline ? \App\Support\Brand::dataUri($path) : $message->embed($path)) : null;
    $logoPath = \App\Support\Brand::logoPath();
    $logoSrc = $embed($logoPath);
    // Displayed from the image's own proportions (never stretched); the file is at least 2x the display size, so it stays sharp.
    $logoBox = $fresh ? 64 : 60;
    [$lw, $lh] = $logoPath ? (@getimagesize($logoPath) ?: [1, 1]) : [1, 1];
    [$logoW, $logoH] = $lw >= $lh ? [$logoBox, (int) round($logoBox * $lh / max(1, $lw))] : [(int) round($logoBox * $lw / max(1, $lh)), $logoBox];
    $waveSrc = $fresh ? $embed(\App\Support\Brand::wavePath('#eaf5f2', '#ffffff')) : null;
    $font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    $page = $fresh ? '#eef6f4' : '#eef2f6';
    $phone = $b['branch_phone'] ?: $b['phone'];
    $where = $b['branch_name'] ? $b['branch_name'].($b['branch_address'] ? ' · '.$b['branch_address'] : '') : $b['address'];
@endphp
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{{ $subject ?? $b['name'] }}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; }
    a { color: {{ $b['primary'] }}; }
    @media only screen and (max-width: 620px) {
        .shell { width: 100% !important; border-radius: 0 !important; }
        .outer { padding: 0 !important; }
        .pad { padding-left: 22px !important; padding-right: 22px !important; }
        .hero-amount { font-size: 38px !important; line-height: 44px !important; }
        .code { font-size: 36px !important; letter-spacing: 10px !important; padding-left: 10px !important; }
        .stack { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
        .stack-gap { padding-top: 10px !important; }
        .h1 { font-size: 26px !important; line-height: 32px !important; }
        .sep { display: none !important; }
        .chip { display: block !important; text-align: center !important; }
        .foot-link { display: block !important; }
    }
    @media (prefers-color-scheme: dark) {
        .bg-page { background-color: #0d141b !important; }
        .bg-card { background-color: #151f29 !important; border-color: #24323f !important; }
        .bg-soft { background-color: #1b2834 !important; border-color: #2a3b4b !important; }
        .bg-head { background-color: #10202e !important; background-image: none !important; }
        .bg-foot { background-color: #111a22 !important; border-color: #24323f !important; }
        .t-ink { color: #f1f5f9 !important; }
        .t-body { color: #cfd9e3 !important; }
        .t-muted { color: #97a8b9 !important; }
        .t-link { color: #8cc3ff !important; }
        .t-accent { color: #6fd8c8 !important; }
        .hero-edge { border-color: #2f4558 !important; }
        .line { border-color: #2a3b4b !important; }
        .wave { display: none !important; }
    }
    [data-ogsc] .bg-card { background-color: #151f29 !important; }
    [data-ogsc] .t-ink { color: #f1f5f9 !important; }
    [data-ogsc] .t-body { color: #cfd9e3 !important; }
</style>
</head>
<body class="bg-page" style="margin:0; padding:0; background-color:{{ $page }}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
@if (! empty($preheader))
<div style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; mso-hide:all; font-size:1px; line-height:1px; color:{{ $page }};">{{ $preheader }}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
@endif
<table role="presentation" class="bg-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{{ $page }};">
<tr><td class="outer" align="center" style="padding:36px 12px;">
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" class="shell bg-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border-radius:{{ $fresh ? '24px' : '16px' }}; overflow:hidden; {{ $fresh ? 'border:1px solid #dcebe7;' : 'border:1px solid #d9e2ec;' }}">
        @if ($fresh)
        {{-- A: light mint/blue header, large centred logo, name and tagline, then the wave into the white body. --}}
        <tr><td class="pad bg-head" align="center" bgcolor="#eaf5f2" style="background-color:#eaf5f2; background-image:linear-gradient(180deg, #eaf3fd 0%, #eaf5f2 100%); padding:34px 36px 6px;">
            @if ($logoSrc)
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#ffffff" style="background-color:#ffffff; border-radius:50%; padding:10px; border:1px solid #d3ebe4;">
                <img src="{{ $logoSrc }}" width="{{ $logoW }}" height="{{ $logoH }}" alt="{{ $b['name'] }} logo" style="display:block; width:{{ $logoW }}px; height:{{ $logoH }}px; border:0;">
            </td></tr></table>
            @endif
            <div class="t-ink" style="font-family:{!! $font !!}; font-size:22px; line-height:28px; font-weight:800; color:#14324f; margin-top:14px;">{{ $b['name_line'] }}</div>
            @if ($b['tagline'])<div class="t-accent" style="font-family:{!! $font !!}; font-size:14px; line-height:20px; font-weight:700; color:#08665c; margin-top:2px;">{{ $b['tagline'] }}</div>@endif
        </td></tr>
        @if ($waveSrc)
        {{-- Solid mint behind the wave: if images are blocked the header simply continues, with no white seam. Hidden in dark mode. --}}
        <tr><td class="wave" bgcolor="#eaf5f2" height="32" style="background-color:#eaf5f2; line-height:0; font-size:0; height:32px;"><img src="{{ $waveSrc }}" width="600" height="32" alt="" style="display:block; width:100%; max-width:600px; height:32px; border:0;"></td></tr>
        @endif
        @else
        {{-- B: deep brand-blue header, large white logo tile, name and tagline, thin teal rule. --}}
        <tr><td class="pad bg-head" bgcolor="{{ $b['primary_dark'] }}" style="background-color:{{ $b['primary_dark'] }}; background-image:linear-gradient(135deg, {{ $b['primary_dark'] }} 0%, {{ $b['primary'] }} 100%); padding:28px 36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                @if ($logoSrc)
                <td valign="middle" style="padding-right:16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#ffffff" style="background-color:#ffffff; border-radius:16px; padding:8px;">
                        <img src="{{ $logoSrc }}" width="{{ $logoW }}" height="{{ $logoH }}" alt="{{ $b['name'] }} logo" style="display:block; width:{{ $logoW }}px; height:{{ $logoH }}px; border:0;">
                    </td></tr></table>
                </td>
                @endif
                <td valign="middle" style="font-family:{!! $font !!};">
                    <div style="font-size:22px; line-height:28px; font-weight:800; color:#ffffff;">{{ $b['name_line'] }}</div>
                    @if ($b['tagline'])<div style="font-size:14px; line-height:20px; font-weight:600; color:#cfe3f7; margin-top:2px;">{{ $b['tagline'] }}</div>@endif
                </td>
            </tr></table>
        </td></tr>
        <tr><td bgcolor="{{ $b['accent'] }}" style="background-color:{{ $b['accent'] }}; height:3px; line-height:3px; font-size:3px;">&nbsp;</td></tr>
        @endif

        <tr><td class="pad t-body" style="padding:{{ $fresh ? '18px' : '38px' }} 40px 8px; font-family:{!! $font !!}; font-size:16px; line-height:26px; color:#33475b;">
            @yield('content')
        </td></tr>

        {{-- Footer: two calm lines of contact details, why this was sent, then a small separate safety note. No marketing links. --}}
        <tr><td class="pad bg-foot" style="background-color:{{ $fresh ? '#f6faf9' : '#f7f9fb' }}; border-top:1px solid {{ $fresh ? '#e1efeb' : '#e4eaf0' }}; padding:26px 40px 30px; font-family:{!! $font !!};">
            <p class="t-ink" style="margin:0 0 4px; font-size:15px; line-height:22px; font-weight:700; color:#1b2f45;">{{ $b['name'] }}</p>
            <p class="t-muted" style="margin:0 0 4px; font-size:14px; line-height:22px; color:#5b6b7f;">{{ $where }}</p>
            <p class="t-muted" style="margin:0 0 16px; font-size:14px; line-height:22px; color:#5b6b7f;">
                @if ($phone)<a class="t-link foot-link" href="tel:{{ preg_replace('/[^0-9+]/', '', $phone) }}" style="color:{{ $b['primary'] }}; text-decoration:none; font-weight:600;">{{ $phone }}</a>@endif
                @if ($phone && $b['email'])<span class="sep" style="color:#a9b6c3;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>@endif
                @if ($b['email'])<a class="t-link foot-link" href="mailto:{{ $b['email'] }}" style="color:{{ $b['primary'] }}; text-decoration:none; font-weight:600;">{{ $b['email'] }}</a>@endif
            </p>
            @if (! empty($reason))<p class="t-muted" style="margin:0 0 14px; font-size:14px; line-height:21px; color:#5b6b7f;">{{ $reason }}</p>@endif
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="bg-soft line" style="background-color:#ffffff; border:1px solid #e4eaf0; border-radius:10px; padding:10px 14px; font-size:14px; line-height:20px; color:#5b6b7f;">
                <span class="t-muted">&#128274;&nbsp; Clinic staff will never ask you for your password or a one-time code.</span>
            </td></tr></table>
            <p class="t-muted" style="margin:14px 0 0; font-size:14px; line-height:20px; color:#5b6b7f;">&copy; {{ \App\Support\ClinicClock::now()->year }} {{ $b['name'] }}</p>
        </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
