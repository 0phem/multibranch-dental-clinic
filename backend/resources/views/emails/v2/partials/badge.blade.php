{{-- Status pill; the word carries the meaning (never colour only). $tone: paid | due | info. --}}
@php
    $b = \App\Support\Brand::forEmail();
    $fresh = $b['design'] === 'fresh';
    [$bg, $fg] = match ($tone ?? 'info') {
        'paid' => $fresh ? ['#dcf3e8', '#0f6b45'] : [$b['accent_dark'], '#ffffff'],
        'due' => ['#fff0d4', '#8a5300'],
        default => ['#e6f0fa', '#124b80'],
    };
@endphp
<span style="display:inline-block; background-color:{{ $bg }}; color:{{ $fg }}; font-size:14px; line-height:20px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase; border-radius:999px; padding:6px 14px;">{!! ($tone ?? '') === 'paid' ? '&#10003;&nbsp;' : '' !!}{{ $text }}</span>
