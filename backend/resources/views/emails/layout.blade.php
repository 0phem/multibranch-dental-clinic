{{--
    Shared base for every clinic email (M18). Table layout, inline styles, 600px max width, so it renders the same in Gmail (web and
    app), Apple Mail and Outlook. Branding comes from App\Support\Brand (config clinic.brand + the branch), never from the template.
    The logo is embedded in the message itself as a CID attachment (no remote image, no tunnel); the /dev/mail preview uses a data URI.
    Dark mode: the <style> block only re-colours surfaces for clients that support prefers-color-scheme; the logo sits on its own
    white chip so it stays visible when a client inverts colours. Every email also has a plain-text part (layout-text.blade.php).
    Variables: $subject, $preheader (inbox preview line), $reason (why the person received it), optional $branch (footer contact).
--}}
@php
    $b = \App\Support\Brand::forEmail($branch ?? null);
    $logoPath = \App\Support\Brand::logoPath();
    $logoSrc = $logoPath ? (! empty($brandPreview) || ! isset($message) ? \App\Support\Brand::logoDataUri() : $message->embed($logoPath)) : null;
    $font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
@endphp
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
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
        .code { font-size: 32px !important; letter-spacing: 8px !important; }
        .hero-amount { font-size: 34px !important; line-height: 40px !important; }
        .stack { display: block !important; width: 100% !important; text-align: left !important; }
    }
    @media (prefers-color-scheme: dark) {
        .bg-page { background-color: #0f1720 !important; }
        .bg-card { background-color: #17212c !important; border-color: #263545 !important; }
        .bg-soft { background-color: #1d2a37 !important; border-color: #2b3d50 !important; }
        .bg-foot { background-color: #131c25 !important; border-color: #263545 !important; }
        .t-ink { color: #eef3f8 !important; }
        .t-body { color: #c9d5e2 !important; }
        .t-muted { color: #93a4b7 !important; }
        .t-link { color: #8cc3ff !important; }
        .line { border-color: #2b3d50 !important; }
    }
    [data-ogsc] .bg-card { background-color: #17212c !important; }
    [data-ogsc] .t-ink { color: #eef3f8 !important; }
    [data-ogsc] .t-body { color: #c9d5e2 !important; }
</style>
</head>
<body class="bg-page" style="margin:0; padding:0; background-color:#eef3f8; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
@if (! empty($preheader))
<div style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; mso-hide:all; font-size:1px; line-height:1px; color:#eef3f8;">{{ $preheader }}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
@endif
<table role="presentation" class="bg-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef3f8;">
<tr><td class="outer" align="center" style="padding:32px 12px;">
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" class="shell bg-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border:1px solid #dde6f0; border-radius:16px; overflow:hidden;">
        {{-- Header band: brand gradient with a solid fallback (bgcolor) for clients without gradient support. --}}
        <tr><td class="pad" bgcolor="{{ $b['primary'] }}" style="background-color:{{ $b['primary'] }}; background-image:linear-gradient(135deg, {{ $b['primary_dark'] }} 0%, {{ $b['primary'] }} 55%, {{ $b['accent'] }} 100%); padding:26px 36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                @if ($logoSrc)
                <td valign="middle" style="padding-right:14px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#ffffff" style="background-color:#ffffff; border-radius:14px; padding:6px;">
                        <img src="{{ $logoSrc }}" width="44" height="44" alt="{{ $b['name'] }} logo" style="display:block; width:44px; height:44px; border:0; outline:none; text-decoration:none;">
                    </td></tr></table>
                </td>
                @endif
                <td valign="middle" style="font-family:{!! $font !!};">
                    <div style="font-size:19px; line-height:24px; font-weight:700; color:#ffffff; letter-spacing:0.2px;">{{ $b['name_line'] }}</div>
                    @if ($b['subtitle'])<div style="font-size:12px; line-height:18px; font-weight:600; color:#dcecfb; letter-spacing:2px; text-transform:uppercase;">{{ $b['subtitle'] }}</div>@endif
                </td>
            </tr></table>
        </td></tr>
        {{-- Accent rule under the header. --}}
        <tr><td bgcolor="{{ $b['accent'] }}" style="background-color:{{ $b['accent'] }}; height:4px; line-height:4px; font-size:4px;">&nbsp;</td></tr>
        <tr><td class="pad t-body" style="padding:36px 36px 12px; font-family:{!! $font !!}; font-size:15px; line-height:24px; color:#354960;">
            @yield('content')
        </td></tr>
        <tr><td class="pad t-body" style="padding:4px 36px 32px; font-family:{!! $font !!}; font-size:15px; line-height:24px; color:#354960;">
            <p style="margin:12px 0 0;">Warm regards,<br><strong class="t-ink" style="color:#182b41;">The {{ $b['name'] }} team</strong></p>
        </td></tr>
        {{-- Footer: who we are, how to reach us, why this was sent. No marketing links. --}}
        <tr><td class="pad bg-foot" style="background-color:#f6f9fc; border-top:1px solid #dde6f0; padding:24px 36px 28px; font-family:{!! $font !!}; font-size:12px; line-height:19px; color:#5b6b7f;">
            <p class="t-ink" style="margin:0 0 4px; font-size:13px; font-weight:700; color:#182b41;">{{ $b['name'] }}</p>
            @if ($b['branch_name'])
                <p class="t-muted" style="margin:0 0 2px; color:#5b6b7f;">{{ $b['branch_name'] }}@if ($b['branch_address']) &middot; {{ $b['branch_address'] }}@endif</p>
            @elseif ($b['address'])
                <p class="t-muted" style="margin:0 0 2px; color:#5b6b7f;">{{ $b['address'] }}</p>
            @endif
            @php($phone = $b['branch_phone'] ?: $b['phone'])
            @if ($phone || $b['email'])
                <p class="t-muted" style="margin:0 0 14px; color:#5b6b7f;">
                    @if ($phone)<a class="t-link" href="tel:{{ preg_replace('/[^0-9+]/', '', $phone) }}" style="color:{{ $b['primary'] }}; text-decoration:none;">{{ $phone }}</a>@endif
                    @if ($phone && $b['email']) &nbsp;&middot;&nbsp; @endif
                    @if ($b['email'])<a class="t-link" href="mailto:{{ $b['email'] }}" style="color:{{ $b['primary'] }}; text-decoration:none;">{{ $b['email'] }}</a>@endif
                </p>
            @endif
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="line" style="border-top:1px solid #dde6f0; padding-top:12px; font-family:{!! $font !!}; font-size:12px; line-height:18px;">
                @if (! empty($reason))<p class="t-muted" style="margin:0 0 6px; color:#5b6b7f;">{{ $reason }}</p>@endif
                <p class="t-muted" style="margin:0 0 6px; color:#5b6b7f;">This is an automated message. Clinic staff will never ask you for your password or a one-time code.</p>
                <p class="t-muted" style="margin:0; color:#8796a8;">&copy; {{ \App\Support\ClinicClock::now()->year }} {{ $b['name'] }}</p>
            </td></tr></table>
        </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
