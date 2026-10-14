@php
    $b = \App\Support\Brand::forEmail();
    [$bg, $edge] = match ($tone ?? 'info') { 'warning' => ['#fff6e5', '#c77700'], 'success' => ['#e8f7f0', '#1a7f52'], default => ['#eef5fc', $b['primary']] };
@endphp
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
<tr><td class="bg-soft t-body" style="background-color:{{ $bg }}; border-left:4px solid {{ $edge }}; border-radius:10px; padding:14px 18px; font-size:15px; line-height:23px; color:#33475b;">{{ $text }}</td></tr>
</table>
