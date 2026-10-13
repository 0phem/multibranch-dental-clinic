{{-- One-time code: large monospace digits in ONE unbroken string (letter-spacing only), so a copy gives exactly the six digits. --}}
@php($b = \App\Support\Brand::forEmail())
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 22px;">
<tr><td align="center" class="bg-soft" style="background-color:#eef5fc; border:2px dashed #b9d3ee; border-radius:14px; padding:22px 12px 20px;">
    <div class="t-muted" style="font-size:12px; line-height:16px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#5b6b7f; margin-bottom:10px;">Your verification code</div>
    <div class="code t-ink" style="font-family:'SF Mono', Menlo, Consolas, 'Courier New', monospace; font-size:40px; line-height:48px; font-weight:700; letter-spacing:12px; color:{{ $b['primary_dark'] }}; padding-left:12px;">{{ $code }}</div>
    <div style="margin-top:12px;">
        <span style="display:inline-block; background-color:#fff3d6; color:#8a5300; font-size:13px; line-height:18px; font-weight:700; border-radius:999px; padding:5px 12px;">&#9201; Expires in {{ $minutes }} minutes</span>
    </div>
    <div class="t-muted" style="font-size:12px; line-height:18px; color:#5b6b7f; margin-top:8px;">Works once. Type it on the page where you asked for it.</div>
</td></tr>
</table>
