{{-- A highlighted note. $tone: info (brand), warning (amber) or success (green); $text is escaped. --}}
@php
    $b = \App\Support\Brand::forEmail();
    [$bg, $edge] = match ($tone ?? 'info') { 'warning' => ['#fff7e6', '#c77700'], 'success' => ['#e9f8f1', '#1a7f52'], default => ['#eef5fc', $b['primary']] };
@endphp
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
<tr><td class="bg-soft t-body" style="background-color:{{ $bg }}; border-left:4px solid {{ $edge }}; border-radius:8px; padding:13px 16px; font-size:14px; line-height:21px; color:#354960;">{{ $text }}</td></tr>
</table>
