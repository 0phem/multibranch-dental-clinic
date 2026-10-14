{{-- Receipt: what to do next. Two outlined buttons, one per row so labels never wrap unevenly, and tappable clinic contacts. --}}
@php
    $b = \App\Support\Brand::forEmail($branch ?? null);
    $fresh = $b['design'] === 'fresh';
    $edge = $fresh ? $b['primary'] : $b['accent_dark'];
    $radius = $fresh ? '999px' : '10px';
    $phone = $b['branch_phone'] ?: $b['phone'];
@endphp
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-soft line" style="margin:26px 0 10px; background-color:{{ $fresh ? '#f0f8f6' : '#f7f9fb' }}; border:1px solid {{ $fresh ? '#dcefe9' : '#e3e9f0' }}; border-radius:{{ $fresh ? '20px' : '12px' }};">
<tr><td style="padding:22px 22px 20px;">
    <p class="t-ink" style="margin:0 0 4px; font-size:18px; line-height:26px; font-weight:800; color:#14283d;">Next steps</p>
    <p class="t-muted" style="margin:0 0 16px; font-size:15px; line-height:22px; color:#5b6b7f;">Keep your smile on track. Your receipts and visits are always in your patient portal.</p>
    @foreach ($links as $i => [$label, $url])
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ $url }}" style="height:50px; v-text-anchor:middle; width:470px; margin-top:{{ $i ? '10px' : '0' }};" arcsize="{{ $fresh ? '50%' : '20%' }}" strokecolor="{{ $edge }}" strokeweight="2px" fillcolor="#ffffff"><w:anchorlock/><center style="color:{{ $edge }}; font-family:Arial, sans-serif; font-size:16px; font-weight:bold;">{{ $label }}</center></v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:{{ $i ? '10px' : '0' }};"><tr><td align="center" style="border:2px solid {{ $edge }}; border-radius:{{ $radius }}; background-color:#ffffff;">
        <a href="{{ $url }}" target="_blank" style="display:block; padding:14px 12px; font-size:16px; line-height:20px; font-weight:800; color:{{ $edge }}; text-decoration:none; text-align:center;">{{ $label }}</a>
    </td></tr></table>
    <!--<![endif]-->
    @endforeach
    @if ($phone || $b['email'])
    <p class="t-muted" style="margin:18px 0 8px; font-size:15px; line-height:22px; color:#5b6b7f;">Questions? We are happy to help.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        @if ($phone)<td class="stack" style="padding:0 8px 8px 0;"><a class="t-link chip" href="tel:{{ preg_replace('/[^0-9+]/', '', $phone) }}" style="display:inline-block; background-color:#ffffff; border:1px solid #cfe6df; border-radius:999px; padding:9px 14px; font-size:15px; line-height:20px; font-weight:700; color:{{ $b['primary'] }}; text-decoration:none;">&#128222;&nbsp; {{ $phone }}</a></td>@endif
        @if ($b['email'])<td class="stack" style="padding:0 0 8px 0;"><a class="t-link chip" href="mailto:{{ $b['email'] }}" style="display:inline-block; background-color:#ffffff; border:1px solid #cfe6df; border-radius:999px; padding:10px 14px; font-size:14px; line-height:20px; font-weight:700; color:{{ $b['primary'] }}; text-decoration:none;">&#9993;&#65039;&nbsp; {{ $b['email'] }}</a></td>@endif
    </tr></table>
    @endif
</td></tr>
</table>
