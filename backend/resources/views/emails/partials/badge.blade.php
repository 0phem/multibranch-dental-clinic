{{-- Status pill. $tone: success (green), due (amber) or info (brand). Text is never colour-only: the word carries the meaning. --}}
@php([$bg, $fg] = match ($tone ?? 'info') { 'success' => ['#e3f6ec', '#146c43'], 'due' => ['#fff1d6', '#8a5300'], default => ['#e6f0fa', '#124b80'] })
<span style="display:inline-block; background-color:{{ $bg }}; color:{{ $fg }}; font-size:12px; line-height:16px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; border-radius:999px; padding:6px 12px;">{!! ($tone ?? '') === 'success' ? '&#10003;&nbsp;' : '' !!}{{ $text }}</span>
