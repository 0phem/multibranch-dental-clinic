{{-- The code: very large, spaced with letter-spacing only, so copying gives exactly the six digits as one unbroken string. --}}
@php($b = \App\Support\Brand::forEmail())
@php($fresh = $b['design'] === 'fresh')
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 26px;">
<tr><td align="center" class="bg-soft hero-edge" style="background-color:{{ $fresh ? '#f0f8f6' : '#f4f7fb' }}; border:2px dashed {{ $fresh ? '#9fd3c5' : '#b4c8dd' }}; border-radius:{{ $fresh ? '20px' : '14px' }}; padding:32px 12px 26px;">
    <div class="t-muted" style="font-size:14px; line-height:20px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:#5b6b7f; margin-bottom:10px;">Your verification code</div>
    <div class="code t-ink" style="font-family:'SF Mono', Menlo, Consolas, 'Courier New', monospace; font-size:44px; line-height:54px; font-weight:800; letter-spacing:14px; padding-left:14px; color:{{ $b['primary_dark'] }};">{{ $code }}</div>
    <div style="margin-top:14px;"><span style="display:inline-block; background-color:#fff0d4; color:#8a5300; font-size:14px; line-height:20px; font-weight:800; border-radius:999px; padding:6px 14px;">&#9201;&nbsp; Expires in {{ $minutes }} minutes</span></div>
</td></tr>
</table>
