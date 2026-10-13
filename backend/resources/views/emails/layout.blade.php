{{--
    Shared base for every clinic email (M18). 600px table layout with inline styles so it renders the same in Gmail,
    Outlook and phone mail apps; the <style> block only adds dark-mode/mobile touches and keeps the older appointment and
    receipt templates (card / detail-row / btn classes) working until they are redesigned. Every email also has a plain-text
    part (layout-text.blade.php). Nothing here may show an address, phone number or branch the clinic has not configured.
    Variables: $subject, $preheader (inbox preview line), $reason (why the person received it, footer).
--}}
@php($clinic = config('mail.from.name') ?: config('app.name'))
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>{{ $subject ?? $clinic }}</title>
<style>
    @media only screen and (max-width: 620px) { .shell { width: 100% !important; } .pad { padding-left: 20px !important; padding-right: 20px !important; } .code { font-size: 30px !important; letter-spacing: 8px !important; } }
    .card { background-color: #f6f9fc; border: 1px solid #dde6f0; border-radius: 8px; padding: 12px 18px; margin: 20px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #dde6f0; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #5b6b7f; display: inline-block; min-width: 45%; }
    .detail-value { color: #182b41; font-weight: 600; }
    .btn { display: inline-block; background-color: #1865ac; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
    .otp-code { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #124b80; text-align: center; }
</style>
</head>
<body style="margin:0; padding:0; background-color:#eef3f8; -webkit-text-size-adjust:100%;">
@if (! empty($preheader))
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#eef3f8;">{{ $preheader }}&#8202;&#847;&#8202;&#847;&#8202;&#847;&#8202;&#847;&#8202;&#847;</div>
@endif
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef3f8;">
<tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" class="shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#ffffff; border:1px solid #dde6f0; border-radius:12px; overflow:hidden;">
        <tr><td class="pad" style="background-color:#1865ac; padding:22px 32px; font-family:Arial, Helvetica, sans-serif;">
            <div style="font-size:19px; line-height:24px; font-weight:700; color:#ffffff;">{{ $clinic }}</div>
        </td></tr>
        <tr><td class="pad" style="padding:32px 32px 8px; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:24px; color:#354960;">
            @yield('content')
        </td></tr>
        <tr><td class="pad" style="padding:8px 32px 28px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:22px; color:#354960;">
            <p style="margin:16px 0 0;">{{ $clinic }}</p>
        </td></tr>
        <tr><td class="pad" style="background-color:#f6f9fc; border-top:1px solid #dde6f0; padding:18px 32px; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#5b6b7f;">
            @if (! empty($reason))<p style="margin:0 0 6px;">{{ $reason }}</p>@endif
            <p style="margin:0 0 6px;">This is an automated message from {{ $clinic }}. Clinic staff will never ask you for your password or a one-time code.</p>
            @if (config('clinic.support_email'))<p style="margin:0 0 6px;">Questions? Contact <a href="mailto:{{ config('clinic.support_email') }}" style="color:#1865ac;">{{ config('clinic.support_email') }}</a>.</p>@endif
            <p style="margin:0; color:#8796a8;">&copy; {{ now()->year }} {{ $clinic }}</p>
        </td></tr>
    </table>
</td></tr>
</table>
</body>
</html>
